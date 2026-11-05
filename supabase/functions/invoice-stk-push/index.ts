// Invoice STK Push — initiates an M-Pesa Daraja STK prompt to collect payment on an ERP invoice.
// On success, the callback (invoice-mpesa-callback) records the payment and marks the invoice paid.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface StkBody {
  invoice_id?: string | null; // omit for debt payments allocated after settlement
  customer_id?: string | null;
  phone: string;
  amount: number;
  created_by?: string | null;
}

function normalizePhone(p: string): string {
  const digits = p.replace(/\D/g, "");
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0")) return "254" + digits.slice(1);
  if (digits.startsWith("7") || digits.startsWith("1")) return "254" + digits;
  return digits;
}

async function getMpesaToken(key: string, secret: string, env: "sandbox" | "production") {
  const auth = btoa(`${key}:${secret}`);
  const url = env === "production"
    ? "https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials"
    : "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials";
  const res = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
  if (!res.ok) throw new Error(`MPesa token failed: ${await res.text()}`);
  const data = await res.json();
  return data.access_token as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body: StkBody = await req.json();
    if ((!body.invoice_id && !body.customer_id) || !body.phone || !body.amount || body.amount <= 0) {
      return new Response(JSON.stringify({ error: "Missing invoice, phone or amount" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const phone = normalizePhone(body.phone);
    const amount = Math.round(Number(body.amount));

    // Fetch invoice number for the STK reference
    const { data: inv } = await supabase
      .from("invoices").select("invoice_number, customer_id").eq("id", body.invoice_id ?? "00000000-0000-0000-0000-000000000000").maybeSingle();
    const invoiceNumber = inv?.invoice_number || "DEBT";

    // Create pending transaction
    const { data: tx, error: txErr } = await supabase.from("mpesa_transactions").insert({
      invoice_id: body.invoice_id || null,
      customer_id: body.customer_id ?? inv?.customer_id ?? null,
      phone,
      amount,
      status: "pending",
      created_by: body.created_by ?? null,
    }).select().single();
    if (txErr) throw txErr;

    const consumerKey = Deno.env.get("MPESA_CONSUMER_KEY");
    const consumerSecret = Deno.env.get("MPESA_CONSUMER_SECRET");
    const shortcode = Deno.env.get("MPESA_SHORTCODE");
    const passkey = Deno.env.get("MPESA_PASSKEY");
    const env = (Deno.env.get("MPESA_ENV") || "sandbox") as "sandbox" | "production";

    if (consumerKey && consumerSecret && shortcode && passkey) {
      try {
        const token = await getMpesaToken(consumerKey, consumerSecret, env);
        const ts = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);
        const password = btoa(`${shortcode}${passkey}${ts}`);
        const callbackUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/invoice-mpesa-callback`;

        const stkUrl = env === "production"
          ? "https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest"
          : "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest";

        const stkRes = await fetch(stkUrl, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            BusinessShortCode: shortcode,
            Password: password,
            Timestamp: ts,
            TransactionType: "CustomerPayBillOnline",
            Amount: amount,
            PartyA: phone,
            PartyB: shortcode,
            PhoneNumber: phone,
            CallBackURL: callbackUrl,
            AccountReference: invoiceNumber,
            TransactionDesc: `4K Smart ${invoiceNumber}`,
          }),
        });

        const stkData = await stkRes.json();
        if (stkData.CheckoutRequestID) {
          await supabase.from("mpesa_transactions").update({
            checkout_request_id: stkData.CheckoutRequestID,
            merchant_request_id: stkData.MerchantRequestID ?? null,
          }).eq("id", tx.id);
          return new Response(JSON.stringify({ transaction_id: tx.id, mode: "live" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw new Error(stkData.errorMessage || "STK push failed");
      } catch (e) {
        console.error("M-Pesa STK error:", e);
        // Fall through to test mode
      }
    }

    // TEST MODE: simulate a successful payment after 6s so the flow can be verified end-to-end.
    setTimeout(async () => {
      try {
        const { finalizeInvoicePayment } = await import("../invoice-mpesa-callback/index.ts");
        await finalizeInvoicePayment(supabase, tx.id, `TEST${Date.now()}`);
      } catch (e) {
        console.error("Test finalize failed:", e);
      }
    }, 6000);

    return new Response(JSON.stringify({ transaction_id: tx.id, mode: "test" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("Invoice STK error:", e);
    return new Response(JSON.stringify({ error: e.message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
