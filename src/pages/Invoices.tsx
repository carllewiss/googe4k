import { useMemo, useState } from "react";
import { useInvoices } from "@/hooks/useInvoices";
import { useCreditNotes, useReprintCreditNote } from "@/hooks/useCreditNotes";
import { usePayments } from "@/hooks/usePayments";
import { useMarkReprint } from "@/hooks/useEtims";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format, differenceInDays } from "date-fns";
import { Search, Receipt, FileText, Printer, FileX, Smartphone } from "lucide-react";
import { InvoiceDocumentPrint, InvoicePrintFormat } from "@/components/InvoiceDocumentPrint";
import { CreditNotePrintView } from "@/components/CreditNotePrintView";
import { CreditNoteDialog } from "@/components/CreditNoteDialog";
import { InvoiceDetailPanel, CreditNoteDetailPanel } from "@/components/InvoiceDetailPanel";
import CustomerStatementPrint from "@/components/CustomerStatementPrint";
import PaymentDialog from "@/components/PaymentDialog";
import StkPushDialog from "@/components/StkPushDialog";
import { supabase } from "@/integrations/supabase/client";
import { printDocument } from "@/lib/print";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

type Tab = "all" | "paid" | "unpaid" | "overdue" | "credit_notes" | "cancelled";

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "paid", label: "Paid" },
  { key: "unpaid", label: "Unpaid" },
  { key: "overdue", label: "Overdue" },
  { key: "credit_notes", label: "Credit Notes" },
  { key: "cancelled", label: "Cancelled" },
];

const statusPill = (s: string) =>
  s === "paid"
    ? "bg-success/10 text-success"
    : s === "partial"
    ? "bg-warning/10 text-warning"
    : s === "overdue"
    ? "bg-destructive/10 text-destructive"
    : s === "credit_note"
    ? "bg-destructive/10 text-destructive"
    : "bg-muted text-muted-foreground";

