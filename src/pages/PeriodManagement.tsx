import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Lock, LockOpen, ShieldAlert, CalendarRange } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export default function PeriodManagement() {
  const qc = useQueryClient();
  const [year, setYear] = useState(new Date().getFullYear());
  const [busy, setBusy] = useState<string | null>(null);

  const { data: periods = [] } = useQuery({
    queryKey: ["accounting_periods"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("accounting_periods").select("*").order("start_date");
      if (error) throw error;
      return data as any[];
    },
  });

  const setStatus = async (m: number, status: string) => {
    let reason: string | null = null;
    if (status !== "open") {
      reason = prompt(status === "locked"
        ? "Permanently LOCK this month? It can never be reopened. Enter a reason:"
        : "Reason for closing this month:");
      if (!reason) return;
    } else if (!confirm("Reopen this month? Back-dated entries will be allowed again.")) return;
    setBusy(`${m}`);
    const { error } = await (supabase as any).rpc("set_accounting_period", { p_year: year, p_month: m, p_status: status, p_reason: reason });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(`${MONTHS[m - 1]} ${year} is now ${status}`);
    qc.invalidateQueries({ queryKey: ["accounting_periods"] });
  };

  const now = new Date();
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-heading flex items-center gap-2"><CalendarRange className="h-6 w-6" />Period Management</h1>
          <p className="text-sm text-muted-foreground">Closed months cannot receive new or back-dated entries. Corrections post in the current open month.</p>
        </div>
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>{[0, 1, 2, 3].map((i) => { const y = now.getFullYear() - i; return <SelectItem key={y} value={String(y)}>{y}</SelectItem>; })}</SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MONTHS.map((name, i) => {
          const m = i + 1;
          const key = `${year}-${String(m).padStart(2, "0")}`;
          const p = periods.find((x) => x.period_name === key);
          const status = p?.status ?? "open";
          const future = new Date(year, i, 1) > now;
          return (
            <Card key={key} className={status === "open" ? "" : "bg-muted/40"}>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-base">{name} {year}</CardTitle>
                <Badge variant={status === "open" ? "secondary" : status === "closed" ? "outline" : "destructive"} className="gap-1">
                  {status === "open" ? <LockOpen className="h-3 w-3" /> : status === "closed" ? <Lock className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
                  {status.toUpperCase()}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                {p?.closed_at && <p className="text-xs text-muted-foreground">Closed {format(new Date(p.closed_at), "dd MMM yyyy HH:mm")}{p.closed_reason ? ` — ${p.closed_reason}` : ""}</p>}
                <div className="flex gap-2">
                  {status === "open" && <Button size="sm" variant="outline" disabled={future || busy === `${m}`} onClick={() => setStatus(m, "closed")}>Close</Button>}
                  {status === "closed" && <>
                    <Button size="sm" variant="outline" disabled={busy === `${m}`} onClick={() => setStatus(m, "open")}>Reopen</Button>
                    <Button size="sm" variant="destructive" disabled={busy === `${m}`} onClick={() => setStatus(m, "locked")}>Lock</Button>
                  </>}
                  {status === "locked" && <span className="text-xs text-muted-foreground">Permanently locked</span>}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
