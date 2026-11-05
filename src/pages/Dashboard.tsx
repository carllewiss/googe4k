import { useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useDailySummary } from "@/hooks/useDailySummary";
import { useProductWithStock } from "@/hooks/useProducts";
import { useWifiTransactions } from "@/hooks/useWifi";
import { useGLFinancials } from "@/hooks/useAccounting";
import { computePL } from "@/lib/financials";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ShoppingCart,
  Smartphone,
  Banknote,
  Receipt,
  Coins,
  Users,
  AlertTriangle,
  Wifi,
  FileText,
  HandCoins,
  TrendingUp,
  Wallet,
  Percent,
} from "lucide-react";
import { Link } from "react-router-dom";
import { format, startOfMonth, endOfMonth } from "date-fns";

const kes = (n: number) =>
  `KSh ${Number(n || 0).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function Dashboard() {
  const { isAdmin, user, displayName } = useAuth();
  const [today] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const monthFrom = useMemo(() => format(startOfMonth(new Date()), "yyyy-MM-dd"), []);
  const monthTo = useMemo(() => format(endOfMonth(new Date()), "yyyy-MM-dd"), []);

  const { data: summary, isLoading } = useDailySummary(today, {
    agentId: isAdmin ? null : user?.id ?? null,
  });
  const { data: products = [] } = useProductWithStock();
  const { data: wifiTxns = [] } = useWifiTransactions();
  const { data: glRows, isLoading: glLoading } = useGLFinancials(monthFrom, monthTo, {
    enabled: isAdmin,
  });

  const monthly = useMemo(() => (glRows ? computePL(glRows) : null), [glRows]);

  const lowStockProducts = products.filter(
    (p) => !p.is_service && p.stock_on_hand <= p.min_stock && p.min_stock > 0
  );

  const wifiToday = useMemo(
    () => wifiTxns.filter((t: any) => t.paid_at?.startsWith(today)),
    [wifiTxns, today]
  );
  const wifiTodayRevenue = wifiToday.reduce((s: number, t: any) => s + Number(t.amount), 0);

  const wifiMonth = useMemo(
    () => wifiTxns.filter((t: any) => t.paid_at >= monthFrom && t.paid_at <= `${monthTo}T23:59:59`),
    [wifiTxns, monthFrom, monthTo]
  );
  const wifiMonthRevenue = wifiMonth.reduce((s: number, t: any) => s + Number(t.amount), 0);


  if (isLoading || !summary) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const pct = (v: number) => (summary.totalCollected > 0 ? (v / summary.totalCollected) * 100 : 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold font-heading">
            {isAdmin
              ? "Daily Collections Dashboard"
              : `Welcome back${displayName ? `, ${displayName.split(" ")[0]}` : ""}`}
          </h1>
          <p className="text-muted-foreground text-sm">
            {isAdmin
              ? "All agents combined · today only"
              : "Your sales and collections for today"}
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          {format(new Date(), "EEEE, dd MMM yyyy")}
        </Badge>
      </div>

      {/* ── KPI strip ───────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard
          icon={ShoppingCart}
          tone="success"
          label="TODAY'S SALES"
          value={kes(summary.totalSales)}
          sub={`${summary.invoiceCount} Invoice${summary.invoiceCount === 1 ? "" : "s"}`}
          subTone="success"
        />
        <StatCard
          icon={Smartphone}
          tone="success"
          label="MPESA COLLECTION"
          value={kes(summary.mpesaCollected)}
          sub={`${summary.mpesaTxnCount} Transactions`}
          subTone="success"
        />
        <StatCard
          icon={Banknote}
          tone="success"
          label="CASH COLLECTION"
          value={kes(summary.cashCollected)}
          sub={`${summary.cashTxnCount} Transactions`}
          subTone="success"
        />
        <StatCard
          icon={Receipt}
          tone="warning"
          label="DEBT (TODAY'S SALES)"
          value={kes(summary.debtSales)}
          sub={`${summary.customersServed} Customers`}
          subTone="warning"
        />
        <StatCard
          icon={Coins}
          tone="primary"
          label="TOTAL COLLECTED (MPESA + CASH)"
          value={kes(summary.totalCollected)}
          valueTone="primary"
          sub={
            summary.totalSales > 0
              ? `${((summary.totalCollected / summary.totalSales) * 100).toFixed(0)}% of Sales`
              : "0% of Sales"
          }
          subTone="success"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* ── Payment summary ─────────────────── */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Payment Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Payment Method</TableHead>
                  <TableHead className="text-right">Transactions</TableHead>
                  <TableHead className="text-right">Amount (KSh)</TableHead>
                  <TableHead className="text-right">% of Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">M-Pesa</TableCell>
                  <TableCell className="text-right">{summary.mpesaTxnCount}</TableCell>
                  <TableCell className="text-right">
                    {summary.mpesaCollected.toLocaleString("en-KE", { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right">{pct(summary.mpesaCollected).toFixed(1)}%</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Cash</TableCell>
                  <TableCell className="text-right">{summary.cashTxnCount}</TableCell>
                  <TableCell className="text-right">
                    {summary.cashCollected.toLocaleString("en-KE", { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right">{pct(summary.cashCollected).toFixed(1)}%</TableCell>
                </TableRow>
                <TableRow className="bg-muted/40">
                  <TableCell className="font-bold text-success">Total Collected</TableCell>
                  <TableCell className="text-right font-bold text-success">
                    {summary.mpesaTxnCount + summary.cashTxnCount}
                  </TableCell>
                  <TableCell className="text-right font-bold text-success">
                    {summary.totalCollected.toLocaleString("en-KE", { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right font-bold text-success">
                    {summary.totalCollected > 0 ? "100%" : "0%"}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* ── Today at a glance ───────────────── */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Today at a Glance</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <GlanceRow icon={FileText} tone="success" label="Invoices (Total)" value={String(summary.invoiceCount)} />
            <GlanceRow icon={Smartphone} tone="success" label="M-Pesa Transactions" value={String(summary.mpesaTxnCount)} />
            <GlanceRow icon={Banknote} tone="success" label="Cash Transactions" value={String(summary.cashTxnCount)} />
            <GlanceRow
              icon={HandCoins}
              tone="primary"
              label="Previous Debt Collected"
              value={kes(summary.debtCollected)}
            />
            <GlanceRow icon={Users} tone="primary" label="Customers Served" value={String(summary.customersServed)} last />
          </CardContent>
        </Card>
      </div>

      {/* ── Admin only: per-agent breakdown + wifi ── */}
      {isAdmin && (
        <>
          {/* ── Monthly overview ─────────────────── */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold font-heading">Monthly Overview</h2>
              <Badge variant="secondary" className="text-xs">{format(new Date(), "MMMM yyyy")}</Badge>
              <span className="text-xs text-muted-foreground">{monthFrom} → {monthTo}</span>
            </div>


            {glLoading || !monthly ? (
              <Card>
                <CardContent className="p-8 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                  <span className="ml-3 text-sm text-muted-foreground">Loading month figures from the ledger…</span>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard
                    icon={ShoppingCart}
                    tone="success"
                    label="MONTHLY SALES"
                    value={kes(monthly.salesTotal)}
                    sub="Product & service revenue"
                    subTone="success"
                  />
                  <Link to="/wifi" className="block">
                    <StatCard
                      icon={Wifi}
                      tone="success"
                      label="WIFI MONTHLY COLLECTION"
                      value={kes(wifiMonthRevenue)}
                      sub={`${wifiMonth.length} payments`}
                      subTone="success"
                    />
                  </Link>
                  <StatCard
                    icon={TrendingUp}
                    tone="primary"
                    label="TOTAL PROFIT"
                    value={kes(monthly.netProfit)}
                    valueTone={monthly.netProfit >= 0 ? "success" : "warning"}
                    sub={`${
                      monthly.salesTotal + monthly.otherIncomeTotal > 0
                        ? ((monthly.netProfit / (monthly.salesTotal + monthly.otherIncomeTotal)) * 100).toFixed(1)
                        : "0.0"
                    }% net margin`}
                    subTone="primary"
                  />
                  <StatCard
                    icon={Wallet}
                    tone="warning"
                    label="COST OF SALES + EXPENSES"
                    value={kes(monthly.cogsTotal + monthly.opexTotal + monthly.financeTotal)}
                    sub={`COGS ${kes(monthly.cogsTotal)} · Expenses ${kes(monthly.opexTotal + monthly.financeTotal)}`}
                    subTone="warning"
                  />

                </div>

                {/* Profit summary strip */}
                <Card className="bg-muted/30">
                  <CardContent className="p-4">
                    <p className="text-sm font-semibold text-primary mb-4">Profit Summary (This Month)</p>
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
                      <ProfitItem icon={ShoppingCart} tone="success" label="Total Sales" value={kes(monthly.salesTotal + monthly.otherIncomeTotal)} />
                      <span className="text-2xl text-muted-foreground">−</span>
                      <ProfitItem icon={Wallet} tone="warning" label="Cost of Sales & Expenses" value={kes(monthly.cogsTotal + monthly.opexTotal + monthly.financeTotal)} />
                      <span className="text-2xl text-muted-foreground">=</span>
                      <ProfitItem icon={TrendingUp} tone="primary" label="Net Profit" value={kes(monthly.netProfit)} />
                      <span className="hidden md:block h-10 w-px bg-border" />
                      <ProfitItem
                        icon={Percent}
                        tone="primary"
                        label="Profit Margin"
                        value={`${
                          monthly.salesTotal + monthly.otherIncomeTotal > 0
                            ? ((monthly.netProfit / (monthly.salesTotal + monthly.otherIncomeTotal)) * 100).toFixed(1)
                            : "0.0"
                        }%`}
                      />
                      <ProfitItem icon={Coins} tone="success" label="Gross Profit" value={kes(monthly.grossProfit)} />
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>


          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Collections by Agent — Today</CardTitle>
            </CardHeader>
            <CardContent>
              {summary.agents.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  No sales or collections recorded yet today.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Agent</TableHead>
                        <TableHead className="text-right">Invoices</TableHead>
                        <TableHead className="text-right">Total Sales</TableHead>
                        <TableHead className="text-right">M-Pesa</TableHead>
                        <TableHead className="text-right">Cash</TableHead>
                        <TableHead className="text-right">Debt Sales</TableHead>
                        <TableHead className="text-right">Debt Collected</TableHead>
                        <TableHead className="text-right">Total Collected</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {summary.agents.map((a) => (
                        <TableRow key={a.agentId}>
                          <TableCell className="font-medium">{a.agentName}</TableCell>
                          <TableCell className="text-right">{a.invoiceCount}</TableCell>
                          <TableCell className="text-right">{kes(a.totalSales)}</TableCell>
                          <TableCell className="text-right">{kes(a.mpesaCollected)}</TableCell>
                          <TableCell className="text-right">{kes(a.cashCollected)}</TableCell>
                          <TableCell className="text-right text-warning">{kes(a.debtSales)}</TableCell>
                          <TableCell className="text-right">{kes(a.debtCollected)}</TableCell>
                          <TableCell className="text-right font-semibold text-success">
                            {kes(a.totalCollected)}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/40">
                        <TableCell className="font-bold">All Agents</TableCell>
                        <TableCell className="text-right font-bold">{summary.invoiceCount}</TableCell>
                        <TableCell className="text-right font-bold">{kes(summary.totalSales)}</TableCell>
                        <TableCell className="text-right font-bold">{kes(summary.mpesaCollected)}</TableCell>
                        <TableCell className="text-right font-bold">{kes(summary.cashCollected)}</TableCell>
                        <TableCell className="text-right font-bold text-warning">{kes(summary.debtSales)}</TableCell>
                        <TableCell className="text-right font-bold">{kes(summary.debtCollected)}</TableCell>
                        <TableCell className="text-right font-bold text-success">
                          {kes(summary.totalCollected)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-4">
            <Link to="/wifi" className="block">
              <StatCard
                icon={Wifi}
                tone="primary"
                label="TODAY'S WIFI REVENUE"
                value={kes(wifiTodayRevenue)}
                sub={`${wifiToday.length} payments`}
                subTone="success"
              />
            </Link>
            <StatCard
              icon={AlertTriangle}
              tone="warning"
              label="LOW STOCK ITEMS"
              value={String(lowStockProducts.length)}
              sub="items need restock"
              subTone="warning"
            />
          </div>
        </>
      )}

      {lowStockProducts.length > 0 && (
        <Card className="border-destructive/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" /> Low Stock Alert
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {lowStockProducts.map((p) => (
                <Badge key={p.id} variant="destructive" className="text-xs">
                  {p.name}: {p.stock_on_hand} left
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

const TONES: Record<string, string> = {
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  primary: "bg-primary/10 text-primary",
};

const TEXT_TONES: Record<string, string> = {
  success: "text-success",
  warning: "text-warning",
  primary: "text-primary",
  default: "text-foreground",
};

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  tone = "primary",
  valueTone = "default",
  subTone = "success",
}: {
  icon: any;
  label: string;
  value: string;
  sub: string;
  tone?: string;
  valueTone?: string;
  subTone?: string;
}) {
  return (
    <Card className="h-full">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className={`p-2 rounded-full ${TONES[tone]}`}>
            <Icon className="h-4 w-4" />
          </div>
          <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase leading-tight">
            {label}
          </span>
        </div>
        <p className={`text-xl font-bold font-heading ${TEXT_TONES[valueTone]}`}>{value}</p>
        <p className={`text-xs mt-1 ${TEXT_TONES[subTone]}`}>{sub}</p>
      </CardContent>
    </Card>
  );
}

function GlanceRow({
  icon: Icon,
  label,
  value,
  tone = "primary",
  last = false,
}: {
  icon: any;
  label: string;
  value: string;
  tone?: string;
  last?: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 ${last ? "" : "border-b"}`}>
      <div className={`p-1.5 rounded-md ${TONES[tone]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <span className="text-sm flex-1">{label}</span>
      <span className="text-sm font-bold">{value}</span>
    </div>
  );
}

function ProfitItem({
  icon: Icon,
  label,
  value,
  tone = "primary",
}: {
  icon: any;
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className={`p-2.5 rounded-full ${TONES[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-bold font-heading">{value}</p>
      </div>
    </div>
  );
}
