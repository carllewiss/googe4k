import { differenceInDays } from "date-fns";

export interface MinimalInvoice {
  customer_id: string;
  balance: number | string;
  created_at: string;
}

export interface CustomerLike {
  id: string;
  debt_limit: number | string;
  current_balance: number | string;
  credit_terms?: number | null;
  is_suspended?: boolean | null;
}

export interface CustomerCreditStatus {
  /** Current debt exceeds the credit limit */
  overLimit: boolean;
  /** Has at least one unpaid invoice older than the credit terms */
  overdue: boolean;
  /** Total overdue balance (invoices older than credit terms) */
  overdueAmount: number;
  /** Admin manually suspended */
  manualSuspended: boolean;
  /** Final computed suspension state */
  suspended: boolean;
  reasons: string[];
}

/**
 * A customer is suspended when their current debt is over the credit limit,
 * OR they have invoices unpaid past their credit-terms window,
 * OR an admin has manually suspended them.
 */
export function getCustomerCreditStatus(
  customer: CustomerLike,
  invoices: MinimalInvoice[],
  asOf: Date = new Date(),
): CustomerCreditStatus {
  const debtLimit = Number(customer.debt_limit) || 0;
  const currentBalance = Number(customer.current_balance) || 0;
  const terms = Number(customer.credit_terms) || 0;

  const overLimit = debtLimit > 0 && currentBalance > debtLimit;

  let overdueAmount = 0;
  invoices
    .filter((i) => i.customer_id === customer.id && Number(i.balance) > 0)
    .forEach((i) => {
      const age = differenceInDays(asOf, new Date(i.created_at));
      if (age > terms) overdueAmount += Number(i.balance);
    });
  const overdue = overdueAmount > 0;

  const manualSuspended = !!customer.is_suspended;
  const suspended = overLimit || overdue || manualSuspended;

  const reasons: string[] = [];
  if (overLimit)
    reasons.push(
      `Debt KES ${currentBalance.toLocaleString()} exceeds credit limit KES ${debtLimit.toLocaleString()}`,
    );
  if (overdue)
    reasons.push(
      `KES ${overdueAmount.toLocaleString()} overdue past ${terms}-day credit terms`,
    );
  if (manualSuspended) reasons.push("Manually suspended by admin");

  return { overLimit, overdue, overdueAmount, manualSuspended, suspended, reasons };
}
