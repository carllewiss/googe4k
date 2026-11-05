import { useState, useMemo, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useCustomers } from "@/hooks/useCustomers";
import { useInvoices } from "@/hooks/useInvoices";
import { usePayments } from "@/hooks/usePayments";
import { useCreditNotes } from "@/hooks/useCreditNotes";
import { useCustomerNotes, useCreateCustomerNote, useDeleteCustomerNote } from "@/hooks/useCustomerNotes";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft, CreditCard, Trash2, Plus, Pencil, Printer, FileText,
  Phone, Mail, Hash, Calendar, ChevronRight, ChevronLeft, MapPin, Ban,
} from "lucide-react";
import { differenceInDays, format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import PaymentDialog from "@/components/PaymentDialog";
import EditCustomerDialog from "@/components/EditCustomerDialog";
import CustomerStatementPrint from "@/components/CustomerStatementPrint";
import { InvoiceDetailPanel, CreditNoteDetailPanel } from "@/components/InvoiceDetailPanel";
import { unifiedPayments } from "@/lib/payments";
import { printDocument } from "@/lib/print";
import { toast } from "sonner";


const BUCKETS = [
  { key: "current", label: "0 - 30 Days", color: "hsl(var(--success))" },
  { key: "d30",     label: "31 - 60 Days", color: "hsl(var(--primary))" },
  { key: "d60",     label: "61 - 90 Days", color: "hsl(var(--warning))" },
  { key: "d90",     label: "Over 90 Days", color: "hsl(var(--destructive))" },
] as const;

export default function CustomerQuery() {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { data: customers = [] } = useCustomers();
  const { data: invoices = [] } = useInvoices();
  const { data: payments = [] } = usePayments();
  const { data: allCreditNotes = [] } = useCreditNotes();
  const { data: notes = [] } = useCustomerNotes(customerId);
  const createNote = useCreateCustomerNote();
  const delNote = useDeleteCustomerNote();

  const [newNote, setNewNote] = useState("");
  const [showPay, setShowPay] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [openInvoice, setOpenInvoice] = useState<any>(null);
  const [openCN, setOpenCN] = useState<any>(null);
  const [stmtFrom, setStmtFrom] = useState(format(startOfMonth(subMonths(new Date(), 5)), "yyyy-MM-dd"));
  const [stmtTo, setStmtTo] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const printRef = useRef<HTMLDivElement>(null);

  const customer = customers.find((c) => c.id === customerId);
  const customerInvoices = invoices.filter((i) => i.customer_id === customerId);
  const creditNotes = useMemo(
    () => (allCreditNotes as any[]).filter((c) => c.customer_id === customerId),
    [allCreditNotes, customerId]
  );
  const customerPayments = useMemo(
    () => unifiedPayments(customerInvoices, payments.filter((p) => p.customer_id === customerId)),
    [customerInvoices, payments, customerId]
  );


  const aging = useMemo(() => {
    const now = new Date();
    const buckets: Record<string, number> = { current: 0, d30: 0, d60: 0, d90: 0 };
    customerInvoices
      .filter((i) => Number(i.balance) > 0)
      .forEach((i) => {
        const days = differenceInDays(now, new Date(i.created_at));
        const bal = Number(i.balance);
        if (days <= 30) buckets.current += bal;
        else if (days <= 60) buckets.d30 += bal;
        else if (days <= 90) buckets.d60 += bal;
        else buckets.d90 += bal;
      });
    return buckets;
  }, [customerInvoices]);

  const totalDebt = Object.values(aging).reduce((s, v) => s + v, 0);
  const totalSales = customerInvoices.reduce((s, i) => s + Number(i.total), 0);
  const totalPaid = customerPayments.reduce((s, p) => s + Number(p.amount), 0);
  const lastPayment = customerPayments[0];
  const avgInvoice = customerInvoices.length ? totalSales / customerInvoices.length : 0;
  const unpaidInvoices = customerInvoices.filter((i) => Number(i.balance) > 0);
  /** Money the customer has overpaid — sits as a credit against future invoices. */
  const creditBalance = customerInvoices.reduce((s, i) => s + Math.max(0, -Number(i.balance)), 0);
  const creditLimit = Number(customer?.debt_limit || 0);
  const terms = Number(customer?.credit_terms || 30);
  const overdueInvoices = customerInvoices.filter(
    (i) => Number(i.balance) > 0 && differenceInDays(new Date(), new Date(i.created_at)) > terms
  );
  const overdueAmount = overdueInvoices.reduce((s, i) => s + Number(i.balance), 0);
  const availableCredit = Math.max(0, creditLimit - totalDebt);
  const limitUsedPct = creditLimit > 0 ? Math.min(100, (totalDebt / creditLimit) * 100) : 0;
  const lastPurchase = customerInvoices[0];



  const pieData = BUCKETS.map((b) => ({ name: b.label, value: aging[b.key] || 0, color: b.color }));
  const barData = pieData.map((d) => ({ name: d.name, value: d.value, color: d.color }));

  // Payment history (last 6 months)
  const paymentHistory = useMemo(() => {
    const months: { month: string; total: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      const start = startOfMonth(d).getTime();
      const end = endOfMonth(d).getTime();
      const total = customerPayments
        .filter((p) => {
          const t = new Date(p.payment_date).getTime();
          return t >= start && t <= end;
        })
        .reduce((s, p) => s + Number(p.amount), 0);
      months.push({ month: format(d, "MMM"), total });
    }
    return months;
  }, [customerPayments]);

  if (!customer) {
    return <div className="p-6 text-muted-foreground">Customer not found.</div>;
  }

  const initials = customer.name.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  const submitNote = async () => {
    if (!newNote.trim()) return;
    try {
      await createNote.mutateAsync({ customerId: customerId!, note: newNote });
      setNewNote("");
      toast.success("Note saved");
    } catch (e: any) { toast.error(e.message); }
  };

  const printStatement = () => {
    printDocument();
  };

  return (
    <div className="space-y-6">
      {/* Top breadcrumb + actions */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <button onClick={() => navigate("/customers")} className="hover:text-primary inline-flex items-center gap-1">
            <ArrowLeft className="h-3.5 w-3.5" /> Customers
          </button>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground font-medium">Customer Details</span>
        </div>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Printer className="h-4 w-4 mr-1.5" /> Statement
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72" align="end">
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">From</Label>
                  <Input type="date" value={stmtFrom} onChange={(e) => setStmtFrom(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">To</Label>
                  <Input type="date" value={stmtTo} onChange={(e) => setStmtTo(e.target.value)} />
                </div>
                <Button className="w-full" size="sm" onClick={printStatement}>
                  <Printer className="h-4 w-4 mr-1.5" /> Print Statement
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          <Button variant="outline" size="sm" onClick={() => setShowEdit(true)}>
            <Pencil className="h-4 w-4 mr-1.5" /> {isAdmin ? "Edit Customer" : "Update Contact"}
          </Button>

          {totalDebt > 0 && (
            <Button size="sm" onClick={() => setShowPay(true)}>
              <CreditCard className="h-4 w-4 mr-1.5" /> Take Payment
            </Button>
          )}
        </div>
      </div>

      {/* Hero header card */}
      <Card className="overflow-hidden">
        <div className="h-20 bg-gradient-to-r from-primary to-primary-glow" />
        <CardContent className="p-6 -mt-12">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div className="flex items-end gap-4">
              <div className="h-20 w-20 rounded-2xl bg-card border-4 border-card shadow-elegant text-primary flex items-center justify-center text-2xl font-bold shrink-0">
                {initials}
              </div>
              <div className="pb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-bold tracking-tight">{customer.name}</h1>
                  {(customer as any).is_suspended ? (
                    <Badge variant="destructive" className="gap-1"><Ban className="h-3 w-3" /> Suspended</Badge>
                  ) : (
                    <Badge className="bg-success/10 text-success hover:bg-success/15">Active</Badge>
                  )}
                  {customer.kra_pin && <Badge className="bg-primary/10 text-primary hover:bg-primary/15">Taxable</Badge>}
                  {customer.credit_terms > 0 && <Badge variant="outline">{customer.credit_terms}d Terms</Badge>}
                  {customer.visit_count >= 3 && <Badge className="bg-success/10 text-success hover:bg-success/15">Repeat</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-1 font-mono">{customer.customer_code}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Customer since {format(new Date(customer.created_at), "dd MMM yyyy")}
                  {lastPurchase && ` · Last purchase ${format(new Date(lastPurchase.created_at), "dd MMM yyyy")}`}
                </p>
              </div>
            </div>
            <div className="lg:text-right">
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Outstanding Balance</p>
              {totalDebt > 0 ? (
                <Link to="/invoices" className="block">
                  <p className="text-3xl font-bold text-destructive hover:underline">KES {totalDebt.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-1">{unpaidInvoices.length} unpaid invoice{unpaidInvoices.length !== 1 ? "s" : ""} · click to view</p>
                </Link>
              ) : (
                <p className="text-3xl font-bold text-success">KES 0</p>
              )}
              {creditBalance > 0 && (
                <p className="text-sm font-semibold text-success mt-1">
                  Credit on account: KES {creditBalance.toLocaleString()} CR
                </p>
              )}
            </div>
          </div>


          <div className="mt-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-x-6 gap-y-4 pt-6 border-t">
            <Field icon={<Phone className="h-3.5 w-3.5" />} label="Phone" value={customer.phone || "—"} />
            <Field icon={<Mail className="h-3.5 w-3.5" />} label="Email" value={(customer as any).email || "—"} />
            <Field icon={<MapPin className="h-3.5 w-3.5" />} label="Location" value={(customer as any).location || "—"} />
            <Field icon={<FileText className="h-3.5 w-3.5" />} label="KRA PIN" value={customer.kra_pin || "—"} mono />
            <Field icon={<CreditCard className="h-3.5 w-3.5" />} label="Credit Limit" value={`KES ${creditLimit.toLocaleString()}`} />
            <Field icon={<Calendar className="h-3.5 w-3.5" />} label="Payment Terms" value={`${customer.credit_terms || 0} Days`} />
          </div>
        </CardContent>
      </Card>

      {/* Credit position */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Credit Limit</p>
            <p className="text-xl font-bold mt-1">KES {creditLimit.toLocaleString()}</p>
            <p className="text-[11px] text-muted-foreground mt-1">{customer.credit_terms || 0} day terms</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Total Debt Owed</p>
            <p className="text-xl font-bold mt-1 text-destructive">KES {totalDebt.toLocaleString()}</p>
            <Progress value={limitUsedPct} className="h-1.5 mt-2" />
            <p className="text-[11px] text-muted-foreground mt-1">{limitUsedPct.toFixed(1)}% of limit used</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Overdue Amount</p>
            <p className={`text-xl font-bold mt-1 ${overdueAmount > 0 ? "text-destructive" : "text-success"}`}>
              KES {overdueAmount.toLocaleString()}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">{overdueInvoices.length} invoice(s) overdue</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Available Credit</p>
            <p className="text-xl font-bold mt-1 text-success">KES {availableCredit.toLocaleString()}</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              {creditLimit > 0 ? `${(100 - limitUsedPct).toFixed(1)}% of limit available` : "No credit limit set"}
            </p>
          </CardContent>
        </Card>
      </div>


      {/* Quick metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <MetricCard label="Total Invoices" value={customerInvoices.length.toString()} sub={`KES ${totalSales.toLocaleString()}`} />
        <MetricCard label="Total Payments" value={customerPayments.length.toString()} sub={`KES ${totalPaid.toLocaleString()}`} />
        <MetricCard label="Outstanding" value={unpaidInvoices.length.toString()} sub={`KES ${totalDebt.toLocaleString()}`} accent={totalDebt > 0 ? "destructive" : undefined} />
        <MetricCard label="Avg Invoice" value={`KES ${Math.round(avgInvoice).toLocaleString()}`} />
        <MetricCard label="Last Payment" value={lastPayment ? format(new Date(lastPayment.payment_date), "dd MMM yy") : "—"} sub={lastPayment ? `KES ${Number(lastPayment.amount).toLocaleString()}` : ""} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Aging Summary</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="h-44 w-44 relative shrink-0">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={pieData.filter(d => d.value > 0).length ? pieData : [{ name: "None", value: 1, color: "hsl(var(--muted))" }]}
                      dataKey="value" innerRadius={50} outerRadius={75} paddingAngle={2}>
                      {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => `KES ${v.toLocaleString()}`} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                  <p className="text-base font-bold">KES {(totalDebt / 1000).toFixed(0)}K</p>
                  <p className="text-[10px] text-muted-foreground">Outstanding</p>
                </div>
              </div>
              <div className="space-y-2 text-xs flex-1">
                {BUCKETS.map((b) => (
                  <div key={b.key} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: b.color }} />
                      <span className="text-muted-foreground">{b.label}</span>
                    </div>
                    <span className="font-mono font-medium">KES {(aging[b.key] || 0).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Outstanding by Age</CardTitle></CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer>
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis fontSize={10} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : `${v}`} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: number) => `KES ${v.toLocaleString()}`} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {barData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Payment History (6 mo)</CardTitle></CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer>
                <BarChart data={paymentHistory}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis fontSize={10} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : `${v}`} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: number) => `KES ${v.toLocaleString()}`} />
                  <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabbed history */}
      <Card>
        <Tabs defaultValue="invoices">
          <TabsList className="bg-transparent border-b w-full justify-start h-auto p-0 rounded-none">
            <TabsTrigger value="invoices" className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none px-4 py-3 text-sm">
              Invoices ({customerInvoices.length})
            </TabsTrigger>
            <TabsTrigger value="outstanding" className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none px-4 py-3 text-sm">
              Outstanding ({unpaidInvoices.length})
            </TabsTrigger>
            <TabsTrigger value="payments" className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none px-4 py-3 text-sm">
              Payments ({customerPayments.length})
            </TabsTrigger>
            <TabsTrigger value="credit_notes" className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none px-4 py-3 text-sm">
              Credit Notes ({creditNotes.length})
            </TabsTrigger>
            <TabsTrigger value="notes" className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none px-4 py-3 text-sm">
              Notes ({notes.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="invoices" className="m-0 p-2">
            <InvoiceTable invoices={customerInvoices} terms={terms} onOpen={setOpenInvoice} />
          </TabsContent>
          <TabsContent value="outstanding" className="m-0 p-2">
            <InvoiceTable invoices={unpaidInvoices} terms={terms} onOpen={setOpenInvoice} emptyText="No outstanding invoices. 🎉" />
          </TabsContent>
          <TabsContent value="credit_notes" className="m-0 p-2">
            <CreditNoteTable notes={creditNotes} onOpen={setOpenCN} />
          </TabsContent>

          <TabsContent value="payments" className="m-0 p-2">
            {customerPayments.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-8">No payments yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Cash</TableHead>
                    <TableHead className="text-right">M-Pesa</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customerPayments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">{format(new Date(p.payment_date), "dd/MM/yyyy HH:mm")}</TableCell>
                      <TableCell className="font-mono text-xs">{p.invoice_number || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">{p.source === "pos" ? "At sale" : "Debt payment"}</Badge>
                        {p.status === "reversed" && <Badge variant="destructive" className="text-[10px] ml-1">Reversed</Badge>}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-success">+ KES {Number(p.amount).toLocaleString()}</TableCell>
                      <TableCell className="text-right text-sm">{Number(p.cash_amount).toLocaleString()}</TableCell>
                      <TableCell className="text-right text-sm">{Number(p.mpesa_amount).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>

              </Table>
            )}
          </TabsContent>
          <TabsContent value="notes" className="m-0 p-4 space-y-4">
            <div className="flex gap-2 max-w-2xl">
              <Textarea
                placeholder="Add a note (e.g. payment terms, special arrangement)..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                rows={2}
                className="text-sm flex-1"
              />
              <Button size="sm" onClick={submitNote} disabled={createNote.isPending || !newNote.trim()}>
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            </div>
            <div className="space-y-2 max-w-2xl">
              {notes.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No notes yet.</p>
              ) : (
                notes.map((n: any) => (
                  <div key={n.id} className="p-3 bg-muted/30 border-l-2 border-primary rounded text-sm flex justify-between items-start gap-3">
                    <div className="flex-1">
                      <p>{n.note}</p>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {format(new Date(n.created_at), "dd MMM yyyy HH:mm")}
                      </span>
                    </div>
                    {isAdmin && (
                      <Button size="icon" variant="ghost" className="h-7 w-7"
                        onClick={() => delNote.mutate({ id: n.id, customerId: customerId! })}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </Card>

      {showPay && (
        <PaymentDialog
          open={showPay} onOpenChange={setShowPay}
          customerId={customer.id} customerName={customer.name} currentBalance={totalDebt}
        />
      )}
      {showEdit && (
        <EditCustomerDialog open={showEdit} onOpenChange={setShowEdit} customer={customer} canEditCredit={isAdmin} />
      )}

      {/* Invoice detail modal */}
      <Dialog open={!!openInvoice} onOpenChange={(o) => !o && setOpenInvoice(null)}>
        <DialogContent className="max-w-3xl p-0 max-h-[88vh] overflow-auto">
          {openInvoice && (
            <InvoiceDetailPanel
              invoice={openInvoice}
              payments={payments as any}
              isAdmin={isAdmin}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Credit note detail modal */}
      <Dialog open={!!openCN} onOpenChange={(o) => !o && setOpenCN(null)}>
        <DialogContent className="max-w-3xl p-0 max-h-[88vh] overflow-auto">
          {openCN && <CreditNoteDetailPanel note={openCN} />}
        </DialogContent>
      </Dialog>


      {/* Print only */}
      <div ref={printRef}>
        <CustomerStatementPrint
          customer={customer}
          invoices={customerInvoices}
          payments={customerPayments}
          fromDate={new Date(stmtFrom)}
          toDate={new Date(stmtTo)}
        />
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #statement-print, #statement-print * { visibility: visible; }
          #statement-print { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
    </div>
  );
}

function Field({ icon, label, value, mono }: { icon: React.ReactNode; label: string; value: string; mono?: boolean }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] text-muted-foreground flex items-center gap-1">{icon}{label}</p>
      <p className={`text-sm font-medium ${mono ? "font-mono uppercase" : ""}`}>{value}</p>
    </div>
  );
}

function MetricCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: "destructive" }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={`text-lg font-bold mt-1 ${accent === "destructive" ? "text-destructive" : ""}`}>{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

const PAGE_SIZE = 10;

function Pager({ page, pages, setPage, total }: { page: number; pages: number; setPage: (n: number) => void; total: number }) {
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-3 py-2 border-t">
      <p className="text-xs text-muted-foreground">
        Page {page} of {pages} · {total} record{total !== 1 ? "s" : ""}
      </p>
      <div className="flex items-center gap-1">
        <Button size="icon" variant="outline" className="h-7 w-7" disabled={page <= 1} onClick={() => setPage(page - 1)}>
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon" variant="outline" className="h-7 w-7" disabled={page >= pages} onClick={() => setPage(page + 1)}>
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function InvoiceTable({
  invoices, terms, onOpen, emptyText = "No invoices yet.",
}: { invoices: any[]; terms: number; onOpen: (inv: any) => void; emptyText?: string }) {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(invoices.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const rows = invoices.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  if (invoices.length === 0)
    return <p className="text-center text-muted-foreground text-sm py-8">{emptyText}</p>;

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Invoice #</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Paid</TableHead>
            <TableHead className="text-right">Balance</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((inv) => {
            const overdue = Number(inv.balance) > 0 && differenceInDays(new Date(), new Date(inv.created_at)) > terms;
            const status = overdue ? "overdue" : inv.status;
            return (
              <TableRow key={inv.id} className="cursor-pointer" onClick={() => onOpen(inv)}>
                <TableCell className="font-mono text-xs">{format(new Date(inv.created_at), "dd/MM/yyyy")}</TableCell>
                <TableCell className="font-semibold text-primary">{inv.invoice_number}</TableCell>
                <TableCell className="text-right">KES {Number(inv.total).toLocaleString()}</TableCell>
                <TableCell className="text-right">KES {Number(inv.paid_amount).toLocaleString()}</TableCell>
                <TableCell className={`text-right font-semibold ${Number(inv.balance) > 0 ? "text-destructive" : ""}`}>
                  KES {Number(inv.balance).toLocaleString()}
                </TableCell>
                <TableCell>
                  <Badge className={
                    status === "paid" ? "bg-success/10 text-success hover:bg-success/15" :
                    status === "partial" ? "bg-warning/10 text-warning hover:bg-warning/15" :
                    "bg-destructive/10 text-destructive hover:bg-destructive/15"
                  }>{status}</Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <Pager page={current} pages={pages} setPage={setPage} total={invoices.length} />
    </div>
  );
}

function CreditNoteTable({ notes, onOpen }: { notes: any[]; onOpen: (cn: any) => void }) {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(notes.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const rows = notes.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  if (notes.length === 0)
    return <p className="text-center text-muted-foreground text-sm py-8">No credit notes issued for this customer.</p>;

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Credit Note #</TableHead>
            <TableHead>Against Invoice</TableHead>
            <TableHead>Settlement</TableHead>
            <TableHead className="text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((cn) => (
            <TableRow key={cn.id} className="cursor-pointer" onClick={() => onOpen(cn)}>
              <TableCell className="font-mono text-xs">{format(new Date(cn.created_at), "dd/MM/yyyy")}</TableCell>
              <TableCell className="font-semibold text-primary">{cn.credit_note_number}</TableCell>
              <TableCell className="text-sm">{cn.invoices?.invoice_number || "—"}</TableCell>
              <TableCell>
                <Badge variant="outline" className="capitalize text-[10px]">
                  {String(cn.refund_method).replace(/_/g, " ")}
                </Badge>
              </TableCell>
              <TableCell className="text-right font-semibold text-destructive">
                - KES {Number(cn.total).toLocaleString()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Pager page={current} pages={pages} setPage={setPage} total={notes.length} />
    </div>
  );
}
