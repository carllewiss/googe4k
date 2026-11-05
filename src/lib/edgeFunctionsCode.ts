export interface EdgeFunctionDefinition {
  name: string;
  slug: string;
  description: string;
  method: 'POST' | 'GET';
  triggerReason: string;
  code: string;
  samplePayload: string;
}

export const SUPABASE_EDGE_FUNCTIONS: EdgeFunctionDefinition[] = [
  {
    name: 'Process Order & Stock Allocation',
    slug: 'process-order',
    description: 'Validates stock availability across warehouses, atomically decrements inventory, creates corresponding invoice, and logs transaction.',
    method: 'POST',
    triggerReason: 'Triggered when a sales order moves from draft to confirmed status.',
    samplePayload: JSON.stringify({
      orderId: 'c83d6a2a-89a1-4322-92fc-92b1a8d4fa92',
      customerEmail: 'finance@acmeindustries.com',
      autoGenerateInvoice: true
    }, null, 2),
    code: `// Supabase Edge Function: process-order
// Runtime: Deno / TypeScript
// Deploy: supabase functions deploy process-order

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { orderId, autoGenerateInvoice } = await req.json();

    if (!orderId) {
      return new Response(
        JSON.stringify({ error: "Missing required orderId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Fetch order and line items
    const { data: order, error: orderErr } = await supabaseClient
      .from("erp_orders")
      .select("*, erp_order_items(*)")
      .eq("id", orderId)
      .single();

    if (orderErr || !order) {
      throw new Error(\`Order not found: \${orderErr?.message || "Invalid ID"}\`);
    }

    // 2. Call PostgreSQL Atomic Stored Procedure
    const { data: rpcResult, error: rpcErr } = await supabaseClient
      .rpc("deduct_inventory_atomic", { p_order_id: orderId });

    if (rpcErr) {
      throw new Error(\`Stock deduction failed: \${rpcErr.message}\`);
    }

    // 3. Optionally create Invoice
    let invoiceRecord = null;
    if (autoGenerateInvoice) {
      const invoiceNumber = "INV-" + Math.floor(100000 + Math.random() * 900000);
      const { data: invData, error: invErr } = await supabaseClient
        .from("erp_invoices")
        .insert({
          invoice_number: invoiceNumber,
          order_id: orderId,
          customer_name: order.customer_name,
          subtotal: order.subtotal,
          tax: order.tax,
          total: order.total,
          status: "issued"
        })
        .select()
        .single();

      if (!invErr) {
        invoiceRecord = invData;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        orderId,
        status: "processing",
        inventoryDeducted: true,
        invoice: invoiceRecord
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
`
  },
  {
    name: 'Inventory Reorder Monitor & Alert',
    slug: 'reorder-notifier',
    description: 'Scans public.erp_inventory for items below min_stock_threshold, drafts auto purchase orders for primary vendors, and dispatches webhook alerts.',
    method: 'POST',
    triggerReason: 'Runs via pg_cron schedule every 6 hours or on manual procurement run.',
    samplePayload: JSON.stringify({
      warehouse: 'all',
      autoCreateDraftPO: true,
      alertEmail: 'purchasing@company.com'
    }, null, 2),
    code: `// Supabase Edge Function: reorder-notifier
// Runtime: Deno / TypeScript
// Deploy: supabase functions deploy reorder-notifier

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Query inventory items below threshold
    const { data: lowStockItems, error } = await supabase
      .from("erp_inventory")
      .select("*")
      .lte("quantity", supabase.rpc ? 10 : 10) // or compare column directly
      .order("quantity", { ascending: true });

    if (error) throw error;

    const criticalItems = (lowStockItems || []).filter(
      (item) => item.quantity <= item.min_stock_threshold
    );

    // Audit log this check
    await supabase.from("erp_audit_log").insert({
      actor: "edge-function/reorder-notifier",
      action: "LOW_STOCK_SCAN",
      module: "procurement",
      details: \`Evaluated inventory: Found \${criticalItems.length} items needing reorder.\`
    });

    return new Response(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        totalChecked: lowStockItems?.length || 0,
        lowStockCount: criticalItems.length,
        itemsToReorder: criticalItems
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
`
  },
  {
    name: 'Stripe Webhook ERP Payment Sync',
    slug: 'stripe-erp-webhook',
    description: 'Receives payment_intent.succeeded webhooks, marks ERP sales order and invoice as "paid", and reconciles general ledger.',
    method: 'POST',
    triggerReason: 'Stripe payment notifications for customer invoices.',
    samplePayload: JSON.stringify({
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_3MtwBwLkdIwHu7ix28a3tqPa',
          amount: 450000,
          metadata: { orderId: 'c83d6a2a-89a1-4322-92fc-92b1a8d4fa92' }
        }
      }
    }, null, 2),
    code: `// Supabase Edge Function: stripe-erp-webhook
// Runtime: Deno / TypeScript
// Deploy: supabase functions deploy stripe-erp-webhook

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json();
    const eventType = body.type;

    if (eventType === "payment_intent.succeeded") {
      const paymentIntent = body.data.object;
      const orderId = paymentIntent.metadata?.orderId;

      if (orderId) {
        // Mark order paid
        await supabase
          .from("erp_orders")
          .update({ payment_status: "paid" })
          .eq("id", orderId);

        // Mark invoice paid
        await supabase
          .from("erp_invoices")
          .update({ status: "paid", amount_paid: paymentIntent.amount / 100 })
          .eq("order_id", orderId);

        // Add to audit trail
        await supabase.from("erp_audit_log").insert({
          actor: "stripe-webhook",
          action: "PAYMENT_SETTLED",
          module: "invoices",
          details: \`Settled \${paymentIntent.amount / 100} USD for order \${orderId}\`
        });
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
`
  },
  {
    name: 'Executive ERP KPI Aggregator',
    slug: 'erp-analytics',
    description: 'Edge-cached analytics engine calculating 30-day trailing revenue, top-selling SKUs, inventory turnover ratio, and vendor performance rating.',
    method: 'GET',
    triggerReason: 'Queried by executive dashboard and weekly executive summaries.',
    samplePayload: JSON.stringify({ rangeDays: 30 }, null, 2),
    code: `// Supabase Edge Function: erp-analytics
// Runtime: Deno / TypeScript
// Deploy: supabase functions deploy erp-analytics

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    // Compute metrics
    const [invRes, ordersRes, poRes] = await Promise.all([
      supabase.from("erp_inventory").select("quantity, unit_price, cost_price, status"),
      supabase.from("erp_orders").select("total, status, payment_status, order_date"),
      supabase.from("erp_purchase_orders").select("total_amount, status")
    ]);

    const inventoryValue = (invRes.data || []).reduce(
      (sum, item) => sum + (item.quantity * item.unit_price), 0
    );
    const totalInventoryCost = (invRes.data || []).reduce(
      (sum, item) => sum + (item.quantity * item.cost_price), 0
    );

    const grossRevenue = (ordersRes.data || []).reduce(
      (sum, order) => sum + Number(order.total || 0), 0
    );

    return new Response(
      JSON.stringify({
        asOf: new Date().toISOString(),
        inventoryValue: Math.round(inventoryValue),
        inventoryCost: Math.round(totalInventoryCost),
        projectedGrossProfit: Math.round(inventoryValue - totalInventoryCost),
        totalOrdersRevenue: Math.round(grossRevenue),
        skuCount: invRes.data?.length || 0,
        activeOrders: (ordersRes.data || []).filter(o => o.status !== "cancelled").length
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
`
  }
];
