import { format, differenceInDays } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Printer, Mail, Undo2, Wallet, FileText, ShieldCheck, Clock, AlertCircle,
  CheckCircle2, Circle, Receipt, User, Phone, Hash, FileClock, Smartphone,
} from "lucide-react";
import type { InvoiceWithItems } from "@/hooks/useInvoices";
import { posPaymentFromInvoice } from "@/lib/payments";

type PaymentRow = {
  id: string;
  invoice_id: string;
  amount: number;
  cash_amount: number;
  mpesa_amount: number;
  payment_date: string;
  notes?: string | null;
};

const statusColor = (s: string) =>
  s === "paid"
    ? "bg-success/10 text-success border-success/20"
    : s === "partial"
    ? "bg-warning/10 text-warning border-warning/20"
    : s === "overdue"
    ? "bg-destructive/10 text-destructive border-destructive/20"
    : "bg-muted text-muted-foreground border-border";

function etimsBadge(s: string) {
  if (s === "signed")
    return <Badge className="bg-success/10 text-success gap-1"><ShieldCheck className="h-3 w-3" />eTIMS Signed</Badge>;
  if (s === "pending_sync")
    return <Badge className="bg-warning/10 text-warning gap-1"><Clock className="h-3 w-3" />eTIMS Pending</Badge>;
  if (s === "failed")
    return <Badge className="bg-destructive/10 text-destructive gap-1"><AlertCircle className="h-3 w-3" />eTIMS Failed</Badge>;
  return null;
}

function TimelineStep({ done, label, sub }: { done: boolean; label: string; sub?: string }) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        {done ? (
          <CheckCircle2 className="h-4 w-4 text-success" />
        ) : (
          <Circle className="h-4 w-4 text-muted-foreground/40" />
        )}
        <div className="w-px flex-1 bg-border last:hidden" />
      </div>
      <div className="pb-4 -mt-0.5">
        <p className={`text-sm ${done ? "font-medium" : "text-muted-foreground"}`}>{label}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

