import { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileDown, Pencil, ShoppingCart, Wallet, AlertTriangle, Receipt } from "lucide-react";
import {
  useSupplier, useSupplierPurchases, useSupplierPayments, useSupplierProducts, useUpdateSupplier,
} from "@/hooks/useSupplierWorkspace";
import { printDocument } from "@/lib/print";
import { COMPANY } from "@/lib/company";
import { format } from "date-fns";
import { toast } from "sonner";

const kes = (n: number) => `KES ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function SupplierDetail() {
  const { id } = useParams();
  const { data: supplier } = useSupplier(id);
  const { data: purchases = [] } = useSupplierPurchases(id);
  const { data: payments = [] } = useSupplierPayments(id);
  const { data: products = [] } = useSupplierProducts(id);
  const updateSupplier = useUpdateSupplier();

  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", kra_pin: "" });

  const posted = purchases.filter((p: any) => p.status === "posted");

  const stats = useMemo(() => {
    const now = new Date();
    let purchased = 0, paid = 0, outstanding = 0, overdue = 0;
    posted.forEach((p: any) => {
      const t = Number(p.total || 0), a = Number(p.amount_paid || 0);
      purchased += t; paid += a;
      const bal = Math.max(t - a, 0);
      outstanding += bal;
      if (bal > 0.01 && p.due_date && new Date(p.due_date) < now) overdue += bal;
    });
    return { purchased, paid, outstanding, overdue };
  }, [posted]);

  const statement = useMemo(() => {
    const rows = [
      ...posted.map((p: any) => ({
        date: p.invoice_date || p.purchase_date,
        desc: `Invoice ${p.invoice_number || p.purchase_code}`,
        debit: 0,
        credit: Number(p.total || 0),
      })),
      ...payments.map((p: any) => ({
        date: p.payment_date,
        desc: `Payment ${p.payment_no} · ${p.method}${p.reference ? ` · ${p.reference}` : ""}`,
        debit: Number(p.amount || 0),
        credit: 0,
      })),
    ].sort((a, b) => a.date.localeCompare(b.date));
    let bal = 0;
    return rows.map((r) => { bal += r.credit - r.debit; return { ...r, balance: bal }; });
  }, [posted, payments]);

  const openEdit = () => {
    setForm({
      name: supplier?.name || "", phone: supplier?.phone || "",
      email: supplier?.email || "", kra_pin: supplier?.kra_pin || "",
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!form.name.trim()) return toast.error("Name required");
    try {
      await updateSupplier.mutateAsync({ id: id!, ...form });
      setEditOpen(false);
      toast.success("Supplier updated");
    } catch (e: any) { toast.error(e.message); }
  };

  if (!supplier) return <p className="text-muted-foreground">Loading supplier…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold font-heading">{supplier.name}</h1>
          <p className="text-xs text-muted-foreground">
            <Link to="/purchases/suppliers" className="hover:underline">Suppliers</Link> / {supplier.name}
            {supplier.kra_pin ? ` · PIN ${supplier.kra_pin}` : ""}{supplier.phone ? ` · ${supplier.phone}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={openEdit}><Pencil className="h-4 w-4 mr-1" /> Edit</Button>
          <Button variant="outline" onClick={() => printDocument()}><FileDown className="h-4 w-4 mr-1" /> Export PDF</Button>
          <Button asChild><Link to="/purchases/new"><ShoppingCart className="h-4 w-4 mr-1" /> New Purchase</Link></Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={Receipt} label="Total Purchased" value={kes(stats.purchased)} />
        <Kpi icon={Wallet} label="Total Paid" value={kes(stats.paid)} />
        <Kpi icon={Wallet} label="Outstanding" value={kes(stats.outstanding)} tone="text-primary" />
        <Kpi icon={AlertTriangle} label="Overdue" value={kes(stats.overdue)} tone="text-destructive" />
      </div>

      <Tabs defaultValue="purchases">
        <TabsList>
          <TabsTrigger value="purchases">Purchases</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="statement">Statement</TabsTrigger>
          <TabsTrigger value="products">Items Bought</TabsTrigger>
        </TabsList>

        <TabsContent value="purchases">
          <Card><CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wider">
                <tr>
                  <th className="p-3 text-left">Invoice</th><th className="p-3 text-left">Date</th>
                  <th className="p-3 text-left">Due</th><th className="p-3 text-left">Status</th>
                  <th className="p-3 text-right">Total</th><th className="p-3 text-right">Paid</th><th className="p-3 text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {purchases.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No purchases yet.</td></tr>}
                {purchases.map((p: any) => {
                  const bal = Number(p.total || 0) - Number(p.amount_paid || 0);
                  return (
                    <tr key={p.id} className="border-t hover:bg-accent-soft">
                      <td className="p-3 font-medium">
                        <Link to={`/purchases/${p.id}`} className="hover:underline">{p.invoice_number || p.purchase_code}</Link>
                      </td>
                      <td className="p-3">{format(new Date(p.invoice_date || p.purchase_date), "dd MMM yyyy")}</td>
                      <td className="p-3 text-muted-foreground">{p.due_date ? format(new Date(p.due_date), "dd MMM yyyy") : "—"}</td>
                      <td className="p-3 capitalize">{p.status}</td>
                      <td className="p-3 text-right">{kes(p.total)}</td>
                      <td className="p-3 text-right text-muted-foreground">{kes(p.amount_paid)}</td>
                      <td className={`p-3 text-right font-semibold ${bal > 0.01 ? "text-primary" : "text-success"}`}>{kes(bal)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card><CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wider">
                <tr>
                  <th className="p-3 text-left">Payment</th><th className="p-3 text-left">Date</th>
                  <th className="p-3 text-left">Method</th><th className="p-3 text-left">Reference</th>
                  <th className="p-3 text-right">Amount</th><th className="p-3 text-right">Charge</th>
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No payments recorded.</td></tr>}
                {payments.map((p: any) => (
                  <tr key={p.id} className="border-t">
                    <td className="p-3 font-medium">{p.payment_no}</td>
                    <td className="p-3">{format(new Date(p.payment_date), "dd MMM yyyy")}</td>
                    <td className="p-3 capitalize">{p.method}</td>
                    <td className="p-3 text-muted-foreground">{p.reference || "—"}</td>
                    <td className="p-3 text-right">{kes(p.amount)}</td>
                    <td className="p-3 text-right text-muted-foreground">{Number(p.charge_amount) > 0 ? kes(p.charge_amount) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="statement">
          <Card><CardContent className="p-0">
            <div id="supplier-print" className="p-4">
              <div className="mb-3">
                <p className="font-bold">{COMPANY.name}</p>
                <p className="text-xs text-muted-foreground">PIN {COMPANY.kraPin} · {COMPANY.address}</p>
                <p className="mt-2 text-sm font-semibold">Supplier Statement — {supplier.name}</p>
                <p className="text-xs text-muted-foreground">Generated {format(new Date(), "dd MMM yyyy")}</p>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="p-2 text-left">Date</th><th className="p-2 text-left">Description</th>
                    <th className="p-2 text-right">Paid</th><th className="p-2 text-right">Billed</th><th className="p-2 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {statement.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Nothing to show.</td></tr>}
                  {statement.map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2">{format(new Date(r.date), "dd MMM yyyy")}</td>
                      <td className="p-2">{r.desc}</td>
                      <td className="p-2 text-right">{r.debit ? kes(r.debit) : "—"}</td>
                      <td className="p-2 text-right">{r.credit ? kes(r.credit) : "—"}</td>
                      <td className="p-2 text-right font-medium">{kes(r.balance)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 font-bold">
                    <td className="p-2" colSpan={4}>Closing balance owed</td>
                    <td className="p-2 text-right">{kes(statement.length ? statement[statement.length - 1].balance : 0)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="products">
          <Card><CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wider">
                <tr>
                  <th className="p-3 text-left">Item</th><th className="p-3 text-right">Qty Bought</th>
                  <th className="p-3 text-right">Last Cost</th><th className="p-3 text-right">Total Spend</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No stock bought from this supplier yet.</td></tr>}
                {products.map((p: any) => (
                  <tr key={p.product_id} className="border-t">
                    <td className="p-3 font-medium">{p.name}</td>
                    <td className="p-3 text-right">{p.qty} {p.unit}</td>
                    <td className="p-3 text-right">{kes(p.last_cost)}</td>
                    <td className="p-3 text-right">{kes(p.spend)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Supplier</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label>KRA PIN</Label><Input value={form.kra_pin} onChange={(e) => setForm({ ...form, kra_pin: e.target.value })} /></div>
            </div>
            <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <Button className="w-full" onClick={saveEdit} disabled={updateSupplier.isPending}>Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider">
          <Icon className="h-3.5 w-3.5" /> {label}
        </div>
        <p className={`mt-1 text-lg font-bold ${tone || ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
