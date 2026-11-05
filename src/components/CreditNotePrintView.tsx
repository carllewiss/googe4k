import { COMPANY } from "@/lib/company";

interface CreditNoteItem {
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
  is_service: boolean;
}

interface Props {
  creditNoteNumber: string;
  invoiceNumber: string;
  customerName: string;
  customerPin?: string | null;
  date: string;
  reason?: string | null;
  items: CreditNoteItem[];
  subtotal: number;
  tax: number;
  total: number;
  refundMethod: string;
  refundAmount: number;
  isReprint?: boolean;
  reprintCount?: number;
}

const refundLabel: Record<string, string> = {
  none: "Account Adjustment (no refund)",
  credit_balance: "Credited to Customer Account",
  cash_refund: "Cash Refund",
  mpesa_refund: "M-Pesa Refund",
};

export function CreditNotePrintView({
  creditNoteNumber, invoiceNumber, customerName, customerPin, date,
  reason, items, subtotal, tax, total, refundMethod, refundAmount,
  isReprint, reprintCount,
}: Props) {
  return (
    <div className="relative bg-white text-black p-8 max-w-3xl mx-auto" id="printable-credit-note">
      {isReprint && (
        <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none rotate-[-30deg] z-0">
          <h1 className="text-[140px] font-black border-8 border-red-600 text-red-600 px-8 leading-none">
            REPRINT
          </h1>
        </div>
      )}
      <div className="relative z-10">
        <div className="flex justify-between items-start border-b-2 border-black pb-4">
          <div>
            <h2 className="text-2xl font-black">CREDIT NOTE</h2>
            <p className="text-xs text-gray-600 mt-1">{COMPANY.name}</p>
            <p className="text-[10px] text-gray-500">KRA PIN: {COMPANY.kraPin}</p>
          </div>
          <div className="text-right text-xs">
            <p><span className="font-bold">CN #:</span> {creditNoteNumber}</p>
            <p><span className="font-bold">Against Invoice:</span> {invoiceNumber}</p>
            <p><span className="font-bold">Date:</span> {new Date(date).toLocaleString()}</p>
            {isReprint && reprintCount ? (
              <p className="text-red-600 font-bold mt-1">DUPLICATE #{reprintCount}</p>
            ) : null}
          </div>
        </div>

        <div className="mt-4 text-sm">
          <p><span className="font-bold">Issued To:</span> {customerName}</p>
          {customerPin && <p className="font-mono text-xs"><span className="font-bold">KRA PIN:</span> {customerPin.toUpperCase()}</p>}
          {reason && <p className="mt-1"><span className="font-bold">Reason:</span> {reason}</p>}
        </div>

        <table className="w-full mt-6 text-sm border-collapse">
          <thead>
            <tr className="border-b-2 border-black">
              <th className="text-left py-2">Item</th>
              <th className="text-right py-2 w-16">Qty</th>
              <th className="text-right py-2 w-24">Unit</th>
              <th className="text-right py-2 w-28">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i} className="border-b border-gray-300">
                <td className="py-1.5">
                  {it.product_name}
                  {it.is_service && <span className="text-[10px] text-gray-500 ml-2">(service)</span>}
                </td>
                <td className="text-right py-1.5">{it.quantity}</td>
                <td className="text-right py-1.5 font-mono">{Number(it.unit_price).toLocaleString()}</td>
                <td className="text-right py-1.5 font-mono">{Number(it.total).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 flex justify-end">
          <div className="w-72 text-sm space-y-1">
            <div className="flex justify-between"><span>Subtotal:</span> <span className="font-mono">KES {Number(subtotal).toLocaleString()}</span></div>
            <div className="flex justify-between"><span>VAT:</span> <span className="font-mono">KES {Number(tax).toLocaleString()}</span></div>
            <div className="flex justify-between border-t-2 border-black pt-1 font-bold text-base">
              <span>CREDITED TOTAL:</span> <span className="font-mono">KES {Number(total).toLocaleString()}</span>
            </div>
            <div className="flex justify-between pt-2 text-xs">
              <span>Settlement:</span>
              <span className="font-bold">{refundLabel[refundMethod] || refundMethod}</span>
            </div>
            {Number(refundAmount) > 0 && (
              <div className="flex justify-between text-xs">
                <span>Amount:</span>
                <span className="font-mono">KES {Number(refundAmount).toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>

        <div className="mt-10 text-xs text-gray-600 border-t pt-3">
          Returned products have been restored to stock. This credit note reduces the original invoice value.
          <p className="mt-2">KRA PIN: {COMPANY.kraPin} · MPESA Paybill: {COMPANY.paybill}</p>
        </div>
      </div>
    </div>
  );
}