export function InvoiceDetailPanel({
  invoice,
  payments,
  isAdmin,
  onPrint,
  onEmail,
  onCreditNote,
  onAllocate,
  onStatement,
  onStk,
}: {
  invoice: InvoiceWithItems;
  payments: PaymentRow[];
  isAdmin: boolean;
  onPrint?: () => void;
  onEmail?: () => void;
  onCreditNote?: () => void;
  onAllocate?: () => void;
  onStatement?: () => void;
  onStk?: () => void;
}) {
  const posRow = posPaymentFromInvoice(invoice);
  const invPayments = [
    ...(posRow ? [posRow] : []),
    ...payments.filter((p) => p.invoice_id === invoice.id).map((p) => ({ ...p, source: "allocation" as const })),
  ].sort((a, b) => new Date(a.payment_date).getTime() - new Date(b.payment_date).getTime());

  const bal = Number(invoice.balance);
  const overdue = bal > 0 && differenceInDays(new Date(), new Date(invoice.created_at)) > (invoice.customer_credit_terms || 30);
  const uiStatus = overdue ? "overdue" : invoice.status;

  return (
    <div className="flex h-full flex-col">
      {/* Header + actions */}
      <div className="border-b p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold font-heading">{invoice.invoice_number}</h2>
              <Badge className={`capitalize ${statusColor(uiStatus)}`}>{uiStatus}</Badge>
              {(invoice.reprint_count || 0) > 0 && (
                <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30">
                  REPRINT ×{invoice.reprint_count}
                </Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{invoice.customer_name}</p>
            <div className="mt-2">{etimsBadge(invoice.etims_status)}</div>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {onPrint && <Button size="sm" onClick={onPrint}><Printer className="h-4 w-4 mr-1" /> Print</Button>}
            {onEmail && <Button size="sm" variant="outline" onClick={onEmail}><Mail className="h-4 w-4 mr-1" /> Email</Button>}
            {bal > 0 && onStk && (
              <Button size="sm" className="bg-success hover:bg-success/90 text-success-foreground" onClick={onStk}>
                <Smartphone className="h-4 w-4 mr-1" /> Send STK
              </Button>
            )}
            {bal > 0 && onAllocate && (
              <Button size="sm" variant="outline" onClick={onAllocate}><Wallet className="h-4 w-4 mr-1" /> Allocate</Button>
            )}
            {isAdmin && onCreditNote && (
              <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={onCreditNote}>
                <Undo2 className="h-4 w-4 mr-1" /> Credit Note
              </Button>
            )}
          </div>
        </div>
      </div>


      <div className="flex-1 overflow-auto p-5 space-y-6">
        {/* Customer + meta */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border p-4 space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Bill To</p>
            <p className="flex items-center gap-2 text-sm font-medium"><User className="h-3.5 w-3.5 text-muted-foreground" />{invoice.customer_name}</p>
            {invoice.customer_code && <p className="flex items-center gap-2 text-xs text-muted-foreground"><Hash className="h-3.5 w-3.5" />{invoice.customer_code}</p>}
            {invoice.customer_phone && <p className="flex items-center gap-2 text-xs text-muted-foreground"><Phone className="h-3.5 w-3.5" />{invoice.customer_phone}</p>}
            {invoice.customer_kra_pin && <p className="flex items-center gap-2 text-xs text-muted-foreground font-mono"><Receipt className="h-3.5 w-3.5" />{invoice.customer_kra_pin}</p>}
          </div>
          <div className="rounded-lg border p-4 space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Invoice Date</span><span>{format(new Date(invoice.created_at), "dd MMM yyyy")}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Payment</span><span className="capitalize">{invoice.payment_method.replace("_", " ")}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Paid</span><span>KES {Number(invoice.paid_amount).toLocaleString()}</span></div>
            <div className="flex justify-between font-medium"><span className="text-muted-foreground">Balance</span><span className={bal > 0 ? "text-destructive" : "text-success"}>KES {bal.toLocaleString()}</span></div>
          </div>
        </div>

        {/* Items */}
        <div>
          <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase">Items</p>
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Description</th>
                  <th className="px-3 py-2 text-right w-14">Qty</th>
                  <th className="px-3 py-2 text-right w-24">Price</th>
                  <th className="px-3 py-2 text-right w-28">Total</th>
                </tr>
              </thead>
              <tbody>
                {invoice.invoice_items.map((it: any) => (
                  <tr key={it.id} className="border-t">
                    <td className="px-3 py-2">{it.products?.name || "Item"}</td>
                    <td className="px-3 py-2 text-right">{it.quantity}</td>
                    <td className="px-3 py-2 text-right font-mono">{Number(it.unit_price).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-mono">{Number(it.total).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex justify-end">
            <div className="w-56 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-mono">KES {Number(invoice.subtotal).toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">VAT</span><span className="font-mono">KES {Number(invoice.tax).toLocaleString()}</span></div>
              <div className="flex justify-between border-t pt-1 font-bold"><span>Total</span><span className="font-mono">KES {Number(invoice.total).toLocaleString()}</span></div>
            </div>
          </div>
        </div>

        {/* Payments */}
        <div>
          <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase">Payments ({invPayments.length})</p>
          {invPayments.length === 0 ? (
            <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">No payments recorded</p>
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-left">Source</th>
                    <th className="px-3 py-2 text-right">Cash</th>
                    <th className="px-3 py-2 text-right">M-Pesa</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {invPayments.map((p: any) => (
                    <tr key={p.id} className="border-t">
                      <td className="px-3 py-2">{format(new Date(p.payment_date), "dd MMM yyyy HH:mm")}</td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className="text-[10px]">
                          {p.source === "pos" ? "At sale" : "Debt payment"}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right font-mono">{Number(p.cash_amount).toLocaleString()}</td>
                      <td className="px-3 py-2 text-right font-mono">{Number(p.mpesa_amount).toLocaleString()}</td>
                      <td className="px-3 py-2 text-right font-mono font-medium">KES {Number(p.amount).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>

              </table>
            </div>
          )}
        </div>

        {/* Timeline */}
        <div>
          <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase">Timeline</p>
          <div className="rounded-lg border p-4">
            <TimelineStep done label="Invoice created" sub={format(new Date(invoice.created_at), "dd MMM yyyy HH:mm")} />
            <TimelineStep done={(invoice.reprint_count || 0) > 0} label="Printed / reprinted" sub={invoice.last_reprinted_at ? format(new Date(invoice.last_reprinted_at), "dd MMM yyyy HH:mm") : undefined} />
            <TimelineStep done={invPayments.length > 0} label="Payment received" sub={invPayments.length > 0 ? `${invPayments.length} payment(s)` : undefined} />
            <TimelineStep done={invoice.status === "paid"} label="Fully paid" />
          </div>
        </div>

        {/* Statement */}
        {onStatement && (
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={onStatement}>
              <FileClock className="h-4 w-4 mr-1" /> Generate Customer Statement
            </Button>
          </div>
        )}

      </div>
    </div>
  );
}

export function CreditNoteDetailPanel({
  note,
  onPrint,
}: {
  note: any;
  onPrint?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold font-heading">{note.credit_note_number}</h2>
              <Badge className="bg-destructive/10 text-destructive border-destructive/20">Credit Note</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{note.customers?.name || "—"}</p>
            {note.invoices?.invoice_number && (
              <p className="mt-1 text-xs text-muted-foreground">Against invoice {note.invoices.invoice_number}</p>
            )}
          </div>
          {onPrint && <Button size="sm" onClick={onPrint}><Printer className="h-4 w-4 mr-1" /> Print</Button>}

        </div>
      </div>

      <div className="flex-1 overflow-auto p-5 space-y-6">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="rounded-lg border p-4 space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Reason</p>
            <p>{note.reason || "—"}</p>
          </div>
          <div className="rounded-lg border p-4 space-y-1.5">
            <div className="flex justify-between"><span className="text-muted-foreground">Date</span><span>{format(new Date(note.created_at), "dd MMM yyyy")}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Settlement</span><span className="capitalize">{String(note.refund_method).replace("_", " ")}</span></div>
            <div className="flex justify-between font-medium"><span className="text-muted-foreground">Total</span><span>KES {Number(note.total).toLocaleString()}</span></div>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase">Returned Items</p>
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Description</th>
                  <th className="px-3 py-2 text-right w-14">Qty</th>
                  <th className="px-3 py-2 text-right w-24">Price</th>
                  <th className="px-3 py-2 text-right w-28">Total</th>
                </tr>
              </thead>
              <tbody>
                {(note.credit_note_items || []).map((it: any) => (
                  <tr key={it.id} className="border-t">
                    <td className="px-3 py-2">{it.product_name}</td>
                    <td className="px-3 py-2 text-right">{it.quantity}</td>
                    <td className="px-3 py-2 text-right font-mono">{Number(it.unit_price).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-mono">{Number(it.total).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border bg-muted/30 p-4 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground mb-1">Accounting impact</p>
          <p>DR Sales Returns · DR Output VAT · CR Accounts Receivable</p>
        </div>
      </div>
    </div>
  );
}
