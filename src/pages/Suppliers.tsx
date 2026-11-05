import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Search, Plus, FileDown, Building2, AlertTriangle, Wallet, Receipt } from "lucide-react";
import { useSuppliersWithStats } from "@/hooks/useSupplierWorkspace";
import { useCreateSupplier } from "@/hooks/useSuppliers";
import { printDocument } from "@/lib/print";
import { COMPANY } from "@/lib/company";
import { format } from "date-fns";
import { toast } from "sonner";

const kes = (n: number) => `KES ${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export default function Suppliers() {
  const { data: suppliers = [], isLoading } = useSuppliersWithStats();
  const createSupplier = useCreateSupplier();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", kra_pin: "" });

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return suppliers
      .filter((x) => !s || x.name.toLowerCase().includes(s) || (x.phone || "").includes(s) || (x.kra_pin || "").toLowerCase().includes(s))
      .sort((a, b) => b.outstanding - a.outstanding || b.total_purchased - a.total_purchased);
  }, [suppliers, q]);

  const kpis = useMemo(() => ({
    count: suppliers.length,
    purchased: suppliers.reduce((s, x) => s + x.total_purchased, 0),
    outstanding: suppliers.reduce((s, x) => s + x.outstanding, 0),
    overdue: suppliers.reduce((s, x) => s + x.overdue, 0),
  }), [suppliers]);

  const submit = async () => {
    if (!form.name.trim()) return toast.error("Supplier name required");
    try {
      await createSupplier.mutateAsync({
        name: form.name.trim(),
        phone: form.phone || undefined,
        email: form.email || undefined,
        kra_pin: form.kra_pin || undefined,
      });
      setOpen(false);
      setForm({ name: "", phone: "", email: "", kra_pin: "" });
      toast.success("Supplier added");
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold font-heading">Suppliers</h1>
          <p className="text-sm text-muted-foreground">Who you buy from, what you owe and what is overdue.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => printDocument()}>
            <FileDown className="h-4 w-4 mr-1" /> Export PDF
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> New Supplier</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Supplier</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                  <div><Label>KRA PIN</Label><Input value={form.kra_pin} onChange={(e) => setForm({ ...form, kra_pin: e.target.value })} /></div>
                </div>
                <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <Button className="w-full" onClick={submit} disabled={createSupplier.isPending}>Save Supplier</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={Building2} label="Suppliers" value={String(kpis.count)} />
        <Kpi icon={Receipt} label="Total Purchased" value={kes(kpis.purchased)} />
        <Kpi icon={Wallet} label="Outstanding" value={kes(kpis.outstanding)} tone="text-primary" />
        <Kpi icon={AlertTriangle} label="Overdue" value={kes(kpis.overdue)} tone="text-destructive" />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, phone or KRA PIN" className="pl-9" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div id="supplier-print" className="overflow-x-auto">
            <div className="hidden print:block p-4">
              <p className="font-bold">{COMPANY.name}</p>
              <p className="text-xs">Supplier list &amp; payables — {format(new Date(), "dd MMM yyyy")}</p>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wider">
                <tr>
                  <th className="p-3 text-left">Supplier</th>
                  <th className="p-3 text-left">Contact</th>
                  <th className="p-3 text-left">KRA PIN</th>
                  <th className="p-3 text-right">Invoices</th>
                  <th className="p-3 text-right">Purchased</th>
                  <th className="p-3 text-right">Paid</th>
                  <th className="p-3 text-right">Outstanding</th>
                  <th className="p-3 text-right">Overdue</th>
                  <th className="p-3 text-left">Last Purchase</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">Loading…</td></tr>}
                {!isLoading && rows.length === 0 && (
                  <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">No suppliers yet.</td></tr>
                )}
                {rows.map((s) => (
                  <tr key={s.id} className="border-t hover:bg-accent-soft">
                    <td className="p-3 font-medium">
                      <Link to={`/purchases/suppliers/${s.id}`} className="hover:underline">{s.name}</Link>
                    </td>
                    <td className="p-3 text-muted-foreground">{s.phone || s.email || "—"}</td>
                    <td className="p-3 text-muted-foreground">{s.kra_pin || "—"}</td>
                    <td className="p-3 text-right">{s.purchase_count}</td>
                    <td className="p-3 text-right">{kes(s.total_purchased)}</td>
                    <td className="p-3 text-right text-muted-foreground">{kes(s.total_paid)}</td>
                    <td className="p-3 text-right font-semibold">{kes(s.outstanding)}</td>
                    <td className={`p-3 text-right ${s.overdue > 0 ? "text-destructive font-semibold" : "text-muted-foreground"}`}>{kes(s.overdue)}</td>
                    <td className="p-3 text-muted-foreground">{s.last_purchase_date ? format(new Date(s.last_purchase_date), "dd MMM yyyy") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
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
        <p className={`mt-1 text-xl font-bold ${tone || ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
