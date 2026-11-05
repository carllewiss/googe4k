import { format } from "date-fns";
import { COMPANY } from "@/lib/company";

type Tx = {
  date: string;
  desc: string;
  ref?: string;
  debit: number;
  credit: number;
};

export default function CustomerStatementPrint({
  customer,
  invoices,
  payments,
  fromDate,
  toDate,
}: {
  customer: any;
  invoices: any[];
  payments: any[];
  fromDate: Date;
  toDate: Date;
}) {
  const within = (d: string | Date) => {
    const t = new Date(d).getTime();
    return t >= fromDate.getTime() && t <= toDate.getTime() + 86399999;
  };

  // opening balance: invoices before fromDate minus payments before fromDate
  const openingDebit = invoices
    .filter((i) => new Date(i.created_at) < fromDate)
    .reduce((s, i) => s + Number(i.total), 0);
  const openingCredit = payments
    .filter((p) => new Date(p.payment_date) < fromDate)
    .reduce((s, p) => s + Number(p.amount), 0);
  const isReversed = (p: any) => p.status === "reversed";
  const reversalDate = (p: any) => p.reversed_at || p.payment_date;
  // Reversed payments: the original receipt stays as a credit, and the reversal is a debit on its own date
  const openingReversals = payments
    .filter((p) => isReversed(p) && new Date(reversalDate(p)) < fromDate)
    .reduce((s, p) => s + Number(p.amount), 0);
  const opening = openingDebit - openingCredit + openingReversals;

  const rows: Tx[] = [
    ...invoices.filter((i) => within(i.created_at)).map((i) => ({
      date: i.created_at,
      desc: "Invoice",
      ref: i.invoice_number,
      debit: Number(i.total),
      credit: 0,
    })),
    ...payments.filter((p) => within(p.payment_date)).map((p) => ({
      date: p.payment_date,
      desc: (p.source === "pos" ? "Payment (at sale)" : "Payment Received") + (isReversed(p) ? " (reversed)" : ""),
      ref: p.invoice_number || p.id?.replace("pos-", "").slice(0, 8).toUpperCase(),
      debit: 0,
      credit: Number(p.amount),
    })),
    ...payments.filter((p) => isReversed(p) && within(reversalDate(p))).map((p) => ({
      date: reversalDate(p),
      desc: "Payment Reversal",
      ref: p.invoice_number || p.id?.slice(0, 8).toUpperCase(),
      debit: Number(p.amount),
      credit: 0,
    })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let running = opening;
  const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);
  const closing = opening + totalDebit - totalCredit;

  return (
    <div className="hidden print:block bg-white text-black p-8 text-[11pt]" id="statement-print">
      <style>{`@media print { @page { size: A4; margin: 14mm; } body { background: white; } }`}</style>

      <div className="flex justify-between items-start border-b-2 border-black pb-3 mb-4">
        <div>
          <h1 className="text-2xl font-extrabold">{COMPANY.name}</h1>
          <p className="text-xs">{COMPANY.services}</p>
          <p className="text-xs">{COMPANY.address} · Tel: {COMPANY.phone}</p>
          <p className="text-xs">KRA PIN: {COMPANY.kraPin}</p>
        </div>
        <div className="text-right">
          <h2 className="text-xl font-bold">CUSTOMER STATEMENT</h2>
          <p className="text-xs">Period: {format(fromDate, "dd MMM yyyy")} – {format(toDate, "dd MMM yyyy")}</p>
          <p className="text-xs">Generated: {format(new Date(), "dd MMM yyyy HH:mm")}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-4 text-[10pt]">
        <div>
          <p className="font-bold">{customer.name}</p>
          <p>Code: {customer.customer_code}</p>
          {customer.phone && <p>Tel: {customer.phone}</p>}
          {customer.email && <p>Email: {customer.email}</p>}
          {customer.kra_pin && <p>KRA PIN: {customer.kra_pin}</p>}
        </div>
        <div className="text-right">
          <p>Credit Limit: KES {Number(customer.debt_limit).toLocaleString()}</p>
          <p>Credit Terms: {customer.credit_terms || 0} days</p>
        </div>
      </div>

      <table className="w-full border-collapse text-[10pt]">
        <thead>
          <tr className="bg-gray-200 border-y-2 border-black">
            <th className="text-left p-2">Date</th>
            <th className="text-left p-2">Description</th>
            <th className="text-left p-2">Reference</th>
            <th className="text-right p-2">Debit</th>
            <th className="text-right p-2">Credit</th>
            <th className="text-right p-2">Balance</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b">
            <td className="p-2">{format(fromDate, "dd/MM/yyyy")}</td>
            <td className="p-2 italic" colSpan={2}>Opening Balance</td>
            <td className="p-2 text-right">—</td>
            <td className="p-2 text-right">—</td>
            <td className="p-2 text-right font-bold">{opening.toLocaleString()}</td>
          </tr>
          {rows.map((r, i) => {
            running += r.debit - r.credit;
            return (
              <tr key={i} className="border-b">
                <td className="p-2">{format(new Date(r.date), "dd/MM/yyyy")}</td>
                <td className="p-2">{r.desc}</td>
                <td className="p-2 font-mono text-[9pt]">{r.ref}</td>
                <td className="p-2 text-right">{r.debit ? r.debit.toLocaleString() : "—"}</td>
                <td className="p-2 text-right">{r.credit ? r.credit.toLocaleString() : "—"}</td>
                <td className="p-2 text-right font-bold">{running.toLocaleString()}</td>
              </tr>
            );
          })}
          <tr className="border-y-2 border-black bg-gray-100 font-bold">
            <td className="p-2" colSpan={3}>{closing < 0 ? "CLOSING CREDIT BALANCE" : "CLOSING BALANCE"}</td>
            <td className="p-2 text-right">{totalDebit.toLocaleString()}</td>
            <td className="p-2 text-right">{totalCredit.toLocaleString()}</td>
            <td className="p-2 text-right text-base">
              KES {Math.abs(closing).toLocaleString()}{closing < 0 ? " CR" : ""}
            </td>
          </tr>
          {closing < 0 && (
            <tr>
              <td colSpan={6} className="p-2 text-[9pt] italic">
                Credit of KES {Math.abs(closing).toLocaleString()} is held on your account and will be applied to future invoices.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="mt-8 text-[9pt] text-center border-t pt-3">
        <p>Please remit payment to: <span className="font-bold">MPESA Paybill {COMPANY.paybill} (Acc: {COMPANY.paybillAccount})</span></p>
        <p className="italic mt-2">Thank you for your business.</p>
      </div>
    </div>
  );
}
