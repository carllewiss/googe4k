import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DaySummary {
  date: string;
  invoiceCount: number;
  totalSales: number;
  posCash: number;
  posMpesa: number;
  debtSales: number;
  debtCollectedCash: number;
  debtCollectedMpesa: number;
  debtCollected: number;
  cashCollected: number;
  mpesaCollected: number;
  totalCollected: number;
  customersServed: number;
  mpesaTxnCount: number;
  cashTxnCount: number;
  paymentCount: number;
  outstandingToday: number;
  agents: AgentDay[];
}

export interface AgentDay {
  agentId: string;
  agentName: string;
  invoiceCount: number;
  totalSales: number;
  posCash: number;
  posMpesa: number;
  debtSales: number;
  debtCollected: number;
  cashCollected: number;
  mpesaCollected: number;
  totalCollected: number;
  customersServed: number;
}

function dayBounds(date: string) {
  const start = new Date(`${date}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

/**
 * Single source of truth for the "today" dashboard numbers.
 * - Sales & point-of-sale collections come from `invoices` (cash_amount / mpesa_amount / balance).
 * - Debt collections come from `payments` recorded that same day.
 */
export function useDailySummary(date: string, opts?: { agentId?: string | null }) {
  const agentId = opts?.agentId ?? null;

  return useQuery({
    queryKey: ["daily-summary", date, agentId],
    queryFn: async (): Promise<DaySummary> => {
      const { start, end } = dayBounds(date);

      let invQ = supabase
        .from("invoices")
        .select("id, customer_id, total, cash_amount, mpesa_amount, balance, paid_amount, created_by, created_at")
        .gte("created_at", start)
        .lt("created_at", end);
      if (agentId) invQ = invQ.eq("created_by", agentId);

      let payQ = supabase
        .from("payments")
        .select("id, customer_id, amount, cash_amount, mpesa_amount, created_by, payment_date")
        .gte("payment_date", start)
        .lt("payment_date", end);
      if (agentId) payQ = payQ.eq("created_by", agentId);

      const [invRes, payRes, profRes] = await Promise.all([
        invQ,
        payQ,
        supabase.from("profiles").select("user_id, display_name"),
      ]);
      if (invRes.error) throw invRes.error;
      if (payRes.error) throw payRes.error;

      const nameOf = new Map<string, string>();
      (profRes.data || []).forEach((p: any) => nameOf.set(p.user_id, p.display_name || "Unknown"));

      const invoices = invRes.data || [];
      const payments = payRes.data || [];

      const buckets = new Map<string, AgentDay & { _customers: Set<string> }>();
      const ensure = (uid: string | null) => {
        const key = uid || "unassigned";
        if (!buckets.has(key)) {
          buckets.set(key, {
            agentId: key,
            agentName: nameOf.get(key) || (key === "unassigned" ? "Unassigned" : "Unknown user"),
            invoiceCount: 0,
            totalSales: 0,
            posCash: 0,
            posMpesa: 0,
            debtSales: 0,
            debtCollected: 0,
            cashCollected: 0,
            mpesaCollected: 0,
            totalCollected: 0,
            customersServed: 0,
            _customers: new Set<string>(),
          });
        }
        return buckets.get(key)!;
      };

      let mpesaTxnCount = 0;
      let cashTxnCount = 0;
      const allCustomers = new Set<string>();

      for (const inv of invoices) {
        const b = ensure(inv.created_by as string | null);
        const cash = Number(inv.cash_amount) || 0;
        const mpesa = Number(inv.mpesa_amount) || 0;
        b.invoiceCount += 1;
        b.totalSales += Number(inv.total) || 0;
        b.posCash += cash;
        b.posMpesa += mpesa;
        b.debtSales += Number(inv.balance) || 0;
        if (inv.customer_id) {
          b._customers.add(inv.customer_id);
          allCustomers.add(inv.customer_id);
        }
        if (cash > 0) cashTxnCount += 1;
        if (mpesa > 0) mpesaTxnCount += 1;
      }

      for (const p of payments) {
        const b = ensure(p.created_by as string | null);
        const cash = Number(p.cash_amount) || 0;
        const mpesa = Number(p.mpesa_amount) || 0;
        b.debtCollected += Number(p.amount) || 0;
        b.posCash += 0;
        b.cashCollected += cash;
        b.mpesaCollected += mpesa;
        if (p.customer_id) {
          b._customers.add(p.customer_id);
          allCustomers.add(p.customer_id);
        }
        if (cash > 0) cashTxnCount += 1;
        if (mpesa > 0) mpesaTxnCount += 1;
      }

      const agents: AgentDay[] = Array.from(buckets.values())
        .map(({ _customers, ...a }) => {
          const cashCollected = a.posCash + a.cashCollected;
          const mpesaCollected = a.posMpesa + a.mpesaCollected;
          return {
            ...a,
            customersServed: _customers.size,
            cashCollected,
            mpesaCollected,
            totalCollected: cashCollected + mpesaCollected,
          };
        })
        .sort((a, b) => b.totalCollected - a.totalCollected);

      const sum = (f: (a: AgentDay) => number) => agents.reduce((s, a) => s + f(a), 0);

      const posCash = sum(a => a.posCash);
      const posMpesa = sum(a => a.posMpesa);
      const debtCollectedCash = sum(a => a.cashCollected) - posCash;
      const debtCollectedMpesa = sum(a => a.mpesaCollected) - posMpesa;
      const cashCollected = sum(a => a.cashCollected);
      const mpesaCollected = sum(a => a.mpesaCollected);

      return {
        date,
        invoiceCount: sum(a => a.invoiceCount),
        totalSales: sum(a => a.totalSales),
        posCash,
        posMpesa,
        debtSales: sum(a => a.debtSales),
        debtCollectedCash,
        debtCollectedMpesa,
        debtCollected: sum(a => a.debtCollected),
        cashCollected,
        mpesaCollected,
        totalCollected: cashCollected + mpesaCollected,
        customersServed: allCustomers.size,
        mpesaTxnCount,
        cashTxnCount,
        paymentCount: payments.length,
        outstandingToday: sum(a => a.debtSales),
        agents,
      };
    },
    staleTime: 30_000,
  });
}
