import { useState, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { usePurchaseOrders, useSavePurchaseOrder, useConvertPOToInvoice, useCancelPO, type POLine } from "@/hooks/usePurchaseOrders";
import { useSuppliers } from "@/hooks/useSuppliers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, FileText, Send } from "lucide-react";
import { PurchaseProductPicker } from "@/components/PurchaseProductPicker";
import { format } from "date-fns";
import { toast } from "sonner";

const empty: POLine = { product_id: null, description: "", quantity: 1, unit_cost: 0, vat_rate: 16 };

export default function PurchaseOrders() {
  const nav = useNavigate();
  const { data: pos = [], isLoading } = usePurchaseOrders();
  const { data: suppliers = [] } = useSuppliers();
  const save = useSavePurchaseOrder();
  const convert = useConvertPOToInvoice();
  const cancel = useCancelPO();

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | undefined>();
  const [supplierId, setSupplierId] = useState("");
  const [orderDate, setOrderDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [expectedDate, setExpectedDate] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<POLine[]>([{ ...empty }]);

  const totals = useMemo(() => {
    let s = 0, v = 0;
    for (const l of lines) { const n = l.quantity * l.unit_cost; s += n; v += n * (l.vat_rate || 0) / 100; }
    return { subtotal: s, vat: v, total: s + v };
  }, [lines]);

  const reset = () => {
    setEditId(undefined); setSupplierId(""); setOrderDate(format(new Date(), "yyyy-MM-dd"));
    setExpectedDate(""); setReference(""); setNotes(""); setLines([{ ...empty }]);
  };

  const openNew = () => { reset(); setOpen(true); };
  const openEdit = (po: any) => {
    setEditId(po.id); setSupplierId(po.supplier_id); setOrderDate(po.order_date);
    setExpectedDate(po.expected_date || ""); setReference(po.reference || ""); setNotes(po.notes || "");
    setLines((po.purchase_order_items || []).map((it: any) => ({
      product_id: it.product_id, description: it.description || "",
      quantity: it.quantity, unit_cost: Number(it.unit_cost), vat_rate: Number(it.vat_rate || 0),
    })));
    setOpen(true);
  };

  const submit = async (status: "draft" | "issued") => {
    if (!supplierId) return toast.error("Pick supplier");
    const valid = lines.filter(l => l.product_id && l.quantity > 0);
    if (!valid.length) return toast.error("Add at least one line");
    try {
      await save.mutateAsync({
        id: editId, supplier_id: supplierId, order_date: orderDate,
        expected_date: expectedDate || null, reference, notes, status, items: valid,
      });
      toast.success(status === "draft" ? "Saved draft" : "PO issued");
      setOpen(false); reset();
    } catch (e: any) { toast.error(e.message); }
  };

  const onConvert = async (id: string) => {
    try { const pid = await convert.mutateAsync(id); toast.success("Converted to draft invoice"); nav(`/purchases/${pid}/edit`); }
    catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <Link to="/purchases" className="text-xs text-muted-foreground hover:underline">Purchases</Link>
          <h1 className="text-2xl font-bold font-heading">Purchase Orders</h1>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> New PO</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? <p className="p-8 text-center text-muted-foreground">Loading...</p> : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>PO #</TableHead><TableHead>Date</TableHead><TableHead>Supplier</TableHead>
              <TableHead>Status</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {pos.map((po: any) => (
                <TableRow key={po.id}>
                  <TableCell className="font-mono text-xs">{po.po_number}</TableCell>
                  <TableCell className="text-sm">{format(new Date(po.order_date), "dd MMM yyyy")}</TableCell>
                  <TableCell className="text-sm">{po.suppliers?.name}</TableCell>
                  <TableCell><Badge variant={po.status === "draft" ? "secondary" : po.status === "cancelled" ? "destructive" : "default"}>{po.status}</Badge></TableCell>
                  <TableCell className="text-right font-medium">KES {Number(po.total).toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      {(po.status === "draft" || po.status === "issued") && (
                        <Button size="sm" variant="ghost" onClick={() => openEdit(po)}><FileText className="h-3.5 w-3.5" /></Button>
                      )}
                      {(po.status === "draft" || po.status === "issued") && (
                        <Button size="sm" onClick={() => onConvert(po.id)}>To Invoice</Button>
                      )}
                      {po.status !== "cancelled" && po.status !== "invoiced" && (
                        <Button size="sm" variant="ghost" onClick={() => cancel.mutate(po.id)}>Cancel</Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {pos.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No purchase orders.</TableCell></TableRow>}
            </TableBody>
          </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle>{editId ? "Edit" : "New"} Purchase Order</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label>Supplier *</Label>
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                  <SelectContent>{suppliers.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Order Date</Label><Input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} /></div>
              <div><Label>Expected Delivery</Label><Input type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} /></div>
              <div className="md:col-span-2"><Label>Reference</Label><Input value={reference} onChange={e => setReference(e.target.value)} /></div>
              <div className="md:col-span-1"><Label>Notes</Label><Input value={notes} onChange={e => setNotes(e.target.value)} /></div>
            </div>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Lines</CardTitle></CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase">
                    <tr><th className="p-2 text-left">Product</th><th className="p-2 text-right w-20">Qty</th><th className="p-2 text-right w-28">Unit Cost</th><th className="p-2 text-right w-20">VAT %</th><th className="p-2 text-right w-28">Total</th><th className="w-10"></th></tr>
                  </thead>
                  <tbody>
                    {lines.map((l, i) => {
                      const t = l.quantity * l.unit_cost * (1 + (l.vat_rate || 0) / 100);
                      return (
                        <tr key={i} className="border-t">
                          <td className="p-2"><PurchaseProductPicker value={l.product_id || undefined}
                            onSelect={(p) => setLines(prev => prev.map((x, idx) => idx === i ? { ...x, product_id: p.id } : x))} /></td>
                          <td className="p-2"><Input type="number" min={1} value={l.quantity} className="h-9 text-right"
                            onChange={e => setLines(prev => prev.map((x, idx) => idx === i ? { ...x, quantity: Number(e.target.value) } : x))} /></td>
                          <td className="p-2"><Input type="number" min={0} value={l.unit_cost} className="h-9 text-right"
                            onChange={e => setLines(prev => prev.map((x, idx) => idx === i ? { ...x, unit_cost: Number(e.target.value) } : x))} /></td>
                          <td className="p-2"><Input type="number" min={0} max={100} value={l.vat_rate} className="h-9 text-right"
                            onChange={e => setLines(prev => prev.map((x, idx) => idx === i ? { ...x, vat_rate: Number(e.target.value) } : x))} /></td>
                          <td className="p-2 text-right">{t.toLocaleString()}</td>
                          <td className="p-2"><Button size="icon" variant="ghost" onClick={() => setLines(prev => prev.filter((_, idx) => idx !== i))}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="p-2 border-t"><Button variant="outline" size="sm" onClick={() => setLines(prev => [...prev, { ...empty }])}><Plus className="h-3.5 w-3.5 mr-1" /> Add Row</Button></div>
              </CardContent>
            </Card>

            <div className="flex justify-between items-end">
              <div className="text-sm space-y-1">
                <p className="text-muted-foreground">Subtotal: KES {totals.subtotal.toLocaleString()}</p>
                <p className="text-muted-foreground">VAT: KES {totals.vat.toLocaleString()}</p>
                <p className="font-bold text-base">Total: KES {totals.total.toLocaleString()}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => submit("draft")} disabled={save.isPending}>Save Draft</Button>
                <Button onClick={() => submit("issued")} disabled={save.isPending}><Send className="h-4 w-4 mr-1" /> Issue PO</Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
