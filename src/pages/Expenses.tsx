import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useExpenses, useReverseExpense, getExpenseReceiptUrl, ExpenseRow } from "@/hooks/useExpenses";
import { ChartOfAccountsManager } from "@/components/ChartOfAccountsManager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Search, Eye, Trash2, Wallet, CalendarDays, TrendingUp, Clock, Paperclip } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { format, isToday, isThisMonth, isThisYear } from "date-fns";
import { toast } from "sonner";

const fmt = (n: number) => `KES ${Number(n || 0).toLocaleString()}`;
const PIE_COLORS = ["hsl(175 100% 25%)", "hsl(165 67% 55%)", "hsl(38 92% 55%)", "hsl(0 70% 60%)", "hsl(213 40% 55%)", "hsl(280 45% 55%)", "hsl(200 60% 50%)"];
const methodColor: Record<string, string> = {
  cash: "bg-success/10 text-success",
  bank: "bg-primary/10 text-primary",
  mpesa: "bg-accent/20 text-accent-foreground",
  credit: "bg-warning/10 text-warning",
};

export default function Expenses() {
  const navigate = useNavigate();
  const { data: expenses = [], isLoading } = useExpenses();
  const reverse = useReverseExpense();
  const [search, setSearch] = useState("");
  const [toDelete, setToDelete] = useState<ExpenseRow | null>(null);

  const kpis = useMemo(() => {
    let today = 0, month = 0, year = 0, outstanding = 0;
    expenses.forEach(e => {
      const d = new Date(e.expense_date);
      const total = Number(e.amount) + Number(e.vat_amount || 0);
      if (isToday(d)) today += total;
      if (isThisMonth(d)) month += total;
      if (isThisYear(d)) year += total;
      if (e.payment_method === "credit") outstanding += total;
    });
    return { today, month, year, outstanding };
  }, [expenses]);

  const monthlyData = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.filter(e => isThisYear(new Date(e.expense_date))).forEach(e => {
      const k = format(new Date(e.expense_date), "MMM");
      map[k] = (map[k] || 0) + Number(e.amount) + Number(e.vat_amount || 0);
    });
    const order = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return order.filter(m => map[m]).map(m => ({ month: m, amount: map[m] }));
  }, [expenses]);

  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach(e => {
      const name = e.accounts?.name || e.category;
      map[name] = (map[name] || 0) + Number(e.amount) + Number(e.vat_amount || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [expenses]);

  const methodData = useMemo(() => {
    const map: Record<string, number> = { cash: 0, bank: 0, mpesa: 0, credit: 0 };
    expenses.forEach(e => {
      const m = e.payment_method || "cash";
      map[m] = (map[m] || 0) + Number(e.amount) + Number(e.vat_amount || 0);
    });
    return Object.entries(map).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));
  }, [expenses]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return expenses;
    return expenses.filter(e =>
      (e.expense_no || "").toLowerCase().includes(q) ||
      (e.accounts?.name || e.category).toLowerCase().includes(q) ||
      (e.description || "").toLowerCase().includes(q) ||
      (e.reference_no || "").toLowerCase().includes(q) ||
      String(Number(e.amount) + Number(e.vat_amount || 0)).includes(q)
    );
  }, [expenses, search]);

  const viewReceipt = async (path: string) => {
    try { window.open(await getExpenseReceiptUrl(path), "_blank"); }
    catch (e: any) { toast.error(e.message); }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      await reverse.mutateAsync(toDelete.id);
      toast.success("Expense reversed & removed");
    } catch (e: any) { toast.error(e.message); }
    finally { setToDelete(null); }
  };

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold font-heading">Expenses</h1>
          <p className="text-sm text-muted-foreground">Capture, post &amp; report — every expense auto-posts to the General Ledger</p>
        </div>
        <Button onClick={() => navigate("/expenses/new")}><Plus className="h-4 w-4 mr-1" /> New Expense</Button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Today" value={kpis.today} icon={<CalendarDays className="h-4 w-4" />} />
        <KpiCard label="This Month" value={kpis.month} icon={<Wallet className="h-4 w-4" />} />
        <KpiCard label="This Year" value={kpis.year} icon={<TrendingUp className="h-4 w-4" />} />
        <KpiCard label="Outstanding (Credit)" value={kpis.outstanding} icon={<Clock className="h-4 w-4" />} accent />
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="list">Expense List</TabsTrigger>
          <TabsTrigger value="coa">Chart of Accounts</TabsTrigger>
        </TabsList>

        {/* Dashboard */}
        <TabsContent value="dashboard" className="space-y-4">
          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Monthly Expenses ({new Date().getFullYear()})</CardTitle></CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 16% 88%)" />
                      <XAxis dataKey="month" fontSize={12} />
                      <YAxis fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v: number) => fmt(v)} />
                      <Bar dataKey="amount" fill="hsl(175 100% 25%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Expenses by Category</CardTitle></CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e: any) => e.name}>
                        {categoryData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => fmt(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Cash vs Credit vs Digital</CardTitle></CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={methodData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={80}>
                        {methodData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Legend formatter={(v) => <span className="capitalize text-xs">{v}</span>} />
                      <Tooltip formatter={(v: number) => fmt(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Top Categories</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Category</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {categoryData.slice(0, 8).map((c) => (
                      <TableRow key={c.name}><TableCell className="text-sm">{c.name}</TableCell><TableCell className="text-right text-sm font-medium">{fmt(c.value)}</TableCell></TableRow>
                    ))}
                    {categoryData.length === 0 && <TableRow><TableCell colSpan={2} className="text-center text-sm text-muted-foreground py-6">No expenses yet</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Listing */}
        <TabsContent value="list">
          <Card>
            <CardHeader className="pb-3">
              <div className="relative max-w-md">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search by no, category, reference or amount..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8" />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Date</TableHead><TableHead>Expense No</TableHead><TableHead>Category</TableHead>
                  <TableHead>Reference</TableHead><TableHead className="text-right">Amount</TableHead>
                  <TableHead>Payment</TableHead><TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {filtered.map(e => {
                    const total = Number(e.amount) + Number(e.vat_amount || 0);
                    return (
                      <TableRow key={e.id}>
                        <TableCell className="text-xs text-muted-foreground">{format(new Date(e.expense_date), "dd MMM yy")}</TableCell>
                        <TableCell className="font-mono text-xs">{e.expense_no}</TableCell>
                        <TableCell className="text-sm font-medium">{e.accounts?.name || e.category}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{e.reference_no || "—"}</TableCell>
                        <TableCell className="text-right text-sm font-medium">{fmt(total)}</TableCell>
                        <TableCell><Badge className={`text-xs capitalize ${methodColor[e.payment_method || "cash"] || ""}`}>{e.payment_method || "cash"}</Badge></TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-0.5">
                            {e.attachment_url && (
                              <Button size="icon" variant="ghost" title="View receipt" onClick={() => viewReceipt(e.attachment_url!)}><Paperclip className="h-3.5 w-3.5" /></Button>
                            )}
                            <Button size="icon" variant="ghost" title="Delete / reverse" onClick={() => setToDelete(e)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">No expenses found</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Chart of Accounts */}
        <TabsContent value="coa">
          <ChartOfAccountsManager />
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reverse this expense?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete?.expense_no} — {toDelete?.accounts?.name || toDelete?.category}. A contra journal will be posted to keep the books balanced, and the expense will be removed from the list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Reverse &amp; Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function KpiCard({ label, value, icon, accent }: { label: string; value: number; icon: React.ReactNode; accent?: boolean }) {
  return (
    <Card className={accent ? "border-warning/30" : ""}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs text-muted-foreground">{label}</p>
          <span className={accent ? "text-warning" : "text-primary"}>{icon}</span>
        </div>
        <p className={`text-xl font-bold ${accent ? "text-warning" : ""}`}>{fmt(value)}</p>
      </CardContent>
    </Card>
  );
}