export default function Invoices() {
  const { data: invoices = [], isLoading } = useInvoices();
  const { data: creditNotes = [] } = useCreditNotes();
  const { data: payments = [] } = usePayments();
  const reprint = useMarkReprint();
  const reprintCN = useReprintCreditNote();
  const { isAdmin } = useAuth();

  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [selected, setSelected] = useState<{ type: "invoice" | "credit_note"; id: string } | null>(null);

  // dialogs
  const [printData, setPrintData] = useState<any>(null);
  const [printFormat, setPrintFormat] = useState<InvoicePrintFormat | null>(null);
  const [cnPrint, setCnPrint] = useState<any>(null);
  const [cnInvoiceId, setCnInvoiceId] = useState<string | null>(null);
  const [payFor, setPayFor] = useState<{ id: string; name: string; balance: number } | null>(null);
  const [statementFor, setStatementFor] = useState<any>(null);
  const [stkFor, setStkFor] = useState<{ invoiceId: string; invoiceNumber: string; customerId: string; customerName: string; phone: string; amount: number } | null>(null);

  const openStk = (inv: any) => setStkFor({
    invoiceId: inv.id,
    invoiceNumber: inv.invoice_number,
    customerId: inv.customer_id,
    customerName: inv.customer_name || "Customer",
    phone: inv.customer_phone || "",
    amount: Number(inv.balance),
  });

  const isOverdue = (inv: any) =>
    Number(inv.balance) > 0 && differenceInDays(new Date(), new Date(inv.created_at)) > (inv.customer_credit_terms || 30);

  // Unified, searchable, filtered document list
  const docs = useMemo(() => {
    const term = search.trim().toLowerCase();
    const matchInv = (inv: any) => {
      if (!term) return true;
      return [
        inv.invoice_number, inv.customer_name, inv.customer_phone,
        inv.customer_kra_pin, inv.customer_code, String(inv.total),
      ].some((f) => f && String(f).toLowerCase().includes(term));
    };
    const matchCN = (cn: any) => {
      if (!term) return true;
      return [
        cn.credit_note_number, cn.customers?.name, cn.customers?.customer_code,
        cn.invoices?.invoice_number, String(cn.total),
      ].some((f) => f && String(f).toLowerCase().includes(term));
    };

    const invDocs = invoices.filter(matchInv).map((inv: any) => {
      const overdue = isOverdue(inv);
      const status = overdue ? "overdue" : inv.status;
      return {
        type: "invoice" as const, id: inv.id, number: inv.invoice_number,
        customer: inv.customer_name, date: inv.created_at, amount: Number(inv.total),
        status, raw: inv,
      };
    });

    const cnDocs = creditNotes.filter(matchCN).map((cn: any) => ({
      type: "credit_note" as const, id: cn.id, number: cn.credit_note_number,
      customer: cn.customers?.name || "—", date: cn.created_at, amount: -Number(cn.total),
      status: "credit_note", raw: cn,
    }));

    let all = [...invDocs, ...cnDocs];
    if (tab === "paid") all = invDocs.filter((d) => d.status === "paid");
    else if (tab === "unpaid") all = invDocs.filter((d) => d.status === "unpaid" || d.status === "partial");
    else if (tab === "overdue") all = invDocs.filter((d) => d.status === "overdue");
    else if (tab === "credit_notes") all = cnDocs;
    else if (tab === "cancelled") all = invDocs.filter((d) => d.raw.status === "cancelled");

    return all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [invoices, creditNotes, search, tab]);

  const counts = useMemo(() => ({
    all: invoices.length + creditNotes.length,
    paid: invoices.filter((i) => i.status === "paid" && !isOverdue(i)).length,
    unpaid: invoices.filter((i) => (i.status === "unpaid" || i.status === "partial") && !isOverdue(i)).length,
    overdue: invoices.filter(isOverdue).length,
    credit_notes: creditNotes.length,
    cancelled: invoices.filter((i) => (i.status as string) === "cancelled").length,
  }), [invoices, creditNotes]);

  const selectedInvoice = selected?.type === "invoice" ? invoices.find((i) => i.id === selected.id) : null;
  const selectedCN = selected?.type === "credit_note" ? creditNotes.find((c: any) => c.id === selected.id) : null;

  // ---- Invoice print
  const openInvoicePrint = async (inv: any, asReprint: boolean) => {
    const { data: items } = await supabase
      .from("invoice_items")
      .select("quantity, unit_price, total, products(name)")
      .eq("invoice_id", inv.id);

    let reprintCount = inv.reprint_count || 0;
    if (asReprint) {
      try { reprintCount = await reprint.mutateAsync(inv.id); }
      catch (e: any) { toast.error(e.message); return; }
    }
    setPrintFormat(null);
    setPrintData({
      invoiceNumber: inv.invoice_number,
      customerName: inv.customer_name,
      customerPin: inv.customer_kra_pin,
      customerPhone: inv.customer_phone,
      date: inv.created_at,
      items: (items || []).map((it: any) => ({
        name: it.products?.name || "Item",
        quantity: it.quantity, unit_price: Number(it.unit_price), total: Number(it.total),
      })),
      subtotal: Number(inv.subtotal), tax: Number(inv.tax), total: Number(inv.total),
      etimsStatus: inv.etims_status, etimsSignature: inv.etims_signature, etimsQrData: inv.etims_qr_data,
      isReprint: asReprint || (inv.reprint_count || 0) > 0, reprintCount,
    });
  };

  const doPrint = (fmt: InvoicePrintFormat) => {
    setPrintFormat(fmt);
    setTimeout(() => {
      document.body.classList.add("printing-invoice");
      window.print();
      setTimeout(() => document.body.classList.remove("printing-invoice"), 200);
    }, 200);
  };

  // ---- Credit note print
  const openCNPrint = async (cn: any) => {
    let count = cn.reprint_count || 0;
    try { count = await reprintCN.mutateAsync(cn.id); } catch { /* keep count */ }
    setCnPrint({
      creditNoteNumber: cn.credit_note_number,
      invoiceNumber: cn.invoices?.invoice_number || "—",
      customerName: cn.customers?.name || "—",
      customerPin: null, date: cn.created_at, reason: cn.reason,
      items: (cn.credit_note_items || []).map((it: any) => ({
        product_name: it.product_name, quantity: it.quantity,
        unit_price: Number(it.unit_price), total: Number(it.total), is_service: it.is_service,
      })),
      subtotal: Number(cn.subtotal), tax: Number(cn.tax), total: Number(cn.total),
      refundMethod: cn.refund_method, refundAmount: Number(cn.refund_amount),
      isReprint: (cn.reprint_count || 0) > 0, reprintCount: count,
    });
  };

  const onEmail = (inv: any) => {
    if (!inv.customer_email) { toast.error("No email on file for this customer"); return; }
    const subject = encodeURIComponent(`Invoice ${inv.invoice_number}`);
    const body = encodeURIComponent(`Dear ${inv.customer_name},\n\nPlease find your invoice ${inv.invoice_number} for KES ${Number(inv.total).toLocaleString()}.\n\nThank you.`);
    window.open(`mailto:${inv.customer_email}?subject=${subject}&body=${body}`);
  };

  return (
    <div className="flex h-[calc(100vh-6rem)] gap-4">
      {/* LEFT: master list */}
      <div className="flex w-2/5 min-w-[340px] flex-col rounded-xl border bg-card">
        <div className="border-b p-4">
          <h1 className="mb-3 text-xl font-bold font-heading">Invoices</h1>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search invoice, customer, phone, KRA PIN, amount..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 border-b p-3">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                tab === t.key ? "bg-primary text-primary-foreground" : "border bg-background hover:bg-muted"
              }`}
            >
              {t.label} <span className="opacity-70">{counts[t.key]}</span>
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex h-40 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-primary" />
            </div>
          ) : docs.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
              <FileX className="h-8 w-8" />
              <p className="text-sm">No documents found</p>
            </div>
          ) : (
            docs.map((d) => {
              const active = selected?.id === d.id && selected?.type === d.type;
              const canStk = d.type === "invoice" && Number(d.raw.balance) > 0 && (d.raw.status as string) !== "cancelled";
              return (
                <div key={`${d.type}-${d.id}`} className="relative border-b">
                  <button
                    onClick={() => setSelected({ type: d.type, id: d.id })}
                    className={`block w-full p-4 text-left transition-colors ${active ? "bg-primary/5" : "hover:bg-muted/50"} ${canStk ? "pr-12" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 font-semibold text-sm">
                        {d.type === "credit_note" ? <FileText className="h-3.5 w-3.5 text-destructive" /> : <Receipt className="h-3.5 w-3.5 text-muted-foreground" />}
                        {d.number}
                      </span>
                      <Badge className={`text-[10px] capitalize ${statusPill(d.status)}`}>
                        {d.status === "credit_note" ? "Credit Note" : d.status}
                      </Badge>
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{d.customer}</p>
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{format(new Date(d.date), "dd MMM yyyy")}</span>
                      <span className={`text-sm font-semibold ${d.amount < 0 ? "text-destructive" : ""}`}>
                        KES {d.amount.toLocaleString()}
                      </span>
                    </div>
                  </button>
                  {canStk && (
                    <button
                      title="Send M-Pesa STK Push"
                      onClick={(e) => { e.stopPropagation(); openStk(d.raw); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-success text-success-foreground shadow-sm transition hover:scale-110"
                    >
                      <Smartphone className="h-4 w-4" />
                    </button>
                  )}
                </div>
              );
            })

          )}
        </div>
      </div>

      {/* RIGHT: detail preview */}
      <div className="flex-1 overflow-hidden rounded-xl border bg-card">
        {selectedInvoice ? (
          <InvoiceDetailPanel
            invoice={selectedInvoice}
            payments={payments as any}
            isAdmin={isAdmin}
            onPrint={() => openInvoicePrint(selectedInvoice, (selectedInvoice.reprint_count || 0) > 0 || selectedInvoice.etims_status === "signed")}
            onEmail={() => onEmail(selectedInvoice)}
            onCreditNote={() => setCnInvoiceId(selectedInvoice.id)}
            onAllocate={() => setPayFor({ id: selectedInvoice.customer_id, name: selectedInvoice.customer_name || "Customer", balance: Number(selectedInvoice.balance) })}
            onStatement={() => setStatementFor(selectedInvoice)}
            onStk={Number(selectedInvoice.balance) > 0 && (selectedInvoice.status as string) !== "cancelled" ? () => openStk(selectedInvoice) : undefined}
          />
        ) : selectedCN ? (
          <CreditNoteDetailPanel note={selectedCN} onPrint={() => openCNPrint(selectedCN)} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
            <Receipt className="h-12 w-12 opacity-30" />
            <p className="text-sm">Select a document to preview</p>
          </div>
        )}
      </div>

      {/* Invoice print format dialog */}
      <Dialog open={!!printData} onOpenChange={(o) => { if (!o) { setPrintData(null); setPrintFormat(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Choose Print Format</DialogTitle></DialogHeader>
          {printData && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Invoice <span className="font-medium text-foreground">{printData.invoiceNumber}</span> — {printData.customerName}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => doPrint("thermal")} className="flex flex-col items-center gap-2 rounded-lg border-2 border-border p-5 text-center transition-colors hover:border-primary hover:bg-primary/5">
                  <Receipt className="h-8 w-8 text-primary" />
                  <span className="font-semibold text-sm">Thermal Receipt</span>
                  <span className="text-xs text-muted-foreground">80mm roll · quick receipt</span>
                </button>
                <button onClick={() => doPrint("b5")} className="flex flex-col items-center gap-2 rounded-lg border-2 border-border p-5 text-center transition-colors hover:border-primary hover:bg-primary/5">
                  <FileText className="h-8 w-8 text-primary" />
                  <span className="font-semibold text-sm">Full Invoice (B5)</span>
                  <span className="text-xs text-muted-foreground">Invoice + Delivery Note</span>
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {printData && printFormat && (
        <div className="hidden print:block">
          <InvoiceDocumentPrint format={printFormat} {...printData} />
        </div>
      )}

      {/* Credit note print dialog */}
      <Dialog open={!!cnPrint} onOpenChange={(o) => !o && setCnPrint(null)}>
        <DialogContent className="max-w-4xl p-0 max-h-[90vh] overflow-auto">
          {cnPrint && (
            <>
              <CreditNotePrintView {...cnPrint} />
              <div className="sticky bottom-0 flex justify-end gap-2 border-t bg-background p-3">
                <Button variant="outline" onClick={() => setCnPrint(null)}>Close</Button>
                <Button onClick={() => printDocument()}><Printer className="h-4 w-4 mr-1" /> Print</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Customer statement dialog */}
      <Dialog open={!!statementFor} onOpenChange={(o) => !o && setStatementFor(null)}>
        <DialogContent className="max-w-4xl p-0 max-h-[90vh] overflow-auto">
          {statementFor && (
            <>
              <CustomerStatementPrint
                customer={{
                  name: statementFor.customer_name,
                  customer_code: statementFor.customer_code,
                  kra_pin: statementFor.customer_kra_pin,
                  phone: statementFor.customer_phone,
                }}
                invoices={invoices.filter((i) => i.customer_id === statementFor.customer_id)}
                payments={payments.filter((p: any) => p.customer_id === statementFor.customer_id)}
                fromDate={new Date(new Date().setFullYear(new Date().getFullYear() - 1))}
                toDate={new Date()}
              />
              <div className="sticky bottom-0 flex justify-end gap-2 border-t bg-background p-3">
                <Button variant="outline" onClick={() => setStatementFor(null)}>Close</Button>
                <Button onClick={() => printDocument()}><Printer className="h-4 w-4 mr-1" /> Print</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Credit note creation */}
      <CreditNoteDialog open={!!cnInvoiceId} onOpenChange={(o) => !o && setCnInvoiceId(null)} invoiceId={cnInvoiceId} />

      {/* Allocate payment */}
      {payFor && (
        <PaymentDialog
          open={!!payFor}
          onOpenChange={(o) => !o && setPayFor(null)}
          customerId={payFor.id}
          customerName={payFor.name}
          currentBalance={payFor.balance}
        />
      )}

      {/* M-Pesa STK Push */}
      {stkFor && (
        <StkPushDialog
          open={!!stkFor}
          onOpenChange={(o) => !o && setStkFor(null)}
          invoiceId={stkFor.invoiceId}
          invoiceNumber={stkFor.invoiceNumber}
          customerId={stkFor.customerId}
          customerName={stkFor.customerName}
          defaultPhone={stkFor.phone}
          amount={stkFor.amount}
        />
      )}
    </div>
  );
}
