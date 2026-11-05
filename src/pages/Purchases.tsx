import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { usePurchases } from "@/hooks/usePurchases";
import { usePurchaseOrders, useSavePurchaseOrder, useConvertPOToInvoice, useCancelPO, type POLine } from "@/hooks/usePurchaseOrders";
import { useSuppliers } from "@/hooks/useSuppliers";
import { usePurchaseKpis } from "@/hooks/usePurchaseWorkspace";
import { PurchaseDetailPanel } from "@/components/PurchaseDetailPanel";
import { PurchaseProductPicker } from "@/components/PurchaseProductPicker";
import { MonthlyReceiptsDialog } from "@/components/MonthlyReceiptsDialog";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Plus, FileBox, FileText, ShoppingCart, Calendar, Trash2, Send, FileX } from "lucide-react";
import { format, isBefore } from "date-fns";
import { toast } from "sonner";

type Tab = "all" | "invoices" | "orders" | "draft" | "posted" | "overdue";
const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "invoices", label: "Invoices" },
  { key: "orders", label: "Orders" },
  { key: "draft", label: "Drafts" },
  { key: "posted", label: "Posted" },
  { key: "overdue", label: "Overdue" },
];

const emptyPO: POLine = { product_id: null, description: "", quantity: 1, unit_cost: 0, vat_rate: 16 };

