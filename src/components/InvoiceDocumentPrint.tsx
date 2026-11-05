import { useSystemSettings } from "@/hooks/useSystemSettings";
import logo from "@/assets/4k-logo.png.asset.json";
import { COMPANY } from "@/lib/company";

export type InvoicePrintFormat = "thermal" | "b5";

interface PrintItem {
  name: string;
  sku?: string | null;
  quantity: number;
  unit_price: number;
  total: number;
}

interface Props {
  format: InvoicePrintFormat;
  invoiceNumber: string;
  customerName: string;
  customerPin?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
  date: string;
  dueDate?: string | null;
  salesPerson?: string | null;
  paymentTerms?: string | null;
  discount?: number;
  items: PrintItem[];
  subtotal: number;
  tax: number;
  total: number;
  etimsStatus?: string;
  etimsSignature?: string | null;
  etimsQrData?: string | null;
  isReprint?: boolean;
  reprintCount?: number;
}

// Brand palette (print only — kept as literals so colours survive @media print)
const TEAL = "#0f6b66";
const TEAL_DARK = "#0b524e";

interface CopyDef {
  label: string;
  isFileCopy: boolean;
}

const COPIES: CopyDef[] = [
  { label: "CUSTOMER COPY", isFileCopy: false },
  { label: "FILE COPY", isFileCopy: true },
];


const money = (n: number) =>
  n.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Multi-format print document for invoices.
 * - Thermal: monospace 80mm receipt, ONE copy only.
 * - B5: clean modern TAX INVOICE + DELIVERY NOTE per copy (1 customer + 2 file copies),
 *   styled after the approved template; file copies carry a diagonal "COPY" watermark.
 * VAT is only displayed when tax is actually charged.
 */
