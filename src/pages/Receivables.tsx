import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { differenceInDays } from "date-fns";
import {
  Search, Download, Eye, CreditCard, FileText, Phone, Mail, Hash, MapPin, X, ChevronLeft, ChevronRight, Printer,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { useCustomers } from "@/hooks/useCustomers";
import { useInvoices } from "@/hooks/useInvoices";
import { useAuth } from "@/hooks/useAuth";
import PaymentDialog from "@/components/PaymentDialog";
import { printDocument } from "@/lib/print";
import { COMPANY } from "@/lib/company";

const BUCKETS = [
  { key: "current", label: "Current (0 - 13 Days)", short: "Current", color: "hsl(var(--success))" },
  { key: "d14", label: "14 Days (14 - 29)", short: "14 Days", color: "hsl(var(--primary))" },
  { key: "d30", label: "30 Days (30 - 59)", short: "30 Days", color: "hsl(var(--warning))" },
  { key: "d60", label: "60 Days (60 - 89)", short: "60 Days", color: "hsl(24 90% 55%)" },
  { key: "d90", label: "90+ Days (Over 90)", short: "90+ Days", color: "hsl(var(--destructive))" },
] as const;

type BucketKey = typeof BUCKETS[number]["key"];
const emptyBuckets = (): Record<BucketKey, number> => ({ current: 0, d14: 0, d30: 0, d60: 0, d90: 0 });

const fmt = (n: number) => `KSh ${Math.round(n).toLocaleString()}`;

function bucketOf(days: number): BucketKey {
  if (days < 14) return "current";
  if (days < 30) return "d14";
  if (days < 60) return "d30";
  if (days < 90) return "d60";
  return "d90";
}

function riskOf(usage: number, d90: number) {
  if (usage >= 100 || d90 > 0) return { label: "Critical", cls: "bg-destructive/10 text-destructive" };
  if (usage >= 75) return { label: "High", cls: "bg-destructive/10 text-destructive" };
  if (usage >= 40) return { label: "Medium", cls: "bg-warning/10 text-warning" };
  return { label: "Low", cls: "bg-success/10 text-success" };
}

const PAGE_SIZE = 10;

export default function Receivables() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { data: customers = [], isLoading: lc } = useCustomers();
  const { data: invoices = [], isLoading: li } = useInvoices();

  const [search, setSearch] = useState("");
  const [bucketFilter, setBucketFilter] = useState<"all" | BucketKey>("all");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [payFor, setPayFor] = useState<any | null>(null);

  const debtors = useMemo(() => {
    const today = new Date();
    return customers
      .map((c: any) => {
        const custInvoices = invoices.filter((i: any) => i.customer_id === c.id);
        const open = custInvoices.filter((i: any) => Number(i.balance) > 0);
        const buckets = emptyBuckets();
        open.forEach((i: any) => {
          const days = differenceInDays(today, new Date(i.created_at));
          buckets[bucketOf(days)] += Number(i.balance);
        });
        const outstanding = open.reduce((s: number, i: any) => s + Number(i.balance), 0);
        const limit = Number(c.debt_limit) || 0;
        const usage = limit > 0 ? (outstanding / limit) * 100 : outstanding > 0 ? 100 : 0;
        return {
          customer: c,
          invoices: custInvoices,
          open,
          buckets,
          outstanding,
          limit,
          usage,
          available: Math.max(limit - outstanding, 0),
          risk: riskOf(usage, buckets.d90),
        };
      })
      .filter((d) => d.outstanding > 0)
      .sort((a, b) => b.outstanding - a.outstanding);
  }, [customers, invoices]);

  const totals = useMemo(() => {
    const t = emptyBuckets();
    const counts = emptyBuckets();
    let total = 0;
    debtors.forEach((d) => {
      total += d.outstanding;
      BUCKETS.forEach((b) => {
        t[b.key] += d.buckets[b.key];
        if (d.buckets[b.key] > 0) counts[b.key] += 1;
      });
    });
    return { t, counts, total };
  }, [debtors]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return debtors.filter((d) => {
      if (bucketFilter !== "all" && d.buckets[bucketFilter] <= 0) return false;
      if (!q) return true;
      const c = d.customer;
      return [c.name, c.customer_code, c.phone, c.email, c.kra_pin]
        .filter(Boolean)
        .some((v: string) => String(v).toLowerCase().includes(q));
    });
  }, [debtors, search, bucketFilter]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const selected = debtors.find((d) => d.customer.id === selectedId) || null;

  const barData = BUCKETS.map((b) => ({ name: b.short, value: Math.round(totals.t[b.key]), fill: b.color }));
  const pieData = BUCKETS.map((b) => ({ name: b.label, value: Math.round(totals.t[b.key]), color: b.color })).filter((d) => d.value > 0);

  const exportCsv = () => {
    const header = ["Customer", "Code", "Phone", "Credit Limit", "Outstanding", ...BUCKETS.map((b) => b.short), "Credit Used %", "Risk"];
    const rows = filtered.map((d) => [
      d.customer.name, d.customer.customer_code, d.customer.phone || "",
      d.limit, Math.round(d.outstanding),
      ...BUCKETS.map((b) => Math.round(d.buckets[b.key])),
      Math.round(d.usage), d.risk.label,
    ]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `debtor-list-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (lc || li) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-heading">Debtor List (Accounts Receivable)</h1>
          <p className="text-sm text-muted-foreground">Customers with outstanding balances — highest debt first</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv}><Download className="h-4 w-4 mr-1" /> Export CSV</Button>
          <Button variant="outline" size="sm" onClick={() => printDocument()}><Printer className="h-4 w-4 mr-1" /> Export PDF</Button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Total Outstanding</p>
            <p className="text-xl font-bold">{fmt(totals.total)}</p>
            <p className="text-xs text-muted-foreground">{debtors.length} customers</p>
          </CardContent>
        </Card>
        {BUCKETS.map((b) => (
          <Card key={b.key} className="border-l-4" style={{ borderLeftColor: b.color }}>
            <CardContent className="p-4">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{b.short}</p>
              <p className="text-xl font-bold" style={{ color: b.color }}>{fmt(totals.t[b.key])}</p>
              <p className="text-xs text-muted-foreground">{totals.counts[b.key]} customers</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm uppercase tracking-wide">Outstanding by aging bucket</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis dataKey="name" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={(v) => `${Math.round(v / 1000)}K`} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm uppercase tracking-wide">Outstanding by aging (%)</CardTitle></CardHeader>
          <CardContent className="h-64">
            {pieData.length === 0 ? (
              <p className="text-sm text-muted-foreground">No outstanding balances.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                    {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Legend layout="vertical" align="right" verticalAlign="middle" iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid xl:grid-cols-3 gap-4">
        {/* Debtor table */}
        <Card className="xl:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search customer, phone, PIN..." className="pl-9" value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
              </div>
              <Select value={bucketFilter} onValueChange={(v) => { setBucketFilter(v as any); setPage(0); }}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All aging buckets</SelectItem>
                  {BUCKETS.map((b) => <SelectItem key={b.key} value={b.key}>{b.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Limit</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  {BUCKETS.map((b) => <TableHead key={b.key} className="text-right hidden lg:table-cell">{b.short}</TableHead>)}
                  <TableHead className="text-right">Used</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((d, i) => (
                  <TableRow
                    key={d.customer.id}
                    className={`cursor-pointer ${selectedId === d.customer.id ? "bg-muted/50" : ""}`}
                    onClick={() => setSelectedId(d.customer.id)}
                  >
                    <TableCell className="text-xs text-muted-foreground">{page * PAGE_SIZE + i + 1}</TableCell>
                    <TableCell>
                      <p className="font-medium text-sm">{d.customer.name}</p>
                      <p className="text-xs text-muted-foreground">{d.customer.customer_code} · {d.customer.phone || "No phone"}</p>
                    </TableCell>
                    <TableCell className="text-right text-sm">{d.limit.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-sm font-bold text-destructive">{Math.round(d.outstanding).toLocaleString()}</TableCell>
                    {BUCKETS.map((b) => (
                      <TableCell key={b.key} className="text-right text-xs hidden lg:table-cell"
                        style={{ color: d.buckets[b.key] > 0 ? b.color : undefined }}>
                        {Math.round(d.buckets[b.key]).toLocaleString()}
                      </TableCell>
                    ))}
                    <TableCell className="text-right">
                      <span className="text-xs font-medium">{Math.round(d.usage)}%</span>
                      <Progress value={Math.min(d.usage, 100)} className="h-1 mt-1" />
                    </TableCell>
                    <TableCell><Badge className={d.risk.cls}>{d.risk.label}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setPayFor(d); }}>
                        <CreditCard className="h-3.5 w-3.5 mr-1" /> Pay
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {pageRows.length === 0 && (
                  <TableRow><TableCell colSpan={10} className="text-center text-sm text-muted-foreground py-8">No debtors match your filters.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
          <div className="flex items-center justify-between p-3 border-t text-xs text-muted-foreground">
            <span>Showing {filtered.length === 0 ? 0 : page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length} customers</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
              <span>Page {page + 1} / {pages}</span>
              <Button variant="outline" size="sm" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        </Card>

        {/* Detail panel */}
        <Card className="h-fit">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base">Customer Details</CardTitle>
            {selected && <Button variant="ghost" size="icon" onClick={() => setSelectedId(null)}><X className="h-4 w-4" /></Button>}
          </CardHeader>
          <CardContent className="space-y-4">
            {!selected ? (
              <p className="text-sm text-muted-foreground">Select a customer from the debtor list to see aging, recent invoices and available actions.</p>
            ) : (
              <>
                <div className="flex items-start gap-3">
                  <div className="h-11 w-11 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                    {selected.customer.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold leading-tight">{selected.customer.name}</p>
                    <p className="text-xs text-muted-foreground">{selected.customer.customer_code}</p>
                  </div>
                  <Badge className={selected.customer.is_suspended ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}>
                    {selected.customer.is_suspended ? "Suspended" : "Active"}
                  </Badge>
                </div>

                <div className="space-y-1 text-sm">
                  {selected.customer.phone && <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-muted-foreground" />{selected.customer.phone}</p>}
                  {selected.customer.email && <p className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-muted-foreground" />{selected.customer.email}</p>}
                  {selected.customer.kra_pin && <p className="flex items-center gap-2"><Hash className="h-3.5 w-3.5 text-muted-foreground" />KRA PIN: {selected.customer.kra_pin}</p>}
                  {selected.customer.location && <p className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-muted-foreground" />{selected.customer.location}</p>}
                </div>

                <div className="space-y-2 border-t pt-3 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Credit limit</span><span>{fmt(selected.limit)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Outstanding</span><span className="text-destructive font-semibold">{fmt(selected.outstanding)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Available credit</span><span>{fmt(selected.available)}</span></div>
                  <div>
                    <div className="flex justify-between text-xs mb-1"><span className="text-muted-foreground">Credit used</span><span>{Math.round(selected.usage)}%</span></div>
                    <Progress value={Math.min(selected.usage, 100)} className="h-2" />
                  </div>
                </div>

                <div className="border-t pt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Aging breakdown</p>
                  <div className="space-y-1 text-sm">
                    {BUCKETS.map((b) => (
                      <div key={b.key} className="flex items-center justify-between">
                        <span className="flex items-center gap-2 text-xs">
                          <span className="h-2 w-2 rounded-full" style={{ background: b.color }} />{b.label}
                        </span>
                        <span className="text-xs">
                          {Math.round(selected.buckets[b.key]).toLocaleString()}
                          {selected.outstanding > 0 && ` (${Math.round((selected.buckets[b.key] / selected.outstanding) * 100)}%)`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t pt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Recent invoices</p>
                  <div className="space-y-1">
                    {selected.open.slice(0, 5).map((inv: any) => (
                      <div key={inv.id} className="flex items-center justify-between text-xs">
                        <span className="font-mono">{inv.invoice_number}</span>
                        <span>{Math.round(Number(inv.balance)).toLocaleString()}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {differenceInDays(new Date(), new Date(inv.created_at))}d
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 border-t pt-3">
                  <Button variant="outline" size="sm" onClick={() => navigate(`/customers/${selected.customer.id}`)}>
                    <Eye className="h-4 w-4 mr-1" /> View 360
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => navigate(`/customers/${selected.customer.id}`)}>
                    <FileText className="h-4 w-4 mr-1" /> Statement
                  </Button>
                  <Button size="sm" className="col-span-2" onClick={() => setPayFor(selected)}>
                    <CreditCard className="h-4 w-4 mr-1" /> Receive Payment
                  </Button>
                </div>
                {!isAdmin && (
                  <p className="text-[11px] text-muted-foreground">You can receive payments and print statements. Credit limits and terms are admin-only.</p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {payFor && (
        <PaymentDialog
          open={!!payFor}
          onOpenChange={(o: boolean) => !o && setPayFor(null)}
          customerId={payFor.customer.id}
          customerName={payFor.customer.name}
          currentBalance={payFor.outstanding}
        />
      )}

      {/* Printable debtors report (screen-hidden, print-only) */}
      <div id="debtors-print" className="hidden print:block text-black text-[11px]">
        <div style={{ textAlign: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{COMPANY.name}</div>
          <div>{COMPANY.address} · {COMPANY.phone} · KRA PIN: {COMPANY.kraPin}</div>
          <div style={{ fontSize: 13, fontWeight: 700, marginTop: 6 }}>DEBTORS (ACCOUNTS RECEIVABLE) REPORT</div>
          <div>As at {new Date().toLocaleDateString("en-GB")} · Total outstanding: {fmt(totals.total)} · {filtered.length} customers</div>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["#", "Customer", "Code", "Phone", "Limit", "Outstanding", ...BUCKETS.map((b) => b.short), "Used %", "Risk"].map((h) => (
                <th key={h} style={{ border: "1px solid #000", padding: "3px 4px", textAlign: "left", background: "#eee" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((d, i) => (
              <tr key={d.customer.id}>
                <td style={{ border: "1px solid #999", padding: "3px 4px" }}>{i + 1}</td>
                <td style={{ border: "1px solid #999", padding: "3px 4px" }}>{d.customer.name}</td>
                <td style={{ border: "1px solid #999", padding: "3px 4px" }}>{d.customer.customer_code}</td>
                <td style={{ border: "1px solid #999", padding: "3px 4px" }}>{d.customer.phone || "-"}</td>
                <td style={{ border: "1px solid #999", padding: "3px 4px", textAlign: "right" }}>{d.limit.toLocaleString()}</td>
                <td style={{ border: "1px solid #999", padding: "3px 4px", textAlign: "right", fontWeight: 700 }}>{Math.round(d.outstanding).toLocaleString()}</td>
                {BUCKETS.map((b) => (
                  <td key={b.key} style={{ border: "1px solid #999", padding: "3px 4px", textAlign: "right" }}>{Math.round(d.buckets[b.key]).toLocaleString()}</td>
                ))}
                <td style={{ border: "1px solid #999", padding: "3px 4px", textAlign: "right" }}>{Math.round(d.usage)}%</td>
                <td style={{ border: "1px solid #999", padding: "3px 4px" }}>{d.risk.label}</td>
              </tr>
            ))}
            <tr>
              <td colSpan={5} style={{ border: "1px solid #000", padding: "3px 4px", fontWeight: 700, textAlign: "right" }}>TOTAL</td>
              <td style={{ border: "1px solid #000", padding: "3px 4px", textAlign: "right", fontWeight: 700 }}>
                {Math.round(filtered.reduce((s, d) => s + d.outstanding, 0)).toLocaleString()}
              </td>
              {BUCKETS.map((b) => (
                <td key={b.key} style={{ border: "1px solid #000", padding: "3px 4px", textAlign: "right", fontWeight: 700 }}>
                  {Math.round(filtered.reduce((s, d) => s + d.buckets[b.key], 0)).toLocaleString()}
                </td>
              ))}
              <td style={{ border: "1px solid #000" }} colSpan={2} />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
