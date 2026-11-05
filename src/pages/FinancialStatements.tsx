import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TrendingUp, TrendingDown, Scale, Wallet, Receipt, Printer, Download } from "lucide-react";
import { format, startOfMonth, startOfYear, endOfMonth } from "date-fns";
import { useGLFinancials } from "@/hooks/useAccounting";
import { computePL, computeBalanceSheet, computeCashFlow, computeVat, type Period, type LineItem } from "@/lib/financials";

const fmt = (n: number) => `KES ${Math.round(Number(n || 0)).toLocaleString()}`;
const iso = (d: Date) => format(d, "yyyy-MM-dd");

type Preset = "month" | "fy" | "ytd" | "all" | "custom";

// Accounting period / financial year: 1 January – 31 December
const FY_START_MONTH = 0; // January
const fyStart = (year: number) => new Date(year, FY_START_MONTH, 1);
const fyEnd = (year: number) => new Date(year, 11, 31);

export default function FinancialStatements() {
  const thisYear = new Date().getFullYear();
  const [preset, setPreset] = useState<Preset>("fy");
  const [fyYear, setFyYear] = useState(thisYear);
  const [customFrom, setCustomFrom] = useState(iso(startOfMonth(new Date())));
  const [customTo, setCustomTo] = useState(iso(new Date()));

  const period: Period = useMemo(() => {
    const today = new Date();
    if (preset === "month") return { from: iso(startOfMonth(today)), to: iso(endOfMonth(today)) };
    if (preset === "fy") return { from: iso(fyStart(fyYear)), to: iso(fyEnd(fyYear)) };
    if (preset === "ytd") return { from: iso(startOfYear(today)), to: iso(today) };
    if (preset === "all") return { from: "1900-01-01", to: iso(today) };
    return { from: customFrom, to: customTo };
  }, [preset, fyYear, customFrom, customTo]);


  const { data: rows = [], isLoading } = useGLFinancials(period.from, period.to);

  const pl = useMemo(() => computePL(rows), [rows]);
  const bs = useMemo(() => computeBalanceSheet(rows), [rows]);
  const cf = useMemo(() => computeCashFlow(rows), [rows]);
  const vat = useMemo(() => computeVat(rows), [rows]);


  const exportCsv = () => {
    const rows: string[][] = [];
    rows.push(["4K Smart Solutions Ltd — Financial Statements"]);
    rows.push([`Period: ${period.from} to ${period.to}`]);
    rows.push([]);
    rows.push(["PROFIT & LOSS"]);
    pl.sales.forEach((i) => rows.push([i.name, String(Math.round(i.amount))]));
    rows.push(["Total Revenue", String(Math.round(pl.salesTotal))]);
    pl.cogs.forEach((i) => rows.push([i.name, String(-Math.round(i.amount))]));
    rows.push(["Gross Profit", String(Math.round(pl.grossProfit))]);
    pl.otherIncome.forEach((i) => rows.push([i.name, String(Math.round(i.amount))]));
    pl.opex.forEach((i) => rows.push([i.name, String(-Math.round(i.amount))]));
    pl.finance.forEach((i) => rows.push([i.name, String(-Math.round(i.amount))]));
    rows.push(["Net Profit", String(Math.round(pl.netProfit))]);
    rows.push([]);
    rows.push(["BALANCE SHEET (as of " + period.to + ")"]);
    rows.push(["ASSETS"]);
    bs.assets.forEach((i) => rows.push([i.name, String(Math.round(i.amount))]));
    rows.push(["Total Assets", String(Math.round(bs.assetsTotal))]);
    rows.push(["LIABILITIES"]);
    bs.liabilities.forEach((i) => rows.push([i.name, String(Math.round(i.amount))]));
    rows.push(["EQUITY"]);
    bs.equity.forEach((i) => rows.push([i.name, String(Math.round(i.amount))]));
    rows.push(["Total Liabilities + Equity", String(Math.round(bs.liabilitiesTotal + bs.equityTotal))]);
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `financials-${period.from}-to-${period.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-bold font-heading">Accountant Dashboard</h1>
          <p className="text-sm text-muted-foreground">GL-driven financial statements — P&L, Balance Sheet & Cash Flow</p>
          <p className="text-xs text-muted-foreground">Accounting period: 1 January – 31 December</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={preset} onValueChange={(v) => setPreset(v as Preset)}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="fy">Financial Year (Jan–Dec)</SelectItem>
              <SelectItem value="ytd">Year to Date</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
          {preset === "fy" && (
            <Select value={String(fyYear)} onValueChange={(v) => setFyYear(Number(v))}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: 6 }, (_, i) => thisYear - i).map((y) => (
                  <SelectItem key={y} value={String(y)}>FY {y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" size="sm" onClick={exportCsv}><Download className="h-4 w-4 mr-1" /> CSV</Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" /> Print</Button>
        </div>
      </div>

      {preset === "custom" && (
        <div className="flex flex-wrap items-end gap-3 print:hidden">
          <div><Label className="text-xs">From</Label><Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-44" /></div>
          <div><Label className="text-xs">To</Label><Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-44" /></div>
        </div>
      )}


      <div className="hidden print:block">
        <h1 className="text-xl font-bold">4K Smart Solutions Ltd — Financial Statements</h1>
        <p className="text-sm">Period: {period.from} to {period.to}</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Revenue" value={fmt(pl.salesTotal + pl.otherIncomeTotal)} icon={<TrendingUp className="h-4 w-4 text-success" />} />
        <StatCard label="Gross Profit" value={fmt(pl.grossProfit)} icon={<Scale className="h-4 w-4 text-primary" />} />
        <StatCard label="Net Profit" value={fmt(pl.netProfit)} accent={pl.netProfit >= 0 ? "success" : "destructive"}
          icon={pl.netProfit >= 0 ? <TrendingUp className="h-4 w-4 text-success" /> : <TrendingDown className="h-4 w-4 text-destructive" />} />
        <StatCard label="Cash Net Flow" value={fmt(cf.net)} accent={cf.net >= 0 ? "success" : "destructive"} icon={<Wallet className="h-4 w-4 text-primary" />} />
        <StatCard label="Total Assets" value={fmt(bs.assetsTotal)} icon={<Scale className="h-4 w-4 text-primary" />} />
        <StatCard label="Liabilities" value={fmt(bs.liabilitiesTotal)} icon={<Receipt className="h-4 w-4 text-warning" />} />
        <StatCard label="COGS" value={fmt(pl.cogsTotal)} icon={<TrendingDown className="h-4 w-4 text-warning" />} />
        <StatCard label="VAT Payable" value={fmt(vat.payable)} accent={vat.payable > 0 ? "warning" : "success"} icon={<Receipt className="h-4 w-4 text-warning" />} />
      </div>

      <Tabs defaultValue="pl" className="print:hidden">
        <TabsList>
          <TabsTrigger value="pl">Profit & Loss</TabsTrigger>
          <TabsTrigger value="bs">Balance Sheet</TabsTrigger>
          <TabsTrigger value="cf">Cash Flow</TabsTrigger>
          <TabsTrigger value="vat">VAT / Tax</TabsTrigger>
        </TabsList>

        <TabsContent value="pl"><PLStatement pl={pl} /></TabsContent>
        <TabsContent value="bs"><BSStatement bs={bs} /></TabsContent>
        <TabsContent value="cf"><CFStatement cf={cf} /></TabsContent>
        <TabsContent value="vat"><VatStatement vat={vat} /></TabsContent>
      </Tabs>

      {/* Print view: everything stacked */}
      <div className="hidden print:block space-y-6">
        <PLStatement pl={pl} />
        <BSStatement bs={bs} />
        <CFStatement cf={cf} />
        <VatStatement vat={vat} />
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, accent }: { label: string; value: string; icon?: React.ReactNode; accent?: "success" | "destructive" | "warning" }) {
  const color = accent === "success" ? "text-success" : accent === "destructive" ? "text-destructive" : accent === "warning" ? "text-warning" : "";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{label}</p>{icon}
        </div>
        <p className={`text-xl font-bold ${color}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function Row({ label, amount, bold, indent, negative }: { label: string; amount: number; bold?: boolean; indent?: boolean; negative?: boolean }) {
  return (
    <TableRow className={bold ? "font-bold bg-muted/40" : ""}>
      <TableCell className={indent ? "pl-8 text-sm" : "text-sm"}>{label}</TableCell>
      <TableCell className="text-right text-sm">{negative && amount !== 0 ? `(${fmt(amount)})` : fmt(amount)}</TableCell>
    </TableRow>
  );
}

function PLStatement({ pl }: { pl: ReturnType<typeof computePL> }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Profit &amp; Loss Statement</CardTitle></CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>Account</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
          <TableBody>
            <Row label="Revenue" amount={0} bold />
            {pl.sales.map((i: LineItem) => <Row key={i.code} label={i.name} amount={i.amount} indent />)}
            <Row label="Total Revenue" amount={pl.salesTotal} bold />
            <Row label="Cost of Goods Sold" amount={0} bold />
            {pl.cogs.map((i: LineItem) => <Row key={i.code} label={i.name} amount={i.amount} indent negative />)}
            <Row label="Gross Profit" amount={pl.grossProfit} bold />
            {pl.otherIncome.length > 0 && <Row label="Other Income" amount={0} bold />}
            {pl.otherIncome.map((i: LineItem) => <Row key={i.code} label={i.name} amount={i.amount} indent />)}
            <Row label="Operating Expenses" amount={0} bold />
            {pl.opex.map((i: LineItem) => <Row key={i.code} label={i.name} amount={i.amount} indent negative />)}
            {pl.finance.length > 0 && <Row label="Finance Costs" amount={0} bold />}
            {pl.finance.map((i: LineItem) => <Row key={i.code} label={i.name} amount={i.amount} indent negative />)}
            <Row label="Net Profit" amount={pl.netProfit} bold />
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function BSStatement({ bs }: { bs: ReturnType<typeof computeBalanceSheet> }) {
  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base">Balance Sheet</CardTitle>
        <Badge className={bs.balanced ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}>
          {bs.balanced ? "Balanced" : "Out of balance"}
        </Badge>
      </CardHeader>
      <CardContent className="grid md:grid-cols-2 gap-6">
        <div>
          <h3 className="font-semibold text-sm mb-2">Assets</h3>
          <Table><TableBody>
            {bs.assets.map((i) => <Row key={i.code} label={i.name} amount={i.amount} />)}
            <Row label="Total Assets" amount={bs.assetsTotal} bold />
          </TableBody></Table>
        </div>
        <div>
          <h3 className="font-semibold text-sm mb-2">Liabilities &amp; Equity</h3>
          <Table><TableBody>
            {bs.liabilities.map((i) => <Row key={i.code} label={i.name} amount={i.amount} />)}
            <Row label="Total Liabilities" amount={bs.liabilitiesTotal} bold />
            {bs.equity.map((i) => <Row key={i.code} label={i.name} amount={i.amount} />)}
            <Row label="Total Equity" amount={bs.equityTotal} bold />
            <Row label="Total Liabilities + Equity" amount={bs.liabilitiesTotal + bs.equityTotal} bold />
          </TableBody></Table>
        </div>
      </CardContent>
    </Card>
  );
}

function CFStatement({ cf }: { cf: ReturnType<typeof computeCashFlow> }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Cash Flow</CardTitle></CardHeader>
      <CardContent className="p-0">
        <Table><TableBody>
          <Row label="Opening Cash Balance" amount={cf.opening} />
          <Row label="Cash Inflow" amount={cf.inflow} />
          <Row label="Cash Outflow" amount={cf.outflow} negative />
          <Row label="Net Cash Movement" amount={cf.net} bold />
          <Row label="Closing Cash Balance" amount={cf.closing} bold />
        </TableBody></Table>
        {cf.byAccount.length > 0 && (
          <div className="p-4">
            <h3 className="font-semibold text-sm mb-2">By Cash / Bank Account</h3>
            <Table><TableBody>
              {cf.byAccount.map((i) => <Row key={i.code} label={i.name} amount={i.amount} />)}
            </TableBody></Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function VatStatement({ vat }: { vat: ReturnType<typeof computeVat> }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">VAT / Tax Position</CardTitle></CardHeader>
      <CardContent className="p-0">
        <Table><TableBody>
          <Row label="Output VAT (collected on sales)" amount={vat.outputVat} />
          <Row label="Input VAT (recoverable on purchases)" amount={vat.inputVat} negative />
          <Row label={vat.payable >= 0 ? "VAT Payable to KRA" : "VAT Refundable"} amount={Math.abs(vat.payable)} bold />
        </TableBody></Table>
      </CardContent>
    </Card>
  );
}
