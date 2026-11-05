// M-Pesa STK callback for ERP invoices — Daraja posts the payment result here.
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

    const { data: tx } = await supabase
      .from("mpesa_transactions").select("*")
      .eq("checkout_request_id", checkoutRequestId).maybeSingle();
    if (!tx) return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });

    if (resultCode === 0) {
      const items = stkCb.CallbackMetadata?.Item || [];
      const receipt = items.find((i: any) => i.Name === "MpesaReceiptNumber")?.Value || `MP${Date.now()}`;
      await finalizeInvoicePayment(supabase, tx.id, String(receipt));
    } else {
      await supabase.from("mpesa_transactions")
        .update({ status: "failed", result_desc: stkCb.ResultDesc || "Payment failed" })
        .eq("id", tx.id);
    }

    return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
  } catch (e: any) {
    console.error("Invoice callback error:", e);
    return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500, headers: corsHeaders });
  }
});

// Records the M-Pesa payment against the invoice, updates balances, and marks the tx paid.
// The payments INSERT fires the GL auto-posting trigger (Dr Bank/M-Pesa, Cr Accounts Receivable).
async function finalizeInvoicePayment(supabase: any, txId: string, mpesaReceipt: string) {
  const { data: tx } = await supabase.from("mpesa_transactions").select("*").eq("id", txId).single();
  if (!tx || tx.status === "success") return;

  const amount = Number(tx.amount);

  if (tx.invoice_id) {
    const { data: inv } = await supabase
      .from("invoices").select("paid_amount, total, customer_id").eq("id", tx.invoice_id).single();

    if (inv) {
      const customerId = tx.customer_id || inv.customer_id;

      // Record the payment (fires GL posting trigger)
      await supabase.from("payments").insert({
        invoice_id: tx.invoice_id,
        customer_id: customerId,
        amount,
        cash_amount: 0,
        mpesa_amount: amount,
        notes: `M-Pesa STK (${mpesaReceipt})`,
        created_by: tx.created_by ?? null,
      });

      // Update invoice paid / balance / status
      const newPaid = Number(inv.paid_amount) + amount;
      const newBalance = Math.max(0, Number(inv.total) - newPaid);
      await supabase.from("invoices").update({
        paid_amount: newPaid,
        balance: newBalance,
        mpesa_amount: amount,
        status: newBalance === 0 ? "paid" : "partial",
      }).eq("id", tx.invoice_id);

      // Update customer running balance
      if (customerId) {
        const { data: cust } = await supabase
          .from("customers").select("current_balance, total_spent").eq("id", customerId).single();
        if (cust) {
          await supabase.from("customers").update({
            current_balance: Math.max(0, Number(cust.current_balance) - amount),
            total_spent: Number(cust.total_spent) + amount,
          }).eq("id", customerId);
        }
      }
    }
  }

  await supabase.from("mpesa_transactions").update({
    status: "success",
    mpesa_receipt_number: mpesaReceipt,
    paid_at: new Date().toISOString(),
  }).eq("id", txId);
}

export { finalizeInvoicePayment };
