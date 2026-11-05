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
import { ArrowLeft, Undo2, ArrowLeftRight, Shuffle, FileX, Lock, History } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { kes } from "./Payments";

const ACCOUNTS = [
  { code: "1000", name: "Cash on Hand" }, { code: "1010", name: "Bank – KCB" }, { code: "1020", name: "Bank – Equity" },
  { code: "1030", name: "M-Pesa Till" }, { code: "1040", name: "M-Pesa Paybill" }, { code: "1050", name: "Petty Cash" },
];
const REASONS: Record<string, string[]> = {
  reversal: ["duplicate", "wrong_amount", "wrong_customer", "external_reversal", "entry_error"],
  account_correction: ["wrong_mpesa_account", "wrong_bank", "wrong_method"],
  reallocation: ["wrong_invoice"],
};
type Action = "reversal" | "account_correction" | "reallocation" | "write_off" | null;

export default function PaymentDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [action, setAction] = useState<Action>(null);
  const [form, setForm] = useState<any>({});
  const [busy, setBusy] = useState(false);

  const { data, refetch } = useQuery({
    queryKey: ["payment_detail", id],
    queryFn: async () => {
      const sb = supabase as any;
      const { data: p, error } = await sb.from("payments").select("*, customers(id,name,customer_code), invoices(id,invoice_number,total,balance,paid_amount,status,created_at)").eq("id", id).single();
      if (error) throw error;
      const [{ data: journals }, { data: corrections }, { data: openInv }] = await Promise.all([
        sb.from("journal_entries").select("id, entry_date, reference_type, description, created_at, journal_lines(debit, credit, memo, accounts(code,name))").eq("reference_id", id).order("created_at"),
        sb.from("payment_corrections").select("*, new_inv:new_invoice_id(invoice_number), old_inv:invoice_id(invoice_number)").eq("payment_id", id).order("created_at"),
        sb.from("invoices").select("id, invoice_number, balance").eq("customer_id", p.customer_id).gt("balance", 0).neq("id", p.invoice_id).order("created_at"),
      ]);
      const { data: per } = await sb.from("accounting_periods").select("status").lte("start_date", p.payment_date).gte("end_date", p.payment_date.slice(0, 10)).maybeSingle();
      return { p, journals: journals ?? [], corrections: corrections ?? [], openInv: openInv ?? [], periodStatus: per?.status ?? "open" };
    },
  });

  if (!data) return <div className="flex h-64 items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  const { p, journals, corrections, openInv, periodStatus } = data;
  const reversed = p.status === "reversed";
  const method = Number(p.mpesa_amount) > 0 && Number(p.cash_amount) > 0 ? "Cash + M-Pesa" : Number(p.mpesa_amount) > 0 ? "M-Pesa" : "Cash";
  const inv = p.invoices;

  const open = (a: Action) => {
    setForm({ reason_code: a && a !== "write_off" ? REASONS[a][0] : "bad_debt", from: Number(p.mpesa_amount) > 0 ? "1030" : "1000", to: "", amount: a === "write_off" ? inv?.balance : p.amount });
    setAction(a);
  };

  const submit = async () => {
    if (!form.reason?.trim()) return toast.error("Please enter a reason");
    setBusy(true);
    const sb = supabase as any;
    let res;
    if (action === "reversal") res = await sb.rpc("reverse_payment", { p_payment_id: p.id, p_reason_code: form.reason_code, p_reason: form.reason });
    if (action === "account_correction") res = await sb.rpc("correct_payment_account", { p_payment_id: p.id, p_from: form.from, p_to: form.to, p_amount: Number(form.amount), p_reason_code: form.reason_code, p_reason: form.reason });
    if (action === "reallocation") res = await sb.rpc("reallocate_payment", { p_payment_id: p.id, p_new_invoice_id: form.invoice, p_reason_code: form.reason_code, p_reason: form.reason });
    if (action === "write_off") res = await sb.rpc("write_off_bad_debt", { p_invoice_id: inv.id, p_amount: Number(form.amount), p_reason: form.reason });
    setBusy(false);
    if (res?.error) return toast.error(res.error.message);
    toast.success("Correction posted");
    setAction(null);
    qc.invalidateQueries();
    refetch();
  };

  const actions = [
    { a: "reversal" as const, icon: Undo2, title: "Reverse Payment", sub: "Create a reversal entry", primary: true },
    { a: "account_correction" as const, icon: ArrowLeftRight, title: "Correct Payment Account", sub: "Fix wrong bank / M-Pesa account" },
    { a: "reallocation" as const, icon: Shuffle, title: "Reallocate to Invoice", sub: "Move to another invoice" },
    { a: "write_off" as const, icon: FileX, title: "Write-off Bad Debt", sub: "Mark invoice balance uncollectible", disabled: !inv || Number(inv.balance) <= 0 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Button variant="outline" size="icon" onClick={() => nav(-1)}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold font-heading">Payment Details</h1>
              <Badge variant={reversed ? "destructive" : "secondary"}>{p.status?.toUpperCase()}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{p.customers?.name} • {format(new Date(p.payment_date), "dd MMM yyyy")} • {kes(p.amount)} • {method}</p>
          </div>
        </div>
      </div>

      {periodStatus !== "open" && (
        <div className="flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
          <Lock className="h-4 w-4" /> This payment is in a <b>{periodStatus}</b> accounting period. Any correction will be posted today ({format(new Date(), "dd MMM yyyy")}) — the closed month stays untouched.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardContent className="grid gap-6 p-6 sm:grid-cols-4">
              <div><p className="text-xs text-muted-foreground">Customer</p><p className="font-semibold">{p.customers?.name}</p><p className="text-xs text-muted-foreground">{p.customers?.customer_code}</p>
                <Link className="text-xs text-primary" to={`/customers/${p.customers?.id}`}>View customer</Link></div>
              <div><p className="text-xs text-muted-foreground">Method</p><p className="font-semibold">{method}</p>
                {Number(p.cash_amount) > 0 && <p className="text-xs">Cash {kes(p.cash_amount)}</p>}
                {Number(p.mpesa_amount) > 0 && <p className="text-xs">M-Pesa {kes(p.mpesa_amount)}</p>}</div>
              <div><p className="text-xs text-muted-foreground">Reference / notes</p><p className="text-sm">{p.notes || "—"}</p>
                <p className="text-xs text-muted-foreground mt-2">{format(new Date(p.payment_date), "dd MMM yyyy, HH:mm")}</p></div>
              <div className="rounded-lg bg-primary/10 p-4"><p className="text-xs text-muted-foreground">Amount received</p><p className="text-2xl font-bold text-primary">{kes(p.amount)}</p></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Allocation</CardTitle></CardHeader>
            <CardContent>
              {inv ? (
                <Table>
                  <TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">This payment</TableHead><TableHead className="text-right">Balance</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                  <TableBody><TableRow>
                    <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                    <TableCell>{format(new Date(inv.created_at), "dd MMM yyyy")}</TableCell>
                    <TableCell className="text-right">{kes(inv.total)}</TableCell>
                    <TableCell className="text-right font-semibold">{reversed ? <s>{kes(p.amount)}</s> : kes(p.amount)}</TableCell>
                    <TableCell className="text-right">{kes(inv.balance)}</TableCell>
                    <TableCell><Badge variant="outline">{inv.status?.toUpperCase()}</Badge></TableCell>
                  </TableRow></TableBody>
                </Table>
              ) : <p className="text-sm text-muted-foreground">Not linked to an invoice.</p>}
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
              {actions.map(({ a, icon: Icon, title, sub, primary, disabled }) => (
                <Button key={a} variant={primary ? "default" : "outline"} className="h-auto w-full justify-start gap-3 py-3 text-left"
                  disabled={disabled || (reversed && a !== "write_off")} onClick={() => open(a)}>
                  <Icon className="h-5 w-5 shrink-0" /><span><span className="block font-semibold">{title}</span><span className="block text-xs opacity-80">{sub}</span></span>
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><History className="h-4 w-4" />Audit trail</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="border-l-2 border-primary pl-3"><p className="font-medium">Payment posted</p><p className="text-xs text-muted-foreground">{format(new Date(p.created_at), "dd MMM yyyy HH:mm")}</p></div>
              {corrections.map((c: any) => (
                <div key={c.id} className="border-l-2 border-warning pl-3">
                  <p className="font-medium">{c.correction_no} · {c.kind.replace("_", " ")}</p>
                  <p className="text-xs">{kes(c.amount)}{c.from_account ? ` · ${c.from_account} → ${c.to_account}` : ""}{c.new_inv ? ` · ${c.old_inv?.invoice_number} → ${c.new_inv.invoice_number}` : ""}</p>
                  <p className="text-xs text-muted-foreground">{c.reason_code}: {c.reason}</p>
                  <p className="text-xs text-muted-foreground">Posted {format(new Date(c.posting_date), "dd MMM yyyy")}{c.original_period_status !== "open" ? ` (original period ${c.original_period_status})` : ""}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={!!action} onOpenChange={(o) => !o && setAction(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{actions.find((x) => x.a === action)?.title}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">The original payment is never edited. A new linked entry dated today ({format(new Date(), "dd MMM yyyy")}) will be posted.</p>
            {action && action !== "write_off" && (
              <div><Label>Reason code</Label>
                <Select value={form.reason_code} onValueChange={(v) => setForm({ ...form, reason_code: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{REASONS[action].map((r) => <SelectItem key={r} value={r}>{r.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                </Select></div>
            )}
            {action === "account_correction" && (
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Posted to (wrong)</Label>
                  <Select value={form.from} onValueChange={(v) => setForm({ ...form, from: v })}><SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{ACCOUNTS.map((a) => <SelectItem key={a.code} value={a.code}>{a.code} {a.name}</SelectItem>)}</SelectContent></Select></div>
                <div><Label>Should be (correct)</Label>
                  <Select value={form.to} onValueChange={(v) => setForm({ ...form, to: v })}><SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
                    <SelectContent>{ACCOUNTS.filter((a) => a.code !== form.from).map((a) => <SelectItem key={a.code} value={a.code}>{a.code} {a.name}</SelectItem>)}</SelectContent></Select></div>
              </div>
            )}
            {(action === "account_correction" || action === "write_off") && (
              <div><Label>Amount</Label><Input type="number" value={form.amount ?? ""} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
            )}
            {action === "reallocation" && (
              <div><Label>Move to invoice (same customer)</Label>
                <Select value={form.invoice} onValueChange={(v) => setForm({ ...form, invoice: v })}><SelectTrigger><SelectValue placeholder={openInv.length ? "Choose invoice" : "No open invoices"} /></SelectTrigger>
                  <SelectContent>{openInv.map((i: any) => <SelectItem key={i.id} value={i.id}>{i.invoice_number} — balance {kes(i.balance)}</SelectItem>)}</SelectContent></Select>
                <p className="mt-1 text-xs text-muted-foreground">For a different customer, reverse this payment and post it again to the right customer.</p></div>
            )}
            {action === "reversal" && <p className="rounded-md bg-destructive/10 p-3 text-sm">Reverses {kes(p.amount)}: the invoice balance and customer debt go back up and the journal is reversed. This does not refund the money in M-Pesa or the bank.</p>}
            <div><Label>Reason (required)</Label><Textarea value={form.reason ?? ""} onChange={(e) => setForm({ ...form, reason: e.target.value })} maxLength={500} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAction(null)}>Cancel</Button>
            <Button onClick={submit} disabled={busy || (action === "account_correction" && !form.to) || (action === "reallocation" && !form.invoice)}>{busy ? "Posting…" : "Post correction"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
