import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCustomers } from "@/hooks/useCustomers";
import { useInvoices } from "@/hooks/useInvoices";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { differenceInDays } from "date-fns";
import { Search, CreditCard, ChevronRight, UserPlus, Ban } from "lucide-react";
import PaymentDialog from "@/components/PaymentDialog";
import AddCustomerDialog from "@/components/AddCustomerDialog";
import { getCustomerCreditStatus } from "@/lib/customerStatus";

export default function Customers() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { data: customers = [], isLoading } = useCustomers();
  const { data: invoices = [] } = useInvoices();
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [paymentTarget, setPaymentTarget] = useState<{ id: string; name: string; balance: number } | null>(null);
  const today = new Date();

  const getDebtAging = (custId: string) => {
    const unpaid = invoices.filter(i => i.customer_id === custId && Number(i.balance) > 0);
    let d14 = 0, d30 = 0, d60 = 0;
    unpaid.forEach(i => {
      const days = differenceInDays(today, new Date(i.created_at));
      if (days <= 14) d14 += Number(i.balance);
      else if (days <= 30) d30 += Number(i.balance);
      else d60 += Number(i.balance);
    });
    return { d14, d30, d60, total: d14 + d30 + d60 };
  };

  const filtered = customers
    .filter(c => c.customer_type !== "walk_in")
    .filter(c => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return c.name.toLowerCase().includes(q) || c.customer_code.toLowerCase().includes(q) || (c.phone && c.phone.includes(q));
    });

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-heading">Customers</h1>
        {isAdmin && (
          <Button onClick={() => setShowAdd(true)}>
            <UserPlus className="h-4 w-4 mr-2" /> Add Customer
          </Button>
        )}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search customers..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="grid gap-4">
        {filtered.map(cust => {
          const aging = getDebtAging(cust.id);
          const status = getCustomerCreditStatus(cust as any, invoices as any, today);
          return (
            <Card key={cust.id} className="hover:shadow-elegant transition-shadow cursor-pointer" onClick={() => navigate(`/customers/${cust.id}`)}>
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold font-heading">{cust.name}</h3>
                      <Badge variant="outline" className="text-xs">{cust.customer_code}</Badge>
                      {cust.kra_pin && <Badge variant="outline" className="text-xs">Taxable</Badge>}
                      {cust.visit_count >= 3 && <Badge className="bg-primary/10 text-primary text-xs">Repeat</Badge>}
                      {status.suspended && (
                        <Badge variant="destructive" className="text-xs gap-1"><Ban className="h-3 w-3" /> Suspended</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{cust.phone || "No phone"} {cust.kra_pin ? `· PIN: ${cust.kra_pin}` : ""} {(cust as any).location ? `· ${(cust as any).location}` : ""}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {cust.visit_count} visits · KES {Number(cust.total_spent).toLocaleString()} spent
                      {Number(cust.debt_limit) > 0 && ` · Credit: KES ${Number(cust.debt_limit).toLocaleString()}`}
                      {(cust as any).credit_terms && ` · ${(cust as any).credit_terms}d terms`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                    <div className="text-right space-y-1">
                      {aging.total > 0 ? (
                        <>
                          <p className="text-sm font-bold text-destructive">Owes: KES {aging.total.toLocaleString()}</p>
                          <div className="flex gap-2 text-xs justify-end">
                            {aging.d14 > 0 && <span className="text-success">14d: {aging.d14.toLocaleString()}</span>}
                            {aging.d30 > 0 && <span className="text-warning">30d: {aging.d30.toLocaleString()}</span>}
                            {aging.d60 > 0 && <span className="text-destructive">60d+: {aging.d60.toLocaleString()}</span>}
                          </div>
                        </>
                      ) : (
                        <Badge className="bg-success/10 text-success text-xs">No debt</Badge>
                      )}
                    </div>
                    {aging.total > 0 && (
                      <Button size="sm" variant="outline" onClick={() => setPaymentTarget({ id: cust.id, name: cust.name, balance: aging.total })}>
                        <CreditCard className="h-3 w-3 mr-1" /> Pay
                      </Button>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && <p className="text-center text-muted-foreground py-8">No customers found.</p>}
      </div>

      {paymentTarget && (
        <PaymentDialog
          open={!!paymentTarget}
          onOpenChange={open => { if (!open) setPaymentTarget(null); }}
          customerId={paymentTarget.id}
          customerName={paymentTarget.name}
          currentBalance={paymentTarget.balance}
        />
      )}

      <AddCustomerDialog open={showAdd} onOpenChange={setShowAdd} />
    </div>
  );
}
