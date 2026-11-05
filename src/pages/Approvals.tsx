import { usePendingApprovals, useApproveInvoice, useRejectInvoice } from "@/hooks/useInvoiceApprovals";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, AlertTriangle, ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export default function Approvals() {
  const { data: pending = [], isLoading } = usePendingApprovals();
  const approve = useApproveInvoice();
  const reject = useRejectInvoice();

  const onApprove = async (id: string) => {
    try {
      await approve.mutateAsync(id);
      toast.success("Invoice approved and released");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const onReject = async (id: string) => {
    if (!confirm("Reject this invoice? Stock will be restored and the invoice removed.")) return;
    try {
      await reject.mutateAsync(id);
      toast.success("Invoice rejected");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (isLoading)
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold font-heading">Invoice Approvals</h1>
        {pending.length > 0 && <Badge variant="destructive">{pending.length} pending</Badge>}
      </div>

      {pending.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
            <ShieldCheck className="h-10 w-10 mb-3 text-success" />
            <p>No invoices waiting for approval.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {pending.map((inv: any) => (
            <Card key={inv.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">{inv.invoice_number}</CardTitle>
                    <p className="text-sm text-muted-foreground">{inv.customer_name} · {format(new Date(inv.created_at), "dd MMM yyyy")}</p>
                  </div>
                  <Badge variant="destructive">Pending</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {inv.approval_reason && (
                  <div className="bg-destructive/10 border border-destructive/30 rounded-md p-2 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    <p className="text-xs text-destructive">{inv.approval_reason}</p>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div><p className="text-muted-foreground text-xs">Total</p><p className="font-medium">KES {Number(inv.total).toLocaleString()}</p></div>
                  <div><p className="text-muted-foreground text-xs">Paid</p><p className="font-medium">KES {Number(inv.paid_amount).toLocaleString()}</p></div>
                  <div><p className="text-muted-foreground text-xs">Balance</p><p className="font-medium text-destructive">KES {Number(inv.balance).toLocaleString()}</p></div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {(inv.invoice_items || []).length} item(s)
                </div>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" onClick={() => onApprove(inv.id)} disabled={approve.isPending || reject.isPending}>
                    <Check className="h-4 w-4 mr-1" /> Approve & Release
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onReject(inv.id)} disabled={approve.isPending || reject.isPending}>
                    <X className="h-4 w-4 mr-1" /> Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
