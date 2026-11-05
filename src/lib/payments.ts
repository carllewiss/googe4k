export type UnifiedPayment = {
  id: string;
  invoice_id: string;
  customer_id: string;
  amount: number;
  cash_amount: number;
  mpesa_amount: number;
  payment_date: string;
  notes?: string | null;
  source: "pos" | "allocation";
  invoice_number?: string | null;
  status?: string | null;
  reversed_at?: string | null;
};

/**
 * Payments captured at the point of sale live on the invoice row itself
 * (cash_amount / mpesa_amount) — they are never written to `payments`.
 * This turns them into payment rows so statements & invoice panels show them.
 */
export function posPaymentFromInvoice(inv: any): UnifiedPayment | null {
  const cash = Number(inv.cash_amount) || 0;
  const mpesa = Number(inv.mpesa_amount) || 0;
  const amount = cash + mpesa;
  if (amount <= 0) return null;
  return {
    id: `pos-${inv.id}`,
    invoice_id: inv.id,
    customer_id: inv.customer_id,
    amount,
    cash_amount: cash,
    mpesa_amount: mpesa,
    payment_date: inv.created_at,
    notes: "Paid at point of sale",
    source: "pos",
    invoice_number: inv.invoice_number ?? null,
  };
}

/** Merge point-of-sale payments with later debt allocations, newest first. */
export function unifiedPayments(invoices: any[], payments: any[]): UnifiedPayment[] {
  const invNo = new Map<string, string>();
  invoices.forEach((i) => invNo.set(i.id, i.invoice_number));

  const pos = invoices.map(posPaymentFromInvoice).filter(Boolean) as UnifiedPayment[];
  const allocations: UnifiedPayment[] = payments.map((p) => ({
    id: p.id,
    invoice_id: p.invoice_id,
    customer_id: p.customer_id,
    amount: Number(p.amount) || 0,
    cash_amount: Number(p.cash_amount) || 0,
    mpesa_amount: Number(p.mpesa_amount) || 0,
    payment_date: p.payment_date,
    notes: p.notes ?? null,
    source: "allocation",
    invoice_number: invNo.get(p.invoice_id) ?? null,
    status: p.status ?? "posted",
    reversed_at: p.reversed_at ?? null,
  }));

  return [...pos, ...allocations].sort(
    (a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()
  );
}
