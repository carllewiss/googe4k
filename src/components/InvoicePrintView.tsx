import { COMPANY } from "@/lib/company";

interface Props {
  invoiceNumber: string;
  customerName: string;
  customerPin?: string | null;
  date: string;
  items: { name: string; quantity: number; unit_price: number; total: number }[];
  subtotal: number;
  tax: number;
  total: number;
  etimsStatus?: string;
  etimsSignature?: string | null;
  etimsQrData?: string | null;
  isReprint?: boolean;
  reprintCount?: number;
  reprintedAt?: string | null;
  reprintedBy?: string;
}

/**
 * Print-ready invoice document.
 * Renders REPRINT/DUPLICATE diagonal watermark when isReprint is true.
 * Use inside a print dialog or a hidden div with `window.print()` triggered.
 */
export function InvoicePrintView({
  invoiceNumber,
  customerName,
  customerPin,
  date,
  items,
  subtotal,
  tax,
  total,
  etimsStatus,
  etimsSignature,
  etimsQrData,
  isReprint,
  reprintCount,
  reprintedAt,
  reprintedBy,
}: Props) {
  const isSigned = etimsStatus === "signed";

  return (
    <div className="relative bg-white text-black p-8 max-w-3xl mx-auto" id="printable-invoice">
      {isReprint && (
        <>
          <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none rotate-[-30deg] z-0">
            <h1 className="text-[160px] font-black border-8 border-red-600 text-red-600 px-8 leading-none">
              REPRINT
            </h1>
          </div>
          <div className="absolute top-2 right-2 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded">
            DUPLICATE COPY #{reprintCount || 1}
          </div>
        </>
      )}

      <div className="relative z-10">
        <div className="flex justify-between items-start border-b-2 border-black pb-4">
          <div>
            <h2 className="text-2xl font-black">
              {isSigned ? "TAX INVOICE" : "SALES RECEIPT"}
            </h2>
            <p className="text-xs text-gray-600 mt-1">{COMPANY.name}</p>
            <p className="text-[10px] text-gray-500">KRA PIN: {COMPANY.kraPin}</p>
            {isReprint && (
              <p className="text-xs text-red-600 underline font-bold mt-1">
                DUPLICATE COPY — NOT FOR ORIGINAL TAX CREDIT
              </p>
            )}
          </div>
          <div className="text-right text-xs">
            <p><span className="font-bold">Invoice:</span> {invoiceNumber}</p>
            <p><span className="font-bold">Date:</span> {new Date(date).toLocaleString()}</p>
          </div>
        </div>

        <div className="mt-4 text-sm">
          <p><span className="font-bold">Bill To:</span> {customerName}</p>
          {customerPin && <p className="font-mono text-xs"><span className="font-bold">KRA PIN:</span> {customerPin.toUpperCase()}</p>}
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
                <td className="py-1.5">{it.name}</td>
                <td className="text-right py-1.5">{it.quantity}</td>
                <td className="text-right py-1.5 font-mono">{it.unit_price.toLocaleString()}</td>
                <td className="text-right py-1.5 font-mono">{it.total.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 flex justify-end">
          <div className="w-64 text-sm space-y-1">
            <div className="flex justify-between"><span>Subtotal:</span> <span className="font-mono">KES {subtotal.toLocaleString()}</span></div>
            <div className="flex justify-between"><span>VAT:</span> <span className="font-mono">KES {tax.toLocaleString()}</span></div>
            <div className="flex justify-between border-t-2 border-black pt-1 font-bold text-base">
              <span>TOTAL:</span> <span className="font-mono">KES {total.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {isSigned && etimsSignature && (
          <div className="mt-8 pt-4 border-t-2 border-black text-xs">
            <p className="font-bold text-green-700">✓ KRA eTIMS VALIDATED</p>
            <p className="font-mono mt-1">Signature: {etimsSignature}</p>
            {etimsQrData && (
              <p className="font-mono text-[10px] mt-1 break-all">Verify: {etimsQrData}</p>
            )}
          </div>
        )}

        {!isSigned && etimsStatus === "pending_sync" && (
          <div className="mt-8 pt-4 border-t border-gray-400 text-xs text-orange-700">
            <p className="font-bold">⏳ PENDING KRA TRANSMISSION</p>
            <p>This receipt will be re-issued as a tax invoice once synced.</p>
          </div>
        )}

        {isReprint && (
          <p className="text-xs italic text-gray-600 mt-6">
            Reprinted{reprintedAt ? ` on ${new Date(reprintedAt).toLocaleString()}` : ""}
            {reprintedBy ? ` by ${reprintedBy}` : ""}
          </p>
        )}

        <div className="mt-6 pt-3 border-t border-gray-300 text-[10px] text-gray-600 leading-tight">
          <p className="font-bold">Payment Details</p>
          <p>MPESA Paybill: {COMPANY.paybill} · Account: {COMPANY.paybillAccount}</p>
          <p className="mt-1">KRA PIN: {COMPANY.kraPin}</p>
        </div>
      </div>
    </div>
  );
}
