import { useState } from "react";
import { Link } from "react-router-dom";
import { usePurchase, usePurchaseReceipts, getReceiptSignedUrl, usePostPurchase } from "@/hooks/usePurchases";
import { usePurchaseBatches } from "@/hooks/usePurchaseWorkspace";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FileText, Pencil, Send, Boxes, Paperclip, BookOpen, Download, Package } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const statusPill = (s: string) =>
  s === "posted" ? "bg-success/10 text-success"
  : s === "cancelled" ? "bg-destructive/10 text-destructive"
  : "bg-warning/10 text-warning";

export function PurchaseDetailPanel({ id }: { id: string }) {
  const { data: p, isLoading } = usePurchase(id);
  const { data: receipts = [] } = usePurchaseReceipts(id);
  const post = usePostPurchase();

  const batchDate = p?.invoice_date || p?.purchase_date;
  const { data: batches = [] } = usePurchaseBatches(
    p?.status === "posted" ? p?.supplier_id : undefined,
    p?.status === "posted" ? batchDate : undefined
  );

  if (isLoading || !p) {
    return <div className="flex h-full items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-b-2 border-primary" /></div>;
  }

  const items = p.purchase_items || [];
  const isCredit = p.payment_mode === "credit";
  const onPost = async () => {
    try { await post.mutateAsync(id); toast.success("Posted — stock updated & GL entries created"); }
    catch (e: any) { toast.error(e.message); }
  };
  const openReceipt = async (path: string) => {
    try { window.open(await getReceiptSignedUrl(path), "_blank"); } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold font-heading">
              <FileText className="h-4 w-4 text-muted-foreground" />
              {p.invoice_number || p.purchase_code}
            </h2>
            <p className="text-sm text-muted-foreground">{p.suppliers?.name}</p>
          </div>
          <Badge className={`capitalize ${statusPill(p.status)}`}>{p.status}</Badge>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {p.status === "draft" && (
            <>
              <Link to={`/purchases/${p.id}/edit`}><Button size="sm" variant="outline"><Pencil className="h-3.5 w-3.5 mr-1" /> Edit</Button></Link>
              <Button size="sm" onClick={onPost} disabled={post.isPending}><Send className="h-3.5 w-3.5 mr-1" /> Post Purchase</Button>
            </>
          )}
        </div>
      </div>

      <Tabs defaultValue="overview" className="flex flex-1 flex-col overflow-hidden">
        <TabsList className="mx-4 mt-3 flex w-auto flex-wrap justify-start">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="items">Items</TabsTrigger>
          <TabsTrigger value="batches"><Boxes className="h-3.5 w-3.5 mr-1" /> Batches</TabsTrigger>
          <TabsTrigger value="gl"><BookOpen className="h-3.5 w-3.5 mr-1" /> GL</TabsTrigger>
          <TabsTrigger value="attachments"><Paperclip className="h-3.5 w-3.5 mr-1" /> Files</TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-auto p-4">
          <TabsContent value="overview" className="mt-0 space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Info label="Supplier Invoice #" value={p.invoice_number || "—"} />
              <Info label="Internal Code" value={p.purchase_code} />
              <Info label="Invoice Date" value={format(new Date(p.invoice_date || p.purchase_date), "dd MMM yyyy")} />
              <Info label="Due Date" value={p.due_date ? format(new Date(p.due_date), "dd MMM yyyy") : "—"} />
              <Info label="Payment Mode" value={String(p.payment_mode).toUpperCase()} />
              <Info label="Terms" value={`${p.payment_terms_days ?? 0} days`} />
              {p.reference && <Info label="Reference / GRN" value={p.reference} />}
            </div>
            <div className="rounded-lg border p-3 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>KES {Number(p.subtotal).toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Input VAT</span><span>KES {Number(p.vat_total).toLocaleString()}</span></div>
              {Number(p.wht_total) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Withholding Tax</span><span className="text-destructive">- KES {Number(p.wht_total).toLocaleString()}</span></div>}
              <div className="flex justify-between border-t pt-1 font-bold"><span>Total</span><span className="text-primary">KES {Number(p.total).toLocaleString()}</span></div>
            </div>
            {p.notes && <div className="rounded-lg border p-3 text-sm"><p className="text-xs uppercase text-muted-foreground mb-1">Notes</p>{p.notes}</div>}
          </TabsContent>

          <TabsContent value="items" className="mt-0">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase"><tr>
                <th className="p-2 text-left">Item</th><th className="p-2 text-right">Qty</th>
                <th className="p-2 text-right">Cost</th><th className="p-2 text-right">VAT</th><th className="p-2 text-right">Total</th>
              </tr></thead>
              <tbody>
                {items.map((it: any) => (
                  <tr key={it.id} className="border-t">
                    <td className="p-2">{it.products?.name || it.description || "Item"}</td>
                    <td className="p-2 text-right">{it.quantity}</td>
                    <td className="p-2 text-right">{Number(it.unit_cost).toLocaleString()}</td>
                    <td className="p-2 text-right">{Number(it.vat_rate)}%</td>
                    <td className="p-2 text-right font-medium">{Number(it.total).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabsContent>

          <TabsContent value="batches" className="mt-0">
            {p.status !== "posted" ? (
              <p className="text-sm text-muted-foreground">FIFO batches are created when the purchase is posted.</p>
            ) : batches.length === 0 ? (
              <p className="text-sm text-muted-foreground">No stock batches found for this purchase.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase"><tr>
                  <th className="p-2 text-left">Product</th><th className="p-2 text-right">Qty In</th>
                  <th className="p-2 text-right">Remaining</th><th className="p-2 text-right">Cost</th>
                </tr></thead>
                <tbody>
                  {batches.map((b: any) => (
                    <tr key={b.id} className="border-t">
                      <td className="p-2 flex items-center gap-1"><Package className="h-3.5 w-3.5 text-muted-foreground" />{b.products?.name}</td>
                      <td className="p-2 text-right text-success">+{b.quantity_bought}</td>
                      <td className="p-2 text-right">{b.quantity_remaining}</td>
                      <td className="p-2 text-right">{Number(b.cost_price).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </TabsContent>

          <TabsContent value="gl" className="mt-0">
            <p className="text-xs uppercase text-muted-foreground mb-2">Automatic Accounting Entries</p>
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase"><tr>
                <th className="p-2 text-left">Account</th><th className="p-2 text-right">Debit</th><th className="p-2 text-right">Credit</th>
              </tr></thead>
              <tbody>
                <tr className="border-t"><td className="p-2">Inventory / Purchases</td><td className="p-2 text-right">{Number(p.subtotal).toLocaleString()}</td><td className="p-2 text-right">—</td></tr>
                <tr className="border-t"><td className="p-2">Input VAT</td><td className="p-2 text-right">{Number(p.vat_total).toLocaleString()}</td><td className="p-2 text-right">—</td></tr>
                <tr className="border-t"><td className="p-2">{isCredit ? "Accounts Payable" : p.payment_mode === "cash" ? "Cash" : p.payment_mode === "mpesa" ? "M-Pesa" : "Bank"}</td><td className="p-2 text-right">—</td><td className="p-2 text-right">{Number(p.total).toLocaleString()}</td></tr>
              </tbody>
            </table>
            {p.status !== "posted" && <p className="mt-2 text-xs text-muted-foreground">Entries post to the General Ledger once this purchase is posted.</p>}
          </TabsContent>

          <TabsContent value="attachments" className="mt-0 space-y-2">
            {receipts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No attachments.</p>
            ) : receipts.map((r: any) => (
              <button key={r.id} onClick={() => openReceipt(r.file_path)} className="flex w-full items-center justify-between rounded-md border p-2 text-sm hover:bg-muted/50">
                <span className="flex items-center gap-2 truncate"><Paperclip className="h-3.5 w-3.5" />{r.file_name}</span>
                <Download className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            ))}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
