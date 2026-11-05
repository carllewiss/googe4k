import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useInvoices } from "@/hooks/useInvoices";
import { useAllocatePayment, autoAllocateFIFO } from "@/hooks/useFIFOPayment";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format } from "date-fns";
import { Wallet, ArrowDownWideNarrow, SlidersHorizontal } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  customerName: string;
  /** Invoice the overpayment came from — credit is parked here. */
  invoiceId: string;
  invoiceNumber?: string | null;
  overpaid: number;
  cashAmount?: number;
  mpesaAmount?: number;
}

export default function OverpaymentDialog({
  open, onOpenChange, customerId, customerName, invoiceId, invoiceNumber,
  overpaid, cashAmount = 0, mpesaAmount = 0,
}: Props) {
  const { data: invoices = [] } = useInvoices();
  const allocate = useAllocatePayment();
  const { user } = useAuth();
  const [manual, setManual] = useState<Record<string, number>>({});

  const outstanding = useMemo(
    () => invoices
      .filter(i => i.customer_id === customerId && i.id !== invoiceId && Number(i.balance) > 0)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [invoices, customerId, invoiceId]
  );

  const preview = autoAllocateFIFO(outstanding.map(i => ({ id: i.id, balance: Number(i.balance) })), overpaid);
  const manualTotal = Object.values(manual).reduce((s, v) => s + (v || 0), 0);

  const run = async (allocations: { invoice_id: string; amount: number }[]) => {
    const allocated = allocations.reduce((s, a) => s + a.amount, 0);
    if (allocated > overpaid) { toast.error("Allocated more than the overpayment"); return; }
    try {
      await allocate.mutateAsync({
        customer_id: customerId,
        total_amount: overpaid,
        cash_amount: cashAmount,
        mpesa_amount: mpesaAmount,
        allocations,
        credit_amount: overpaid - allocated,
        credit_invoice_id: invoiceId,
        created_by: user?.id,
      });
      toast.success(
        allocated > 0
          ? `KES ${allocated.toLocaleString()} allocated${overpaid - allocated > 0 ? `, KES ${(overpaid - allocated).toLocaleString()} kept as credit` : ""}`
          : `KES ${overpaid.toLocaleString()} posted as credit on ${invoiceNumber || "this invoice"}`
      );
      onOpenChange(false);
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Overpayment — {customerName}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Customer paid <span className="font-bold text-success">KES {overpaid.toLocaleString()}</span> more than
            invoice {invoiceNumber ? <span className="font-mono">{invoiceNumber}</span> : ""}.
          </p>
        </DialogHeader>

        {outstanding.length === 0 ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              No other outstanding invoices. The extra amount will be posted as a credit on this invoice and shown
              on the customer statement.
            </p>
            <Button className="w-full" disabled={allocate.isPending} onClick={() => run([])}>
              <Wallet className="h-4 w-4 mr-1.5" /> Post KES {overpaid.toLocaleString()} as credit
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm">
              This customer has <span className="font-semibold">{outstanding.length}</span> unpaid invoice(s).
              Allocate the overpayment automatically (oldest first), manually, or keep it as a credit.
            </p>

            <Table>
              <TableHeader><TableRow>
                <TableHead>Invoice</TableHead><TableHead>Date</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="text-right">Auto</TableHead>
                <TableHead className="w-28">Manual</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {outstanding.map(inv => {
                  const auto = preview.find(a => a.invoice_id === inv.id);
                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="text-sm font-medium">{inv.invoice_number}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{format(new Date(inv.created_at), "dd MMM")}</TableCell>
                      <TableCell className="text-right text-sm">KES {Number(inv.balance).toLocaleString()}</TableCell>
                      <TableCell className="text-right text-sm font-semibold">{auto ? `KES ${auto.amount.toLocaleString()}` : "—"}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          className="h-8 w-24"
                          value={manual[inv.id] || ""}
                          onChange={e => setManual(prev => ({
                            ...prev,
                            [inv.id]: Math.min(Number(e.target.value), Number(inv.balance)),
                          }))}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {manualTotal > 0 && (
              <Badge variant="outline">Manual total: KES {manualTotal.toLocaleString()} of {overpaid.toLocaleString()}</Badge>
            )}

            <div className="grid gap-2 sm:grid-cols-3">
              <Button disabled={allocate.isPending} onClick={() => run(preview)}>
                <ArrowDownWideNarrow className="h-4 w-4 mr-1.5" /> Auto (FIFO)
              </Button>
              <Button variant="secondary" disabled={allocate.isPending || manualTotal <= 0}
                onClick={() => run(Object.entries(manual).filter(([, a]) => a > 0).map(([invoice_id, amount]) => ({ invoice_id, amount })))}>
                <SlidersHorizontal className="h-4 w-4 mr-1.5" /> Allocate manually
              </Button>
              <Button variant="outline" disabled={allocate.isPending} onClick={() => run([])}>
                <Wallet className="h-4 w-4 mr-1.5" /> Keep as credit
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
