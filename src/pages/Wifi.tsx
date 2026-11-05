import { useMemo, useState } from "react";
import { useWifiTransactions, useWifiVouchers, useSyncWifi, useWifiLive } from "@/hooks/useWifi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Wifi as WifiIcon, DollarSign, Ticket, RefreshCw, Smartphone, TrendingUp, ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, subDays, isToday, startOfMonth, endOfMonth } from "date-fns";
import VoucherInventory from "@/components/VoucherInventory";
import type { WifiVoucher } from "@/hooks/useWifi";

const pkgLabel = (t?: string | null) => {
  if (!t) return "—";
  if (t === "2hour") return "2-Hour";
  if (t === "24hour") return "24-Hour";
  return t;
};

// Match the voucher used by a payment: same device MAC, closest used_at to the
// payment time. Source data rarely fills transactions.voucher_code directly.
function buildVoucherMatcher(vouchers: WifiVoucher[]) {
  const byMac = new Map<string, WifiVoucher[]>();
  for (const v of vouchers) {
    if (!v.used_by_mac) continue;
    const mac = v.used_by_mac.toLowerCase();
    if (!byMac.has(mac)) byMac.set(mac, []);
    byMac.get(mac)!.push(v);
  }
  return (mac: string | null | undefined, paidAt: string | null | undefined, existing?: string | null) => {
    if (existing) return existing;
    if (!mac) return null;
    const list = byMac.get(mac.toLowerCase());
    if (!list || list.length === 0) return null;
    if (!paidAt) return list[0].code ?? null;
    const t = new Date(paidAt).getTime();
    let best: WifiVoucher | null = null;
    let bestDiff = Infinity;
    for (const v of list) {
      const diff = v.used_at ? Math.abs(new Date(v.used_at).getTime() - t) : Infinity;
      if (diff < bestDiff) { bestDiff = diff; best = v; }
    }
    return (best ?? list[0]).code ?? null;
  };
}


const kes = (n: number) => `KES ${Math.round(n).toLocaleString()}`;