export function InvoiceDocumentPrint(props: Props) {
  const { data: settings } = useSystemSettings();
  const businessName = settings?.business_name || COMPANY.name;
  const companyPin = COMPANY.kraPin;
  const vatActive = settings?.vat_enabled === "true" || settings?.vat_enabled === "1";
  const isSigned = props.etimsStatus === "signed";
  const docTitle = isSigned ? "TAX INVOICE" : "INVOICE";
  // Only show VAT if any VAT is charged on the invoice OR VAT is globally enabled.
  const showVat = props.tax > 0 || vatActive;

  const fmtDate = (d?: string | null, withTime = false) => {
    if (!d) return "—";
    const date = new Date(d);
    const day = date.toLocaleDateString("en-GB");
    return withTime
      ? `${day} ${date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
      : day;
  };

  // ---------------- THERMAL (80mm) — single receipt ----------------
  if (props.format === "thermal") {
    const dash = <div className="border-t border-dashed border-black my-1" />;
    return (
      <div className="bg-white text-black" id="invoice-print-root">
        <style>{`@media print { @page { size: 80mm auto; margin: 3mm; } }`}</style>
        <div className="font-mono text-[8pt] leading-snug" style={{ width: "74mm" }}>
          {/* Header */}
          <div className="text-center">
            <img src={logo.url} alt="logo" style={{ height: "13mm", margin: "0 auto 1mm" }} />
            <p className="font-bold text-[12pt] tracking-wide leading-none">SMART SOLUTIONS</p>
            <p className="text-[6.5pt] mb-1">{COMPANY.tagline}</p>
            <p className="text-[7pt]">{COMPANY.address}</p>
            <p className="text-[7pt]">Tel: {COMPANY.phone}</p>
            <p className="text-[7pt]">Email: {COMPANY.email}</p>
            <p className="text-[7pt]">PIN: {companyPin}</p>
          </div>

          {dash}
          <p className="text-center font-bold text-[12pt] tracking-widest">{docTitle}</p>
          {dash}

          {/* Meta */}
          <div className="text-[7.5pt]">
            <div className="flex"><span className="w-[26mm]">Invoice No</span><span>: {props.invoiceNumber}</span></div>
            <div className="flex"><span className="w-[26mm]">Date</span><span>: {fmtDate(props.date, true)}</span></div>
            {props.dueDate && <div className="flex"><span className="w-[26mm]">Due Date</span><span>: {fmtDate(props.dueDate)}</span></div>}
            {props.salesPerson && <div className="flex"><span className="w-[26mm]">Sales Person</span><span>: {props.salesPerson}</span></div>}
            {props.paymentTerms && <div className="flex"><span className="w-[26mm]">Payment Terms</span><span>: {props.paymentTerms}</span></div>}
          </div>

          {dash}
          {/* Bill to */}
          <div className="text-[7.5pt]">
            <p>Bill To:</p>
            <p className="font-bold text-[8.5pt]">{props.customerName}</p>
            {props.customerAddress && <p>{props.customerAddress}</p>}
            {props.customerPin && <p>PIN: {props.customerPin.toUpperCase()}</p>}
            {props.customerPhone && <p>Tel: {props.customerPhone}</p>}
          </div>

          {dash}
          {/* Items */}
          <table className="w-full text-[7pt]">
            <thead>
              <tr className="border-b border-black">
                <th className="text-left pb-0.5">QTY</th>
                <th className="text-left pb-0.5">ITEM</th>
                <th className="text-right pb-0.5">PRICE</th>
                {showVat && <th className="text-right pb-0.5">VAT</th>}
                <th className="text-right pb-0.5">AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              {props.items.map((it, i) => (
                <tr key={i} className="align-top">
                  <td className="pt-0.5">{it.quantity}</td>
                  <td className="pt-0.5 pr-1">{it.name}</td>
                  <td className="text-right pt-0.5 whitespace-nowrap">{money(it.unit_price)}</td>
                  {showVat && <td className="text-right pt-0.5">16%</td>}
                  <td className="text-right pt-0.5 whitespace-nowrap">{money(it.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {dash}
          {/* Totals */}
          <div className="text-[7.5pt]">
            <div className="flex justify-between"><span>Subtotal{showVat ? " (Excl. VAT)" : ""}</span><span>{money(props.subtotal)}</span></div>
            {showVat && <div className="flex justify-between"><span>VAT (16%)</span><span>{money(props.tax)}</span></div>}
            {!!props.discount && <div className="flex justify-between"><span>Discount</span><span>{money(props.discount)}</span></div>}
          </div>
          {dash}
          <div className="flex justify-between font-bold text-[10pt]">
            <span>TOTAL DUE</span><span>KES {money(props.total)}</span>
          </div>
          <div className="border-t-2 border-double border-black my-1" />

          {/* Payment details */}
          <div className="text-[7pt]">
            <p>Payment Details:</p>
            <p>MPESA Paybill: {COMPANY.paybill}</p>
            <p>A/C No: {COMPANY.paybillAccount}</p>
          </div>

          {props.isReprint && <p className="text-center text-[7pt] mt-1">REPRINT #{props.reprintCount || 1}</p>}
          {isSigned && props.etimsSignature && (
            <p className="text-center text-[6.5pt] mt-1 break-all">eTIMS: {props.etimsSignature}</p>
          )}

          {dash}
          <div className="text-center text-[7.5pt] leading-tight">
            <p className="font-bold">Thank you for your business!</p>
            <p>Goods once sold are not returnable.</p>
          </div>
        </div>
      </div>
    );
  }

  // ---------------- B5 FULL (template-styled Invoice + Delivery Note) ----------------
  const Watermark = ({ text }: { text: string }) => (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 0 }}>
      <span className="text-[150px] font-black rotate-[-32deg] select-none tracking-widest" style={{ color: "rgba(15,107,102,0.07)" }}>
        {text}
      </span>
    </div>
  );

  const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString("en-GB") : "—");

  // Decorative corner accent (echoes the template's top-right ornament)
  const CornerAccent = () => (
    <div
      className="absolute top-0 right-0 pointer-events-none"
      style={{
        width: "44mm",
        height: "44mm",
        background: `radial-gradient(circle at top right, ${TEAL}22, transparent 70%)`,
        zIndex: 1,
      }}
    />
  );

  // Brand header: logo + business name on the left, big document title below.
  const DocHeader = ({ title, copyLabel }: { title: string; copyLabel: string }) => (
    <div className="relative mb-6" style={{ zIndex: 10 }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={logo.url} alt="4K Smart" style={{ height: "15mm" }} />
          <div className="leading-tight">
            <p className="text-[13pt] font-extrabold tracking-tight" style={{ color: TEAL_DARK }}>{businessName}</p>
            <p className="text-[8pt] text-gray-500">{COMPANY.services}</p>
          </div>
        </div>
        <span className="text-[7.5pt] font-bold rounded-full px-3 py-1" style={{ backgroundColor: copyLabel.includes("FILE") ? "#f0f4f4" : TEAL, color: copyLabel.includes("FILE") ? TEAL_DARK : "#ffffff" }}>
          {copyLabel}
        </span>
      </div>
      <div className="mt-4 flex items-end gap-3">
        <h1 className="text-[34pt] font-black leading-none tracking-tight" style={{ color: TEAL_DARK }}>{title}</h1>
        <span className="h-[3px] flex-1 mb-2 rounded-full" style={{ backgroundColor: TEAL }} />
      </div>
    </div>
  );

  const KraFooterBar = () => (
    <div className="absolute left-0 right-0 bottom-0 px-10 py-3 border-t-2" style={{ borderColor: TEAL, zIndex: 10 }}>
      <div className="flex items-center justify-between text-[7.5pt] text-gray-600">
        <span className="flex items-center gap-1">📞 <b>{COMPANY.phone}</b></span>
        <span className="flex items-center gap-1">✉ {COMPANY.email}</span>
        <span className="flex items-center gap-1">📍 {COMPANY.address}</span>
      </div>
      <p className="text-center text-[7pt] mt-1" style={{ color: TEAL }}>KRA PIN: <b>{companyPin}</b></p>
    </div>
  );

  const pageStyle = (last: boolean): React.CSSProperties => ({
    width: "176mm",
    minHeight: "250mm",
    padding: "12mm 12mm 22mm",
    position: "relative",
    pageBreakAfter: last ? "auto" : "always",
  });

  const totalPages = COPIES.length * 2;
  let pageIndex = 0;

  return (
    <div className="bg-white text-black" id="invoice-print-root">
      <style>{`@media print { @page { size: B5; margin: 0; } }`}</style>
      {COPIES.map((copy, ci) => {
        ++pageIndex;
        const invoicePage = (
          <div key={`inv-${ci}`} className="bg-white text-black mx-auto" style={pageStyle(false)}>
            {copy.isFileCopy && <Watermark text="COPY" />}
            <CornerAccent />
            <DocHeader title={isSigned ? "TAX INVOICE" : "INVOICE"} copyLabel={copy.label} />

            {/* Bill-to + meta */}
            <div className="flex justify-between items-start mb-6 relative" style={{ zIndex: 10 }}>
              <div className="text-[9pt]">
                <p className="text-[8pt] font-bold text-gray-400 mb-1">TO</p>
                <p className="font-bold text-[11pt]" style={{ color: TEAL_DARK }}>{props.customerName}</p>
                {props.customerAddress && <p className="text-gray-600">{props.customerAddress}</p>}
                {props.customerPhone && <p className="text-gray-600">Tel: {props.customerPhone}</p>}
                {props.customerPin && <p className="text-gray-600">PIN: {props.customerPin.toUpperCase()}</p>}
              </div>
              <div className="text-[9pt] text-right space-y-0.5">
                <div><span className="text-gray-400 mr-2">Invoice no :</span><span className="font-bold">{props.invoiceNumber}</span></div>
                <div><span className="text-gray-400 mr-2">Date :</span><span className="font-bold">{fmt(props.date)}</span></div>
                {props.dueDate && <div><span className="text-gray-400 mr-2">Due :</span><span className="font-bold">{fmt(props.dueDate)}</span></div>}
              </div>
            </div>

            {/* Items table */}
            <table className="w-full text-[9pt] border-collapse mb-6 relative" style={{ zIndex: 10 }}>
              <thead>
                <tr className="border-b-2" style={{ borderColor: TEAL_DARK }}>
                  <th className="text-left py-2 w-8 font-bold">NO</th>
                  <th className="text-left py-2 font-bold">DESCRIPTION</th>
                  <th className="text-center py-2 w-14 font-bold">QTY</th>
                  <th className="text-right py-2 w-28 font-bold">PRICE</th>
                  {showVat && <th className="text-right py-2 w-14 font-bold">VAT</th>}
                  <th className="text-right py-2 w-28 font-bold">TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {props.items.map((it, i) => (
                  <tr key={i} className="border-b border-gray-200">
                    <td className="py-2">{i + 1}</td>
                    <td className="py-2">
                      <div className="font-medium">{it.name}</div>
                      {it.sku && <div className="text-[7.5pt] text-gray-400">SKU: {it.sku}</div>}
                    </td>
                    <td className="text-center py-2">{it.quantity}</td>
                    <td className="text-right py-2 font-mono">{money(it.unit_price)}</td>
                    {showVat && <td className="text-right py-2">16%</td>}
                    <td className="text-right py-2 font-mono">{money(it.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Payment method + totals */}
            <div className="flex justify-between items-start gap-6 relative" style={{ zIndex: 10 }}>
              <div className="text-[8.5pt]">
                <p className="font-bold text-[10pt] mb-1" style={{ color: TEAL_DARK }}>Payment Method</p>
                <p className="text-gray-600">MPESA Paybill : <b>{COMPANY.paybill}</b></p>
                <p className="text-gray-600">Account : {COMPANY.paybillAccount}</p>
              </div>
              <div className="w-[70mm] text-[9.5pt]">
                <div className="flex justify-between py-1"><span className="text-gray-500">Sub Total</span><span className="font-mono">{money(props.subtotal)}</span></div>
                {showVat && <div className="flex justify-between py-1"><span className="text-gray-500">VAT (16%)</span><span className="font-mono">{money(props.tax)}</span></div>}
                {!!props.discount && <div className="flex justify-between py-1"><span className="text-gray-500">Discount</span><span className="font-mono">{money(props.discount)}</span></div>}
                <div className="flex justify-between items-center text-white font-bold px-3 py-2.5 mt-2 rounded text-[11pt]" style={{ background: `linear-gradient(135deg, ${TEAL}, ${TEAL_DARK})` }}>
                  <span>GRAND TOTAL</span><span className="font-mono">KES {money(props.total)}</span>
                </div>
              </div>
            </div>

            {/* Terms + signature */}
            <div className="flex justify-between items-end mt-8 relative" style={{ zIndex: 10 }}>
              <div className="text-[8pt] text-gray-500 max-w-[90mm]">
                <p className="font-bold text-[9pt] mb-1" style={{ color: TEAL_DARK }}>Terms and Conditions :</p>
                <p>Goods once sold are not returnable. Please settle the invoice within the agreed payment terms.</p>
                {props.isReprint && (
                  <p className="mt-2 font-bold" style={{ color: TEAL }}>REPRINT — DUPLICATE COPY #{props.reprintCount || 1}</p>
                )}
              </div>
              <div className="text-center text-[8pt]">
                <div className="border-b border-gray-400 w-40 mb-1" />
                <p className="font-bold">For {businessName}</p>
                <p className="text-gray-500">Authorized Signature</p>
              </div>
            </div>

            <KraFooterBar />
          </div>
        );

        const dnLast = ++pageIndex === totalPages;
        const deliveryPage = (
          <div key={`dn-${ci}`} className="bg-white text-black mx-auto" style={pageStyle(dnLast)}>
            {copy.isFileCopy && <Watermark text="COPY" />}
            <CornerAccent />
            <DocHeader title="DELIVERY NOTE" copyLabel={copy.label} />

            <div className="flex justify-between items-start mb-6 relative" style={{ zIndex: 10 }}>
              <div className="text-[9pt]">
                <p className="text-[8pt] font-bold text-gray-400 mb-1">DELIVER TO</p>
                <p className="font-bold text-[11pt]" style={{ color: TEAL_DARK }}>{props.customerName}</p>
                {props.customerAddress && <p className="text-gray-600">{props.customerAddress}</p>}
                {props.customerPhone && <p className="text-gray-600">Tel: {props.customerPhone}</p>}
              </div>
              <div className="text-[9pt] text-right space-y-0.5">
                <div><span className="text-gray-400 mr-2">D/Note no :</span><span className="font-bold">{props.invoiceNumber.replace(/^INV/, "DN")}</span></div>
                <div><span className="text-gray-400 mr-2">Date :</span><span className="font-bold">{fmt(props.date)}</span></div>
                <div><span className="text-gray-400 mr-2">Reference :</span><span className="font-bold">{props.invoiceNumber}</span></div>
              </div>
            </div>

            <table className="w-full text-[9pt] border-collapse mb-6 relative" style={{ zIndex: 10 }}>
              <thead>
                <tr className="border-b-2" style={{ borderColor: TEAL_DARK }}>
                  <th className="text-left py-2 w-8 font-bold">NO</th>
                  <th className="text-left py-2 font-bold">DESCRIPTION</th>
                  <th className="text-center py-2 w-24 font-bold">QTY ORDERED</th>
                  <th className="text-center py-2 w-24 font-bold">QTY DELIVERED</th>
                  <th className="text-left py-2 w-24 font-bold">REMARKS</th>
                </tr>
              </thead>
              <tbody>
                {props.items.map((it, i) => (
                  <tr key={i} className="border-b border-gray-200">
                    <td className="py-2">{i + 1}</td>
                    <td className="py-2">
                      <div className="font-medium">{it.name}</div>
                      {it.sku && <div className="text-[7.5pt] text-gray-400">SKU: {it.sku}</div>}
                    </td>
                    <td className="text-center py-2">{it.quantity}</td>
                    <td className="text-center py-2">{it.quantity}</td>
                    <td className="py-2">—</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-between items-end mt-10 relative" style={{ zIndex: 10 }}>
              <div className="text-[8.5pt] text-gray-600 max-w-[90mm]">
                <p className="font-bold text-[9pt] mb-1" style={{ color: TEAL_DARK }}>Remarks / Notes</p>
                <p>Goods received in good condition.</p>
              </div>
              <div className="text-[8.5pt] space-y-3">
                <p>Received by: <span className="inline-block border-b border-gray-400 w-36 ml-1" /></p>
                <p>Signature: <span className="inline-block border-b border-gray-400 w-32 ml-1" /></p>
                <p>Date: <span className="inline-block border-b border-gray-400 w-36 ml-1" /></p>
              </div>
            </div>

            <KraFooterBar />
          </div>
        );

        return [invoicePage, deliveryPage];
      })}
    </div>
  );
}
