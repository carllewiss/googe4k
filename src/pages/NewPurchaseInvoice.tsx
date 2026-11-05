import { useState, useMemo, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useSuppliers, useCreateSupplier } from "@/hooks/useSuppliers";
import { useSavePurchase, usePurchase, usePostPurchase, usePaySupplier, type PurchaseLineType, type VatTreatment } from "@/hooks/usePurchases";
import { useSupplierBalances, useSupplierRecentPurchases } from "@/hooks/usePurchaseWorkspace";
import { useAccounts } from "@/hooks/useAccounting";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Trash2, Plus, Save, Send, Building2 } from "lucide-react";
import { PurchaseItemSearch, TypeBadge, ASSET_CATEGORIES, type PickedItem } from "@/components/PurchaseItemSearch";
import { PurchaseReceiptsUpload } from "@/components/PurchaseReceiptsUpload";
import { format, addDays } from "date-fns";
import { toast } from "sonner";

type Line = {
  line_type: PurchaseLineType;
  product_id?: string | null;
  name: string;
  description: string;
  quantity: number;
  unit_cost: number;
  vat_treatment: VatTreatment;
  vat_rate: number;
  expense_account_id?: string | null;
  asset_category?: string | null;
  asset_useful_life?: number | null;
  warehouse?: string | null;
};

const VAT_LABEL: Record<VatTreatment, string> = {
  standard: "Standard 16%",
  zero_rated: "Zero rated 0%",
  exempt: "Exempt 0%",
  custom: "Custom %",
};

const rateFor = (t: VatTreatment, custom: number) =>
  t === "standard" ? 16 : t === "custom" ? custom : 0;

const PAYMENT_ACCOUNTS = [
  { code: "1000", label: "Cash on Hand" },
  { code: "1050", label: "Petty Cash" },
  { code: "1010", label: "Bank - KCB" },
  { code: "1020", label: "Bank - Equity" },
  { code: "1030", label: "M-Pesa Till" },
  { code: "1040", label: "M-Pesa Paybill" },
];

const CHARGE_TYPES = [
  { key: "none", label: "No charge" },
  { key: "mpesa_fee", label: "M-Pesa fee" },
  { key: "bank_charge", label: "Bank charge" },
  { key: "transfer_fee", label: "Transfer fee" },
  { key: "cheque_fee", label: "Cheque fee" },
  { key: "other", label: "Other charge" },
] as const;