export default function Wifi() {
  const { data: txns = [], isLoading } = useWifiTransactions();
  const { data: vouchers = [] } = useWifiVouchers();
  const sync = useSyncWifi();
  useWifiLive();
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const matchVoucher = useMemo(() => buildVoucherMatcher(vouchers), [vouchers]);
  const totalPages = Math.max(1, Math.ceil(txns.length / pageSize));
  const pageTxns = txns.slice((page - 1) * pageSize, page * pageSize);

  const stats = useMemo(() => {
    const today = new Date();
    const todayTx = txns.filter((t) => isToday(new Date(t.paid_at)));
    const todayRevenue = todayTx.reduce((s, t) => s + Number(t.amount), 0);
    const totalRevenue = txns.reduce((s, t) => s + Number(t.amount), 0);
    const sevenDay = txns
      .filter((t) => new Date(t.paid_at) >= subDays(today, 7))
      .reduce((s, t) => s + Number(t.amount), 0);
    const mStart = startOfMonth(today);
    const mEnd = endOfMonth(today);
    const monthTx = txns.filter((t) => {
      const d = new Date(t.paid_at);
      return d >= mStart && d <= mEnd;
    });
    const monthRevenue = monthTx.reduce((s, t) => s + Number(t.amount), 0);
    const prevStart = startOfMonth(subDays(mStart, 1));
    const prevEnd = endOfMonth(subDays(mStart, 1));
    const prevTx = txns.filter((t) => {
      const d = new Date(t.paid_at);
      return d >= prevStart && d <= prevEnd;
    });
    const prevRevenue = prevTx.reduce((s, t) => s + Number(t.amount), 0);
    const vouchersToday = vouchers.filter((v) => v.used_at && isToday(new Date(v.used_at))).length;

    const daily = Array.from({ length: 7 }, (_, i) => {
      const d = subDays(today, 6 - i);
      const ds = format(d, "yyyy-MM-dd");
      const revenue = txns
        .filter((t) => t.paid_at?.startsWith(ds))
        .reduce((s, t) => s + Number(t.amount), 0);
      return { name: format(d, "EEE"), revenue };
    });

    return {
      todayRevenue, totalRevenue, sevenDay, monthRevenue,
      monthCount: monthTx.length, monthLabel: format(today, "MMMM yyyy"),
      prevRevenue, prevLabel: format(prevStart, "MMMM yyyy"),
      todayCount: todayTx.length, vouchersToday, daily,
    };
  }, [txns, vouchers]);


  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold font-heading flex items-center gap-2">
            <WifiIcon className="h-6 w-6 text-primary" /> WiFi Revenue
          </h1>
          <p className="text-muted-foreground text-sm">Daily captive-portal payments, vouchers &amp; M-Pesa codes</p>
        </div>
        <Button onClick={() => sync.mutate()} disabled={sync.isPending}>
          <RefreshCw className={`h-4 w-4 mr-2 ${sync.isPending ? "animate-spin" : ""}`} />
          {sync.isPending ? "Syncing…" : "Sync now"}
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard icon={DollarSign} label="Today's WiFi Revenue" value={kes(stats.todayRevenue)} sub={`${stats.todayCount} payments`} color="text-success" />
        <StatCard icon={TrendingUp} label="Last 7 Days" value={kes(stats.sevenDay)} sub="WiFi revenue" color="text-primary" />
        <StatCard icon={DollarSign} label="Monthly WiFi Collection" value={kes(stats.monthRevenue)} sub={`${stats.monthLabel} · ${stats.monthCount} payments`} color="text-success" />
        <StatCard icon={CalendarDays} label="Last Month Total" value={kes(stats.prevRevenue)} sub={`${stats.prevLabel} revenue`} color="text-warning" />
        <StatCard icon={Ticket} label="Vouchers Today" value={String(stats.vouchersToday)} sub="assigned" color="text-warning" />
        <StatCard icon={WifiIcon} label="All-Time Revenue" value={kes(stats.totalRevenue)} sub={`${txns.length} payments`} color="text-primary" />
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">7-Day WiFi Revenue</CardTitle></CardHeader>
        <CardContent>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 91%)" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip formatter={(v: number) => kes(v)} />
                <Bar dataKey="revenue" fill="hsl(167 72% 45%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><Smartphone className="h-4 w-4" /> WiFi Payments</CardTitle>
        </CardHeader>
        <CardContent>
          {txns.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No WiFi payments yet. Click "Sync now" to pull from the captive portal.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Phone (Paid By)</TableHead>
                    <TableHead>Package</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>M-Pesa Code</TableHead>
                    <TableHead>Voucher</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageTxns.map((t) => {
                    const isPos = t.source === "pos";
                    const voucher = isPos ? null : matchVoucher(t.client_mac, t.paid_at, t.voucher_code);
                    return (
                      <TableRow key={t.id}>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {format(new Date(t.paid_at), "dd MMM, HH:mm")}
                        </TableCell>
                        <TableCell className="font-medium">{t.phone_number || "—"}</TableCell>
                        <TableCell><Badge variant="secondary">{pkgLabel(t.package_type)}</Badge></TableCell>
                        <TableCell>
                          <Badge variant={isPos ? "outline" : "secondary"}>
                            {isPos ? `POS ${t.reference || ""}`.trim() : "Portal"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold">{kes(Number(t.amount))}</TableCell>
                        <TableCell className="font-mono text-xs">{t.mpesa_receipt || "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{voucher || "—"}</TableCell>
                      </TableRow>
                    );
                  })}

                </TableBody>
              </Table>

              <div className="flex items-center justify-between pt-4">
                <p className="text-xs text-muted-foreground">
                  Page {page} of {totalPages} · {txns.length} payment{txns.length === 1 ? "" : "s"}
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                    <ChevronLeft className="h-4 w-4" /> Prev
                  </Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                    Next <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>

      </Card>

      <VoucherInventory />
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, color }: { icon: any; label: string; value: string; sub: string; color: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className={`p-1.5 rounded-md bg-muted ${color}`}><Icon className="h-4 w-4" /></div>
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <p className="text-lg font-bold font-heading">{value}</p>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}
