import type { GLAgg } from "@/hooks/useAccounting";

export interface Period {
  from: string; // yyyy-MM-dd inclusive
  to: string; // yyyy-MM-dd inclusive
}

export interface LineItem {
  code: string;
  name: string;
  amount: number;
}

const CASH_CODES = ["1000", "1010", "1020", "1030", "1040", "1050"];

/** Build positive-signed line items from aggregate rows using an amount selector. */
function items(rows: GLAgg[], amount: (r: GLAgg) => number): LineItem[] {
  return rows
    .map((r) => ({ code: r.code, name: r.name, amount: amount(r) }))
    .filter((i) => Math.abs(i.amount) > 0.0049)
    .sort((a, b) => a.code.localeCompare(b.code));
}

const sum = (items: LineItem[]) => items.reduce((s, i) => s + i.amount, 0);

/* ------------------------------- Profit & Loss ------------------------------ */
export function computePL(rows: GLAgg[]) {
  const pd = (r: GLAgg) => r.period_debit;
  const pc = (r: GLAgg) => r.period_credit;

  const sales = items(rows.filter((r) => r.code === "4000" || r.code === "4010"), (r) => pc(r) - pd(r));
  const otherIncome = items(rows.filter((r) => r.type === "income" && r.code !== "4000" && r.code !== "4010"), (r) => pc(r) - pd(r));
  const cogs = items(rows.filter((r) => r.code.startsWith("5")), (r) => pd(r) - pc(r));
  const opex = items(rows.filter((r) => r.type === "expense" && !r.code.startsWith("5") && !r.code.startsWith("7")), (r) => pd(r) - pc(r));
  const finance = items(rows.filter((r) => r.code.startsWith("7")), (r) => pd(r) - pc(r));

  const salesTotal = sum(sales);
  const cogsTotal = sum(cogs);
  const grossProfit = salesTotal - cogsTotal;
  const otherIncomeTotal = sum(otherIncome);
  const opexTotal = sum(opex);
  const financeTotal = sum(finance);
  const netProfit = grossProfit + otherIncomeTotal - opexTotal - financeTotal;

  return { sales, otherIncome, cogs, opex, finance, salesTotal, cogsTotal, grossProfit, otherIncomeTotal, opexTotal, financeTotal, netProfit };
}

/* ------------------------------ Balance Sheet ------------------------------- */
export function computeBalanceSheet(rows: GLAgg[]) {
  const ad = (r: GLAgg) => r.asof_debit;
  const ac = (r: GLAgg) => r.asof_credit;

  const assets = items(rows.filter((r) => r.type === "asset"), (r) => ad(r) - ac(r));
  const liabilities = items(rows.filter((r) => r.type === "liability"), (r) => ac(r) - ad(r));
  const equityAccts = items(rows.filter((r) => r.type === "equity"), (r) => ac(r) - ad(r));

  // Income & expense accounts aren't closed to equity, so fold cumulative
  // earnings (income - expense, all-time up to the report date) into equity.
  const cumIncome = rows.filter((r) => r.type === "income").reduce((s, r) => s + (ac(r) - ad(r)), 0);
  const cumExpense = rows.filter((r) => r.type === "expense").reduce((s, r) => s + (ad(r) - ac(r)), 0);
  const currentEarnings = cumIncome - cumExpense;

  const equity: LineItem[] = [
    ...equityAccts,
    ...(Math.abs(currentEarnings) > 0.0049 ? [{ code: "3900", name: "Current Earnings (GL)", amount: currentEarnings }] : []),
  ];

  const assetsTotal = sum(assets);
  const liabilitiesTotal = sum(liabilities);
  const equityTotal = sum(equity);
  const balanced = Math.abs(assetsTotal - (liabilitiesTotal + equityTotal)) < 0.5;

  return { assets, liabilities, equity, assetsTotal, liabilitiesTotal, equityTotal, balanced };
}

/* -------------------------------- Cash Flow --------------------------------- */
export function computeCashFlow(rows: GLAgg[]) {
  const cash = rows.filter((r) => CASH_CODES.includes(r.code));

  const opening = cash.reduce((s, r) => s + (r.opening_debit - r.opening_credit), 0);
  const inflow = cash.reduce((s, r) => s + r.period_debit, 0);
  const outflow = cash.reduce((s, r) => s + r.period_credit, 0);
  const net = inflow - outflow;
  const closing = opening + net;

  const byAccount = items(cash, (r) => r.period_debit - r.period_credit);
  return { opening, inflow, outflow, net, closing, byAccount };
}

/* ------------------------------- VAT position ------------------------------- */
export function computeVat(rows: GLAgg[]) {
  const output = rows.find((r) => r.code === "2100");
  const input = rows.find((r) => r.code === "1300");
  const outputVat = output ? output.period_credit - output.period_debit : 0;
  const inputVat = input ? input.period_debit - input.period_credit : 0;
  return { outputVat, inputVat, payable: outputVat - inputVat };
}