export default function Purchases() {
  const nav = useNavigate();
  const { data: purchases = [], isLoading } = usePurchases();
  const { data: pos = [] } = usePurchaseOrders();
  const { data: suppliers = [] } = useSuppliers();
  const { data: kpis } = usePurchaseKpis();
  const savePO = useSavePurchaseOrder();
  const convert = useConvertPOToInvoice();
  const cancelPO = useCancelPO();

  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [selected, setSelected] = useState<{ type: "invoice" | "po"; id: string } | null>(null);
  const [monthlyOpen, setMonthlyOpen] = useState(false);

  // PO dialog
  const [poOpen, setPoOpen] = useState(false);
  const [poEditId, setPoEditId] = useState<string | undefined>();
  const [poSupplier, setPoSupplier] = useState("");
  const [poOrderDate, setPoOrderDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [poExpected, setPoExpected] = useState("");
  const [poRef, setPoRef] = useState("");
  const [poLines, setPoLines] = useState<POLine[]>([{ ...emptyPO }]);

  const isOverdue = (p: any) => p.status === "posted" && p.payment_mode === "credit" && p.due_date && isBefore(new Date(p.due_date), new Date());

  const docs = useMemo(() => {
    const term = search.trim().toLowerCase();
    const matchInv = (p: any) => !term || [p.invoice_number, p.purchase_code, p.suppliers?.name, p.suppliers?.kra_pin, String(p.total)].some((f) => f && String(f).toLowerCase().includes(term));
    const matchPO = (po: any) => !term || [po.po_number, po.suppliers?.name, String(po.total)].some((f) => f && String(f).toLowerCase().includes(term));

    const invDocs = purchases.filter(matchInv).map((p: any) => ({
      type: "invoice" as const, id: p.id, number: p.invoice_number || p.purchase_code,
      supplier: p.suppliers?.name || "—", date: p.invoice_date || p.purchase_date,
      amount: Number(p.total), status: isOverdue(p) ? "overdue" : p.status, raw: p,
    }));
    const poDocs = pos.filter(matchPO).map((po: any) => ({
      type: "po" as const, id: po.id, number: po.po_number,
      supplier: po.suppliers?.name || "—", date: po.order_date,
      amount: Number(po.total), status: po.status, raw: po,
    }));

    let all = [...invDocs, ...poDocs];
    if (tab === "invoices") all = invDocs;
    else if (tab === "orders") all = poDocs;
    else if (tab === "draft") all = invDocs.filter((d) => d.raw.status === "draft");
    else if (tab === "posted") all = invDocs.filter((d) => d.raw.status === "posted");
    else if (tab === "overdue") all = invDocs.filter((d) => d.status === "overdue");
    return all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [purchases, pos, search, tab]);

  const counts = useMemo(() => ({
    all: purchases.length + pos.length,
    invoices: purchases.length,
    orders: pos.length,
    draft: purchases.filter((p: any) => p.status === "draft").length,
    posted: purchases.filter((p: any) => p.status === "posted").length,
    overdue: purchases.filter(isOverdue).length,
  }), [purchases, pos]);

  const statusPill = (s: string) =>
    s === "posted" ? "bg-success/10 text-success"
    : s === "overdue" ? "bg-destructive/10 text-destructive"
    : s === "cancelled" ? "bg-destructive/10 text-destructive"
    : s === "invoiced" ? "bg-primary/10 text-primary"
    : s === "issued" ? "bg-primary/10 text-primary"
    : "bg-warning/10 text-warning";

  // PO dialog helpers
  const openNewPO = () => {
    setPoEditId(undefined); setPoSupplier(""); setPoOrderDate(format(new Date(), "yyyy-MM-dd"));
    setPoExpected(""); setPoRef(""); setPoLines([{ ...emptyPO }]); setPoOpen(true);
  };
  const openEditPO = (po: any) => {
    setPoEditId(po.id); setPoSupplier(po.supplier_id); setPoOrderDate(po.order_date);
    setPoExpected(po.expected_date || ""); setPoRef(po.reference || "");
    setPoLines((po.purchase_order_items || []).map((it: any) => ({
      product_id: it.product_id, description: it.description || "",
      quantity: it.quantity, unit_cost: Number(it.unit_cost), vat_rate: Number(it.vat_rate || 0),
    })));
    setPoOpen(true);
  };
  const poTotals = useMemo(() => {
    let s = 0, v = 0;
    for (const l of poLines) { const n = l.quantity * l.unit_cost; s += n; v += n * (l.vat_rate || 0) / 100; }
    return { subtotal: s, vat: v, total: s + v };
  }, [poLines]);
  const submitPO = async (status: "draft" | "issued") => {
    if (!poSupplier) return toast.error("Pick supplier");
    const valid = poLines.filter((l) => l.product_id && l.quantity > 0);
    if (!valid.length) return toast.error("Add at least one line");
    try {
      await savePO.mutateAsync({ id: poEditId, supplier_id: poSupplier, order_date: poOrderDate, expected_date: poExpected || null, reference: poRef, status, items: valid });
      toast.success(status === "draft" ? "PO draft saved" : "PO issued");
      setPoOpen(false);
    } catch (e: any) { toast.error(e.message); }
  };
  const onConvert = async (id: string) => {
    try { const pid = await convert.mutateAsync(id); toast.success("Converted to draft invoice"); nav(`/purchases/${pid}/edit`); }
    catch (e: any) { toast.error(e.message); }
  };

  const selectedPO = selected?.type === "po" ? pos.find((x: any) => x.id === selected.id) : null;

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Purchases This Month" value={`KES ${(kpis?.monthTotal || 0).toLocaleString()}`} icon={<ShoppingCart className="h-4 w-4" />} />
        <Kpi label="Input VAT Claimable" value={`KES ${(kpis?.vatClaimable || 0).toLocaleString()}`} icon={<FileText className="h-4 w-4" />} />
        <Kpi label="Outstanding Supplier Debt" value={`KES ${(kpis?.outstanding || 0).toLocaleString()}`} icon={<FileBox className="h-4 w-4" />} />
        <Kpi label="Overdue Invoices" value={`KES ${(kpis?.overdue || 0).toLocaleString()}`} danger icon={<Calendar className="h-4 w-4" />} />
      </div>

      <div className="flex h-[calc(100vh-14rem)] gap-4">
        {/* LEFT master list */}
        <div className="flex w-2/5 min-w-[340px] flex-col rounded-xl border bg-card">
          <div className="border-b p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h1 className="text-xl font-bold font-heading">Purchases</h1>
              <div className="flex gap-1.5">
                <Button size="sm" variant="outline" onClick={() => setMonthlyOpen(true)}><Calendar className="h-3.5 w-3.5" /></Button>
                <Button size="sm" variant="outline" onClick={openNewPO}><FileBox className="h-3.5 w-3.5 mr-1" /> PO</Button>
                <Link to="/purchases/new"><Button size="sm"><Plus className="h-3.5 w-3.5 mr-1" /> Invoice</Button></Link>
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search PO/invoice, supplier, KRA PIN, amount..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 border-b p-3">
            {TABS.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${tab === t.key ? "bg-primary text-primary-foreground" : "border bg-background hover:bg-muted"}`}>
                {t.label} <span className="opacity-70">{counts[t.key]}</span>
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-auto">
            {isLoading ? (
              <div className="flex h-40 items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-b-2 border-primary" /></div>
            ) : docs.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground"><FileX className="h-8 w-8" /><p className="text-sm">No documents found</p></div>
            ) : docs.map((d) => {
              const active = selected?.id === d.id && selected?.type === d.type;
              return (
                <button key={`${d.type}-${d.id}`} onClick={() => setSelected({ type: d.type, id: d.id })}
                  className={`block w-full border-b p-4 text-left transition-colors ${active ? "bg-primary/5" : "hover:bg-muted/50"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-sm font-semibold">
                      {d.type === "po" ? <FileBox className="h-3.5 w-3.5 text-muted-foreground" /> : <FileText className="h-3.5 w-3.5 text-muted-foreground" />}
                      {d.number}
                    </span>
                    <Badge className={`text-[10px] capitalize ${statusPill(d.status)}`}>{d.type === "po" ? `PO · ${d.status}` : d.status}</Badge>
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{d.supplier}</p>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{format(new Date(d.date), "dd MMM yyyy")}</span>
                    <span className="text-sm font-semibold">KES {d.amount.toLocaleString()}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* RIGHT detail */}
        <div className="flex-1 overflow-hidden rounded-xl border bg-card">
          {selected?.type === "invoice" ? (
            <PurchaseDetailPanel id={selected.id} />
          ) : selectedPO ? (
            <div className="flex h-full flex-col">
              <div className="border-b p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="flex items-center gap-2 text-lg font-bold font-heading"><FileBox className="h-4 w-4 text-muted-foreground" />{selectedPO.po_number}</h2>
                    <p className="text-sm text-muted-foreground">{selectedPO.suppliers?.name}</p>
                  </div>
                  <Badge className={`capitalize ${statusPill(selectedPO.status)}`}>{selectedPO.status}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(selectedPO.status === "draft" || selectedPO.status === "issued") && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => openEditPO(selectedPO)}>Edit</Button>
                      <Button size="sm" onClick={() => onConvert(selectedPO.id)}><Send className="h-3.5 w-3.5 mr-1" /> To Invoice</Button>
                    </>
                  )}
                  {selectedPO.status !== "cancelled" && selectedPO.status !== "invoiced" && (
                    <Button size="sm" variant="ghost" onClick={() => cancelPO.mutate(selectedPO.id)}>Cancel</Button>
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-auto p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-xs text-muted-foreground">Order Date</p><p className="font-medium">{format(new Date(selectedPO.order_date), "dd MMM yyyy")}</p></div>
                  <div><p className="text-xs text-muted-foreground">Expected</p><p className="font-medium">{selectedPO.expected_date ? format(new Date(selectedPO.expected_date), "dd MMM yyyy") : "—"}</p></div>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase"><tr><th className="p-2 text-left">Item</th><th className="p-2 text-right">Qty</th><th className="p-2 text-right">Cost</th><th className="p-2 text-right">Total</th></tr></thead>
                  <tbody>
                    {(selectedPO.purchase_order_items || []).map((it: any) => (
                      <tr key={it.id} className="border-t"><td className="p-2">{it.products?.name || it.description}</td><td className="p-2 text-right">{it.quantity}</td><td className="p-2 text-right">{Number(it.unit_cost).toLocaleString()}</td><td className="p-2 text-right font-medium">{Number(it.line_total).toLocaleString()}</td></tr>
                    ))}
                  </tbody>
                </table>
                <div className="rounded-lg border p-3 text-sm flex justify-between font-bold"><span>Total</span><span className="text-primary">KES {Number(selectedPO.total).toLocaleString()}</span></div>
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
              <ShoppingCart className="h-12 w-12 opacity-30" /><p className="text-sm">Select a purchase to preview</p>
            </div>
          )}
        </div>
      </div>

      {/* PO create/edit dialog */}
      <Dialog open={poOpen} onOpenChange={setPoOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle>{poEditId ? "Edit" : "New"} Purchase Order</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label>Supplier *</Label>
                <Select value={poSupplier} onValueChange={setPoSupplier}>
                  <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                  <SelectContent>{suppliers.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Order Date</Label><Input type="date" value={poOrderDate} onChange={(e) => setPoOrderDate(e.target.value)} /></div>
              <div><Label>Expected Delivery</Label><Input type="date" value={poExpected} onChange={(e) => setPoExpected(e.target.value)} /></div>
              <div className="md:col-span-3"><Label>Reference</Label><Input value={poRef} onChange={(e) => setPoRef(e.target.value)} /></div>
            </div>
            <div className="rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase"><tr><th className="p-2 text-left">Product</th><th className="p-2 text-right w-20">Qty</th><th className="p-2 text-right w-28">Cost</th><th className="p-2 text-right w-20">VAT %</th><th className="p-2 text-right w-28">Total</th><th className="w-10"></th></tr></thead>
                <tbody>
                  {poLines.map((l, i) => {
                    const t = l.quantity * l.unit_cost * (1 + (l.vat_rate || 0) / 100);
                    return (
                      <tr key={i} className="border-t">
                        <td className="p-2"><PurchaseProductPicker value={l.product_id || undefined} onSelect={(p) => setPoLines((prev) => prev.map((x, idx) => idx === i ? { ...x, product_id: p.id, unit_cost: p.last_cost != null ? Number(p.last_cost) : x.unit_cost } : x))} /></td>
                        <td className="p-2"><Input type="number" min={1} value={l.quantity} className="h-9 text-right" onChange={(e) => setPoLines((prev) => prev.map((x, idx) => idx === i ? { ...x, quantity: Number(e.target.value) } : x))} /></td>
                        <td className="p-2"><Input type="number" min={0} value={l.unit_cost} className="h-9 text-right" onChange={(e) => setPoLines((prev) => prev.map((x, idx) => idx === i ? { ...x, unit_cost: Number(e.target.value) } : x))} /></td>
                        <td className="p-2"><Input type="number" min={0} max={100} value={l.vat_rate} className="h-9 text-right" onChange={(e) => setPoLines((prev) => prev.map((x, idx) => idx === i ? { ...x, vat_rate: Number(e.target.value) } : x))} /></td>
                        <td className="p-2 text-right">{t.toLocaleString()}</td>
                        <td className="p-2"><Button size="icon" variant="ghost" onClick={() => setPoLines((prev) => prev.filter((_, idx) => idx !== i))}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="p-2 border-t"><Button variant="outline" size="sm" onClick={() => setPoLines((prev) => [...prev, { ...emptyPO }])}><Plus className="h-3.5 w-3.5 mr-1" /> Add Row</Button></div>
            </div>
            <div className="flex justify-between items-end">
              <div className="text-sm space-y-1">
                <p className="text-muted-foreground">Subtotal: KES {poTotals.subtotal.toLocaleString()}</p>
                <p className="text-muted-foreground">VAT: KES {poTotals.vat.toLocaleString()}</p>
                <p className="font-bold text-base">Total: KES {poTotals.total.toLocaleString()}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => submitPO("draft")} disabled={savePO.isPending}>Save Draft</Button>
                <Button onClick={() => submitPO("issued")} disabled={savePO.isPending}><Send className="h-4 w-4 mr-1" /> Issue PO</Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <MonthlyReceiptsDialog open={monthlyOpen} onOpenChange={setMonthlyOpen} />
    </div>
  );
}

function Kpi({ label, value, icon, danger }: { label: string; value: string; icon: React.ReactNode; danger?: boolean }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between text-muted-foreground"><span className="text-xs">{label}</span>{icon}</div>
        <p className={`mt-1 text-lg font-bold ${danger ? "text-destructive" : ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
