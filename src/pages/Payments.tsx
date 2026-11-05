import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { CreditCard } from "lucide-react";

const PAGE = 25;
export const kes = (n: number) => `KES ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function Payments() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const { data = [], isLoading } = useQuery({
    queryKey: ["payments_register"],
    queryFn: async () => {
      // Fetch everything in 1000-row pages (the server caps each request at 1000)
      const fetchAll = async (build: (from: number, to: number) => any) => {
        const out: any[] = [];
        for (let from = 0; ; from += 1000) {
          const { data, error } = await build(from, from + 999);
          if (error) throw error;
          out.push(...(data || []));
          if (!data || data.length < 1000) break;
        }
        return out;
      };
      const sb = supabase as any;
      const [debt, pos] = await Promise.all([
        fetchAll((a, b) => sb.from("payments")
          .select("*, customers(name, customer_code), invoices(invoice_number)")
          .order("payment_date", { ascending: false }).range(a, b)),
        // Money taken at the point of sale lives on the invoice itself, not in payments
        fetchAll((a, b) => sb.from("invoices")
          .select("id, invoice_number, customer_id, cash_amount, mpesa_amount, created_at, customers(name, customer_code)")
          .or("cash_amount.gt.0,mpesa_amount.gt.0")
          .order("created_at", { ascending: false }).range(a, b)),
      ]);
      const posRows = pos.map((i: any) => ({
        id: `pos-${i.id}`, source: "pos", payment_date: i.created_at,
        customers: i.customers, invoices: { invoice_number: i.invoice_number },
        cash_amount: i.cash_amount, mpesa_amount: i.mpesa_amount,
        amount: Number(i.cash_amount) + Number(i.mpesa_amount), status: "posted", notes: "Paid at point of sale",
      }));
      return [...debt.map((p: any) => ({ ...p, source: "allocation" })), ...posRows]
        .sort((x, y) => new Date(y.payment_date).getTime() - new Date(x.payment_date).getTime());
    },
  });
  const rows = useMemo(() => {
    const s = q.toLowerCase();
    return data.filter((p) => !s || [p.customers?.name, p.customers?.customer_code, p.invoices?.invoice_number, p.notes, String(p.amount)].some((v) => v?.toLowerCase?.().includes(s)));
  }, [data, q]);
  const pageRows = rows.slice(page * PAGE, page * PAGE + PAGE);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold font-heading flex items-center gap-2"><CreditCard className="h-6 w-6" />Payments — Posting & Adjustments</h1>
        <Input placeholder="Search customer, invoice, amount…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} className="max-w-xs" />
      </div>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Date</TableHead><TableHead>Customer</TableHead><TableHead>Invoice</TableHead>
            <TableHead>Method</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead><TableHead />
          </TableRow></TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={7} className="text-center py-8">Loading…</TableCell></TableRow>}
            {pageRows.map((p) => (
              <TableRow key={p.id}>
                <TableCell>{format(new Date(p.payment_date), "dd MMM yyyy HH:mm")}</TableCell>
                <TableCell>{p.customers?.name}</TableCell>
                <TableCell>{p.invoices?.invoice_number}</TableCell>
                <TableCell>{Number(p.mpesa_amount) > 0 && Number(p.cash_amount) > 0 ? "Cash + M-Pesa" : Number(p.mpesa_amount) > 0 ? "M-Pesa" : "Cash"}</TableCell>
                <TableCell className="text-right font-medium">{kes(p.amount)}</TableCell>
                <TableCell>
                  <Badge variant={p.status === "reversed" ? "destructive" : "secondary"}>{p.status?.toUpperCase()}</Badge>
                  <Badge variant="outline" className="ml-1 text-[10px]">{p.source === "pos" ? "At sale" : "Debt payment"}</Badge>
                </TableCell>
                <TableCell><Button asChild size="sm" variant="ghost"><Link to={p.source === "pos" ? `/payments/sale/${p.id.replace("pos-", "")}` : `/payments/${p.id}`}>Open</Link></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
      <div className="flex items-center justify-end gap-2 text-sm">
        <span className="text-muted-foreground">{rows.length} payments</span>
        <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Prev</Button>
        <Button size="sm" variant="outline" disabled={(page + 1) * PAGE >= rows.length} onClick={() => setPage(page + 1)}>Next</Button>
      </div>
    </div>
  );
}
