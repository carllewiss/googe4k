import { useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, ArrowLeftRight, Lock, History } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { kes } from "./Payments";

const REASONS = ["wrong_method", "wrong_amount", "wrong_mpesa_account", "entry_error"];

export default function SalePaymentDetail() {
  const { id } = useParams(); // invoice id
  const nav = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({});
  const [busy, setBusy] = useState(false);

  const { data, refetch } = useQuery({
    queryKey: ["sale_payment_detail", id],
    queryFn: async () => {
      const sb = supabase as any;
      const { data: inv, error } = await sb.from("invoices")
        .select("*, customers(id,name,customer_code)")
        .eq("id", id).single();
      if (error) throw error;
      const [{ data: journals }, { data: corrections }] = await Promise.all([
        sb.from("journal_entries")
          .select("id, entry_date, reference_type, description, created_at, journal_lines(debit, credit, memo, accounts(code,name))")
          .eq("reference_id", id).order("created_at"),
        sb.from("payment_corrections").select("*").eq("invoice_id", id).is("payment_id", null).order("created_at"),
      ]);
      const { data: per } = await sb.from("accounting_periods").select("status")
        .lte("start_date", inv.created_at.slice(0, 10)).gte("end_date", inv.created_at.slice(0, 10)).maybeSingle();
      return { inv, journals: journals ?? [], corrections: corrections ?? [], periodStatus: per?.status ?? "open" };
    },
  });

  if (!data) return <div className="flex h-64 items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  const { inv, journals, corrections, periodStatus } = data;
  const cash = Number(inv.cash_amount) || 0;
  const mpesa = Number(inv.mpesa_amount) || 0;
  const paid = cash + mpesa;
  const method = cash > 0 && mpesa > 0 ? "Cash + M-Pesa" : mpesa > 0 ? "M-Pesa" : "Cash";

  const openDialog = () => {
    setForm({ cash, mpesa, reason_code: REASONS[0], reason: "" });
    setOpen(true);
  };

  const submit = async () => {
    if (!form.reason?.trim()) return toast.error("Please enter a reason");
    const newTotal = (Number(form.cash) || 0) + (Number(form.mpesa) || 0);
    if (newTotal > Number(inv.total)) return toast.error(`Paid amount cannot exceed the invoice total (${kes(inv.total)})`);
    setBusy(true);
    const { error } = await (supabase as any).rpc("correct_sale_payment", {
      p_invoice_id: inv.id,
      p_cash_amount: Number(form.cash) || 0,
      p_mpesa_amount: Number(form.mpesa) || 0,
      p_reason_code: form.reason_code,
      p_reason: form.reason,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Correction posted");
    setOpen(false);
    qc.invalidateQueries();
    refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Button variant="outline" size="icon" onClick={() => nav(-1)}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold font-heading">Sale Payment — {inv.invoice_number}</h1>
              <Badge variant="secondary">{inv.status?.toUpperCase()}</Badge>
              <Badge variant="outline">At sale</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{inv.customers?.name} • {format(new Date(inv.created_at), "dd MMM yyyy")} • {kes(paid)} • {method}</p>
          </div>
        </div>
      </div>

      {periodStatus !== "open" && (
        <div className="flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
          <Lock className="h-4 w-4" /> This sale is in a <b>{periodStatus}</b> accounting period. Any correction will be posted today ({format(new Date(), "dd MMM yyyy")}) — the closed month stays untouched.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardContent className="grid gap-6 p-6 sm:grid-cols-4">
              <div><p className="text-xs text-muted-foreground">Customer</p><p className="font-semibold">{inv.customers?.name}</p><p className="text-xs text-muted-foreground">{inv.customers?.customer_code}</p>
                <Link className="text-xs text-primary" to={`/customers/${inv.customers?.id}`}>View customer</Link></div>
              <div><p className="text-xs text-muted-foreground">Method</p><p className="font-semibold">{method}</p>
                {cash > 0 && <p className="text-xs">Cash {kes(cash)}</p>}
                {mpesa > 0 && <p className="text-xs">M-Pesa {kes(mpesa)}</p>}</div>
              <div><p className="text-xs text-muted-foreground">Invoice total</p><p className="font-semibold">{kes(inv.total)}</p>
                <p className="text-xs text-muted-foreground">Balance {kes(inv.balance)}</p></div>
              <div className="rounded-lg bg-primary/10 p-4"><p className="text-xs text-muted-foreground">Paid at sale</p><p className="text-2xl font-bold text-primary">{kes(paid)}</p></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Accounting journal entries</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {journals.length === 0 && <p className="text-sm text-muted-foreground">No journals found.</p>}
              {journals.map((j: any) => (
                <div key={j.id} className="rounded-md border">
                  <div className="flex justify-between bg-muted/50 px-3 py-2 text-xs"><span className="font-medium">{j.description}</span><span>{format(new Date(j.entry_date), "dd MMM yyyy")}</span></div>
                  <Table><TableBody>
                    {j.journal_lines.map((l: any, i: number) => (
                      <TableRow key={i}><TableCell className="text-sm">{l.accounts?.code} {l.accounts?.name}</TableCell>
                        <TableCell className="text-right text-sm">{Number(l.debit) ? kes(l.debit) : "—"}</TableCell>
                        <TableCell className="text-right text-sm">{Number(l.credit) ? kes(l.credit) : "—"}</TableCell></TableRow>
                    ))}
                  </TableBody></Table>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Quick actions</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Button className="h-auto w-full justify-start gap-3 py-3 text-left" onClick={openDialog}>
                <ArrowLeftRight className="h-5 w-5 shrink-0" />
                <span><span className="block font-semibold">Correct Payment</span><span className="block text-xs opacity-80">Fix wrong method (M-Pesa vs cash) or amount</span></span>
              </Button>
              <Button asChild variant="outline" className="h-auto w-full justify-start gap-3 py-3 text-left">
                <Link to={`/invoices/${inv.id}`}><History className="h-5 w-5 shrink-0" /><span><span className="block font-semibold">Open Invoice</span><span className="block text-xs opacity-80">Credit notes & full invoice detail</span></span></Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><History className="h-4 w-4" />Audit trail</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="border-l-2 border-primary pl-3"><p className="font-medium">Payment taken at sale</p><p className="text-xs text-muted-foreground">{format(new Date(inv.created_at), "dd MMM yyyy HH:mm")}</p></div>
              {corrections.map((c: any) => (
                <div key={c.id} className="border-l-2 border-warning pl-3">
                  <p className="font-medium">{c.correction_no} · payment corrected</p>
                  <p className="text-xs">{c.from_account} → {c.to_account}</p>
                  <p className="text-xs text-muted-foreground">{c.reason_code}: {c.reason}</p>
                  <p className="text-xs text-muted-foreground">Posted {format(new Date(c.posting_date), "dd MMM yyyy")}{c.original_period_status !== "open" ? ` (original period ${c.original_period_status})` : ""}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Correct Sale Payment</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">The original sale is never edited. A correction dated today ({format(new Date(), "dd MMM yyyy")}) is posted, and the customer's balance updates if the amount was reduced.</p>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Cash received</Label><Input type="number" min="0" value={form.cash ?? ""} onChange={(e) => setForm({ ...form, cash: e.target.value })} /></div>
              <div><Label>M-Pesa received</Label><Input type="number" min="0" value={form.mpesa ?? ""} onChange={(e) => setForm({ ...form, mpesa: e.target.value })} /></div>
            </div>
            <p className="text-xs text-muted-foreground">Invoice total: {kes(inv.total)}. If the new total is less, the difference becomes customer debt.</p>
            <div><Label>Reason code</Label>
              <Select value={form.reason_code} onValueChange={(v) => setForm({ ...form, reason_code: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{REASONS.map((r) => <SelectItem key={r} value={r}>{r.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
              </Select></div>
            <div><Label>Reason (required)</Label><Textarea value={form.reason ?? ""} onChange={(e) => setForm({ ...form, reason: e.target.value })} maxLength={500} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={busy}>{busy ? "Posting…" : "Post correction"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
