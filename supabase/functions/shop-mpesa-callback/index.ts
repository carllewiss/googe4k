// M-Pesa STK callback — Daraja calls this with the payment result.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const stkCb = body?.Body?.stkCallback;
    if (!stkCb) return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });

    const checkoutRequestId = stkCb.CheckoutRequestID;
    const resultCode = stkCb.ResultCode;
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: order } = await supabase
      .from("shop_orders").select("*, shop_order_items(*)")
      .eq("mpesa_checkout_request_id", checkoutRequestId).maybeSingle();
    if (!order) return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });

    if (resultCode === 0) {
      const items = stkCb.CallbackMetadata?.Item || [];
      const receipt = items.find((i: any) => i.Name === "MpesaReceiptNumber")?.Value || `MP${Date.now()}`;
      // Reuse the finalize logic
      const { finalizeOrderAsPaid } = await import("../shop-checkout-stk/index.ts");
      await finalizeOrderAsPaid(supabase, order.id, String(receipt));
    } else {
      await supabase.from("shop_orders").update({ status: "failed", notes: stkCb.ResultDesc }).eq("id", order.id);
    }

    return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
  } catch (e: any) {
    console.error("Callback error:", e);
    return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500, headers: corsHeaders });
  }
});