export default function NewPurchaseInvoice() {
  const { id } = useParams();
  const nav = useNavigate();
  const { data: suppliers = [] } = useSuppliers();
  const { data: balances = {} } = useSupplierBalances();
  const { data: accounts = [] } = useAccounts();
  const createSupplier = useCreateSupplier();
  const savePurchase = useSavePurchase();
  const postPurchase = usePostPurchase();
  const paySupplier = usePaySupplier();
  const { data: existing } = usePurchase(id);

  const [supplierId, setSupplierId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [warehouse, setWarehouse] = useState("main");
  const [paymentTerms, setPaymentTerms] = useState(30);
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [withholdTax, setWithholdTax] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [supOpen, setSupOpen] = useState(false);
  const [newSup, setNewSup] = useState({ name: "", phone: "", kra_pin: "" });
  const [savedId, setSavedId] = useState<string | null>(null);

  // settlement
  const [payNow, setPayNow] = useState(false);
  const [payMethod, setPayMethod] = useState<"cash" | "mpesa" | "bank" | "cheque" | "other">("mpesa");
  const [payAccount, setPayAccount] = useState("1030");
  const [payAmount, setPayAmount] = useState<number | "">("");
  const [payRef, setPayRef] = useState("");
  const [chargeType, setChargeType] = useState<(typeof CHARGE_TYPES)[number]["key"]>("none");
  const [chargeAmount, setChargeAmount] = useState(0);

  const { data: recent = [] } = useSupplierRecentPurchases(supplierId || undefined);
  const expenseAccounts = (accounts as any[]).filter((a) => a.type === "expense");

  useEffect(() => {
    if (existing) {
      setSupplierId(existing.supplier_id);
      setInvoiceNumber(existing.invoice_number || "");
      setInvoiceDate(existing.invoice_date || existing.purchase_date);
      setWarehouse(existing.warehouse || "main");
      setPaymentTerms(existing.payment_terms_days ?? 30);
      setReference(existing.reference || "");
      setNotes(existing.notes || "");
      setWithholdTax(Number(existing.wht_total || 0) > 0);
      setLines((existing.purchase_items || []).map((it: any) => ({
        line_type: (it.line_type || "stock") as PurchaseLineType,
        product_id: it.product_id,
        name: it.products?.name || it.description || "",
        description: it.description || "",
        quantity: it.quantity,
        unit_cost: Number(it.unit_cost),
        vat_treatment: (it.vat_treatment || "standard") as VatTreatment,
        vat_rate: Number(it.vat_rate || 0),
        expense_account_id: it.expense_account_id,
        asset_category: it.asset_category,
        asset_useful_life: it.asset_useful_life,
        warehouse: it.warehouse,
      })));
      setSavedId(existing.id);
    }
  }, [existing]);

  const dueDate = useMemo(
    () => format(addDays(new Date(invoiceDate), paymentTerms || 0), "yyyy-MM-dd"),
    [invoiceDate, paymentTerms]
  );

  const totals = useMemo(() => {
    let subtotal = 0, vat = 0;
    const byTreatment: Record<string, { net: number; vat: number }> = {};
    const byType: Record<string, number> = {};
    for (const l of lines) {
      const net = (Number(l.quantity) || 0) * (Number(l.unit_cost) || 0);
      const v = (net * (Number(l.vat_rate) || 0)) / 100;
      subtotal += net; vat += v;
      const k = l.vat_treatment;
      byTreatment[k] = { net: (byTreatment[k]?.net || 0) + net, vat: (byTreatment[k]?.vat || 0) + v };
      byType[l.line_type] = (byType[l.line_type] || 0) + net + v;
    }
    const wht = withholdTax ? subtotal * 0.02 : 0;
    return { subtotal, vat, wht, payable: subtotal + vat - wht, byTreatment, byType };
  }, [lines, withholdTax]);

  const supplierBalance = supplierId ? (balances as any)[supplierId] || 0 : 0;

  const updateLine = (i: number, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const removeLine = (i: number) => setLines((prev) => prev.filter((_, idx) => idx !== i));

  const addFromSearch = (p: PickedItem) => {
    const treatment: VatTreatment = p.vat_rate === 16 ? "standard" : p.vat_rate === 0 ? "zero_rated" : "custom";
    setLines((prev) => [...prev, {
      line_type: p.line_type,
      product_id: p.product_id ?? null,
      name: p.label,
      description: p.description || p.label,
      quantity: 1,
      unit_cost: p.unit_cost ?? 0,
      vat_treatment: treatment,
      vat_rate: p.vat_rate ?? 16,
      expense_account_id: p.expense_account_id ?? null,
      asset_category: p.asset_category ?? null,
      asset_useful_life: p.line_type === "asset" ? 4 : null,
      warehouse: p.line_type === "stock" ? warehouse : null,
    }]);
  };

  const validLines = lines.filter((l) => {
    if (!(l.quantity > 0) || l.unit_cost < 0) return false;
    if (l.line_type === "stock" || l.line_type === "service") return !!l.product_id;
    if (l.line_type === "expense") return !!l.expense_account_id;
    if (l.line_type === "asset") return !!l.asset_category && !!l.description.trim();
    return false;
  });

  const save = async (mode: "draft" | "post" | "new" = "draft") => {
    if (!supplierId) { toast.error("Pick a supplier"); return null; }
    if (!validLines.length) { toast.error("Add at least one complete line"); return null; }
    if (payNow && mode === "post") {
      const amt = Number(payAmount || totals.payable);
      if (!(amt > 0)) { toast.error("Enter the amount paid"); return null; }
    }
    try {
      const newId = await savePurchase.mutateAsync({
        id: savedId || id,
        supplier_id: supplierId,
        invoice_number: invoiceNumber || undefined,
        invoice_date: invoiceDate,
        due_date: dueDate,
        payment_terms_days: paymentTerms,
        payment_mode: "credit",
        reference, notes,
        wht_total: totals.wht,
        items: validLines.map((l) => ({
          line_type: l.line_type,
          product_id: l.product_id || null,
          description: l.description,
          quantity: l.quantity,
          unit_cost: l.unit_cost,
          vat_rate: l.vat_rate,
          vat_treatment: l.vat_treatment,
          expense_account_id: l.expense_account_id || null,
          asset_category: l.asset_category || null,
          asset_useful_life: l.asset_useful_life ?? null,
          warehouse: l.line_type === "stock" ? warehouse : null,
        })),
      });
      setSavedId(newId);

      if (mode === "post") {
        await postPurchase.mutateAsync(newId);
        if (payNow) {
          const amt = Number(payAmount || totals.payable);
          await paySupplier.mutateAsync({
            supplier_id: supplierId,
            amount: amt,
            method: payMethod,
            payment_account: payAccount,
            reference: payRef || reference || undefined,
            charge_type: chargeType,
            charge_amount: chargeType === "none" ? 0 : Number(chargeAmount) || 0,
            allocations: [{ purchase_id: newId, amount: amt }],
            date: invoiceDate,
          });
          toast.success("Posted and payment recorded");
        } else {
          toast.success("Posted — stock, assets, expenses & GL updated");
        }
        nav("/purchases");
      } else if (mode === "new") {
        toast.success("Saved. Starting a new purchase.");
        nav("/purchases/new");
        window.location.reload();
      } else {
        toast.success("Saved as draft");
      }
      return newId;
    } catch (e: any) { toast.error(e.message); return null; }
  };

  const submitSupplier = async () => {
    if (!newSup.name.trim()) return toast.error("Supplier name required");
    try {
      const s = await createSupplier.mutateAsync({
        name: newSup.name,
        phone: newSup.phone || undefined,
        kra_pin: newSup.kra_pin || undefined,
      });
      setSupplierId(s.id); setSupOpen(false); setNewSup({ name: "", phone: "", kra_pin: "" });
      toast.success("Supplier added");
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold font-heading">New Purchase</h1>
            <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{savedId ? "Draft" : "New"}</span>
          </div>
          <Link to="/purchases" className="text-xs text-muted-foreground hover:underline">Purchases / New Purchase</Link>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => save("draft")} disabled={savePurchase.isPending}>
            <Save className="h-4 w-4 mr-1" /> Save Draft
          </Button>
          <Button variant="outline" onClick={() => save("new")} disabled={savePurchase.isPending}>Save &amp; New</Button>
          <Button onClick={() => save("post")} disabled={savePurchase.isPending || postPurchase.isPending || paySupplier.isPending}>
            <Send className="h-4 w-4 mr-1" /> Post Purchase
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-4">
        {/* MAIN */}
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label>Supplier *</Label>
                <div className="flex gap-2">
                  <Select value={supplierId} onValueChange={setSupplierId}>
                    <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                    <SelectContent>{suppliers.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <Dialog open={supOpen} onOpenChange={setSupOpen}>
                    <DialogTrigger asChild><Button variant="outline" size="icon"><Plus className="h-4 w-4" /></Button></DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Add Supplier</DialogTitle></DialogHeader>
                      <div className="space-y-3">
                        <div><Label>Name *</Label><Input value={newSup.name} onChange={(e) => setNewSup({ ...newSup, name: e.target.value })} /></div>
                        <div><Label>Phone</Label><Input value={newSup.phone} onChange={(e) => setNewSup({ ...newSup, phone: e.target.value })} /></div>
                        <div><Label>KRA PIN</Label><Input value={newSup.kra_pin} onChange={(e) => setNewSup({ ...newSup, kra_pin: e.target.value })} /></div>
                        <Button className="w-full" onClick={submitSupplier}>Add</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
                {supplierId && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Outstanding: KES {Number(supplierBalance).toLocaleString()}
                  </p>
                )}
              </div>
              <div>
                <Label>Supplier Invoice No</Label>
                <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="e.g. INV-4587" />
              </div>
              <div>
                <Label>Invoice Date *</Label>
                <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
              </div>
              <div>
                <Label>Warehouse / Store</Label>
                <Select value={warehouse} onValueChange={setWarehouse}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="main">Main Store</SelectItem>
                    <SelectItem value="shop">Shop Counter</SelectItem>
                    <SelectItem value="store2">Store 2</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Reference / GRN No</Label>
                <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Optional" />
              </div>
              <div>
                <Label>Notes</Label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal notes" />
              </div>
            </CardContent>
          </Card>

          {/* Unified search */}
          <Card>
            <CardContent className="p-4">
              <Label className="mb-1 block">Add line</Label>
              <PurchaseItemSearch onSelect={addFromSearch} />
              <p className="mt-2 text-[11px] text-muted-foreground">
                One box for everything: products and services from your catalogue, expense accounts, and asset categories.
              </p>
            </CardContent>
          </Card>

          {/* Typed line grid */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="p-2 text-left w-8">#</th>
                      <th className="p-2 text-left w-24">Type</th>
                      <th className="p-2 text-left min-w-[240px]">Item / Description</th>
                      <th className="p-2 text-right w-20">Qty</th>
                      <th className="p-2 text-right w-28">Unit Cost</th>
                      <th className="p-2 text-left w-40">VAT</th>
                      <th className="p-2 text-right w-28">Line Total</th>
                      <th className="p-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.length === 0 && (
                      <tr><td colSpan={8} className="p-8 text-center text-muted-foreground text-sm">
                        Search above to add stock, services, expenses or assets to this supplier invoice.
                      </td></tr>
                    )}
                    {lines.map((l, i) => {
                      const net = (Number(l.quantity) || 0) * (Number(l.unit_cost) || 0);
                      const vat = (net * (Number(l.vat_rate) || 0)) / 100;
                      return (
                        <tr key={i} className="border-t align-top">
                          <td className="p-2 text-muted-foreground">{i + 1}</td>
                          <td className="p-2"><TypeBadge type={l.line_type as any} /></td>
                          <td className="p-2 space-y-1">
                            <p className="font-medium">{l.name}</p>
                            <Input value={l.description} onChange={(e) => updateLine(i, { description: e.target.value })}
                              className="h-7 text-xs" placeholder="Description" />
                            {l.line_type === "expense" && (
                              <Select value={l.expense_account_id || ""} onValueChange={(v) => updateLine(i, { expense_account_id: v })}>
                                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Expense account" /></SelectTrigger>
                                <SelectContent>
                                  {expenseAccounts.map((a: any) => (
                                    <SelectItem key={a.id} value={a.id}>{a.code} · {a.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                            {l.line_type === "asset" && (
                              <div className="flex gap-1">
                                <Select value={l.asset_category || ""} onValueChange={(v) => updateLine(i, { asset_category: v })}>
                                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Asset category" /></SelectTrigger>
                                  <SelectContent>
                                    {ASSET_CATEGORIES.map((c) => (
                                      <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Input type="number" min={1} className="h-8 w-24 text-xs" value={l.asset_useful_life ?? 4}
                                  onChange={(e) => updateLine(i, { asset_useful_life: Number(e.target.value) })} placeholder="Yrs" />
                              </div>
                            )}
                            {l.line_type === "stock" && (
                              <p className="text-[11px] text-muted-foreground">Goes to {warehouse} · creates a FIFO batch</p>
                            )}
                          </td>
                          <td className="p-2">
                            <Input type="number" min={1} value={l.quantity} className="h-9 text-right"
                              onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })} />
                          </td>
                          <td className="p-2">
                            <Input type="number" min={0} value={l.unit_cost} className="h-9 text-right"
                              onChange={(e) => updateLine(i, { unit_cost: Number(e.target.value) })} />
                          </td>
                          <td className="p-2 space-y-1">
                            <Select value={l.vat_treatment}
                              onValueChange={(v) => updateLine(i, { vat_treatment: v as VatTreatment, vat_rate: rateFor(v as VatTreatment, l.vat_rate) })}>
                              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {(Object.keys(VAT_LABEL) as VatTreatment[]).map((t) => (
                                  <SelectItem key={t} value={t}>{VAT_LABEL[t]}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {l.vat_treatment === "custom" && (
                              <Input type="number" min={0} max={100} className="h-8 text-xs text-right" value={l.vat_rate}
                                onChange={(e) => updateLine(i, { vat_rate: Number(e.target.value) })} />
                            )}
                          </td>
                          <td className="p-2 text-right font-medium">{(net + vat).toLocaleString()}</td>
                          <td className="p-2">
                            <Button size="icon" variant="ghost" onClick={() => removeLine(i)}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* VAT breakdown + type split */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm uppercase tracking-wider">VAT Breakdown</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-1">
                {Object.keys(totals.byTreatment).length === 0 && <p className="text-muted-foreground text-xs">No lines yet.</p>}
                {Object.entries(totals.byTreatment).map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-muted-foreground">{VAT_LABEL[k as VatTreatment]}</span>
                    <span>KES {v.net.toLocaleString()} <span className="text-primary">+ {v.vat.toLocaleString()} VAT</span></span>
                  </div>
                ))}
                <div className="border-t pt-1 mt-1 flex justify-between font-semibold">
                  <span>Total Input VAT</span><span>KES {totals.vat.toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm uppercase tracking-wider">What this invoice does</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-1">
                {Object.keys(totals.byType).length === 0 && <p className="text-muted-foreground text-xs">No lines yet.</p>}
                {Object.entries(totals.byType).map(([k, v]) => (
                  <div key={k} className="flex justify-between items-center">
                    <span className="flex items-center gap-2"><TypeBadge type={k as any} />
                      <span className="text-muted-foreground text-xs">
                        {k === "stock" ? "Stock received (FIFO)" : k === "asset" ? "Added to asset register" : k === "expense" ? "Posted to expenses" : "Service expense"}
                      </span>
                    </span>
                    <span>KES {v.toLocaleString()}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* SIDEBAR */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm uppercase tracking-wider">Purchase Summary</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal (excl. VAT)</span><span>KES {totals.subtotal.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Input VAT</span><span className="text-primary">KES {totals.vat.toLocaleString()}</span></div>
              <div className="flex justify-between items-center">
                <label className="flex items-center gap-2 text-muted-foreground cursor-pointer">
                  <input type="checkbox" checked={withholdTax} onChange={(e) => setWithholdTax(e.target.checked)} />
                  Withhold Tax (2%)
                </label>
                {withholdTax && <span className="text-destructive">- KES {totals.wht.toLocaleString()}</span>}
              </div>
              <div className="border-t pt-2 mt-2 flex justify-between text-base font-bold">
                <span>Payable</span><span className="text-primary">KES {totals.payable.toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>

          {/* Settlement */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm uppercase tracking-wider">Settlement</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Terms (days)</Label>
                  <Input type="number" value={paymentTerms} onChange={(e) => setPaymentTerms(Number(e.target.value))} className="h-9" />
                </div>
                <div>
                  <Label className="text-xs">Due Date</Label>
                  <Input type="date" value={dueDate} disabled className="h-9" />
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={payNow} onChange={(e) => {
                  setPayNow(e.target.checked);
                  if (e.target.checked && payAmount === "") setPayAmount(Number(totals.payable.toFixed(2)));
                }} />
                Pay now
              </label>

              {payNow && (
                <div className="space-y-2 rounded-md border p-2">
                  <div>
                    <Label className="text-xs">Method</Label>
                    <Select value={payMethod} onValueChange={(v: any) => {
                      setPayMethod(v);
                      setPayAccount(v === "mpesa" ? "1030" : v === "cash" ? "1000" : "1010");
                      setChargeType(v === "mpesa" ? "mpesa_fee" : v === "bank" ? "bank_charge" : "none");
                    }}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="mpesa">M-Pesa</SelectItem>
                        <SelectItem value="bank">Bank Transfer</SelectItem>
                        <SelectItem value="cheque">Cheque</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Paid from</Label>
                    <Select value={payAccount} onValueChange={setPayAccount}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PAYMENT_ACCOUNTS.map((a) => <SelectItem key={a.code} value={a.code}>{a.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Amount</Label>
                      <Input type="number" min={0} className="h-9 text-right" value={payAmount}
                        onChange={(e) => setPayAmount(e.target.value === "" ? "" : Number(e.target.value))} />
                    </div>
                    <div>
                      <Label className="text-xs">Reference</Label>
                      <Input className="h-9" value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="M-Pesa code" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Transaction charge</Label>
                    <Select value={chargeType} onValueChange={(v: any) => setChargeType(v)}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CHARGE_TYPES.map((c) => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {chargeType !== "none" && (
                      <Input type="number" min={0} className="h-9 mt-1 text-right" value={chargeAmount}
                        onChange={(e) => setChargeAmount(Number(e.target.value))} placeholder="Charge amount" />
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    The charge is booked as its own expense — it never increases what the supplier is owed.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {savedId ? (
            <PurchaseReceiptsUpload purchaseId={savedId} />
          ) : (
            <Card className="border-dashed">
              <CardHeader className="pb-2"><CardTitle className="text-sm uppercase tracking-wider">Attach Document</CardTitle></CardHeader>
              <CardContent className="text-sm text-muted-foreground text-center py-6">
                Save the draft first to attach supplier invoices / receipts.
              </CardContent>
            </Card>
          )}

          {supplierId && (
            <Card>
              <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm uppercase tracking-wider">Recent from Supplier</CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                {recent.length === 0 ? (
                  <p className="text-muted-foreground text-xs">No previous purchases.</p>
                ) : recent.map((r: any) => (
                  <div key={r.id} className="flex justify-between border-b last:border-0 py-1">
                    <span className="text-xs text-muted-foreground">
                      {r.invoice_number || r.purchase_code} · {format(new Date(r.invoice_date || r.purchase_date), "dd MMM")}
                    </span>
                    <span className="text-xs font-medium">KES {Number(r.total).toLocaleString()}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
