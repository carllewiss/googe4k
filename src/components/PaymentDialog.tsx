import { useEffect, useState } from "react";
import { useInitiateStk, useStkStatus } from "@/hooks/useInvoiceStk";
import { Smartphone, Loader2, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useInvoices } from "@/hooks/useInvoices";
import { useAllocatePayment, autoAllocateFIFO } from "@/hooks/useFIFOPayment";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  customerName: string;
  currentBalance: number;
}

export default function PaymentDialog({ open, onOpenChange, customerId, customerName, currentBalance }: Props) {
  const { data: invoices = [] } = useInvoices();
  const allocatePayment = useAllocatePayment();
  const { user } = useAuth();

  const [totalAmount, setTotalAmount] = useState(0);
  const [cashAmount, setCashAmount] = useState(0);
  const [mpesaAmount, setMpesaAmount] = useState(0);
  const [manualAllocations, setManualAllocations] = useState<Record<string, number>>({});
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const initiateStk = useInitiateStk();
  const [stkPhone, setStkPhone] = useState("");
  const [stkAmount, setStkAmount] = useState(0);
  const [stkTxId, setStkTxId] = useState<string | null>(null);
  const { data: stkTx } = useStkStatus(stkTxId);
  const stkPaid = stkTx?.status === "success";

  // When the M-Pesa prompt is paid, lock the amount in so it can be allocated FIFO or manually
  useEffect(() => {
    if (stkTx?.status === "success") {
      const amt = Number(stkTx.amount);
      setCashAmount(0); setMpesaAmount(amt); setTotalAmount(amt);
      toast.success(`M-Pesa payment of KES ${amt.toLocaleString()} received — now allocate it`);
    } else if (stkTx?.status === "failed") {
      toast.error(stkTx.result_desc || "M-Pesa payment not completed");
    }
  }, [stkTx?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const sendStk = async () => {
    if (!stkPhone.trim()) { toast.error("Enter the M-Pesa phone number"); return; }
    if (stkAmount <= 0) { toast.error("Enter an amount"); return; }
    try {
      const res = await initiateStk.mutateAsync({ customer_id: customerId, phone: stkPhone.trim(), amount: stkAmount, created_by: user?.id });
      setStkTxId(res.transaction_id);
      toast.success("M-Pesa prompt sent to customer's phone");
    } catch (e: any) { toast.error(e.message || "Failed to send M-Pesa prompt"); }
  };

  const unpaidInvoices = invoices
    .filter(i => i.customer_id === customerId && Number(i.balance) > 0)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const agingLabel = (dateStr: string) => {
    const days = differenceInDays(new Date(), new Date(dateStr));
    if (days <= 14) return { text: "14d", cls: "bg-success/10 text-success" };
    if (days <= 30) return { text: "30d", cls: "bg-warning/10 text-warning" };
    return { text: "60d+", cls: "bg-destructive/10 text-destructive" };
  };

  const handleAutoAllocate = async () => {
    if (totalAmount <= 0) { toast.error("Enter an amount"); return; }
    const allocations = autoAllocateFIFO(
      unpaidInvoices.map(i => ({ id: i.id, balance: Number(i.balance) })),
      totalAmount
    );
    if (allocations.length === 0) { toast.error("No invoices to allocate to"); return; }
    const allocated = allocations.reduce((s, a) => s + a.amount, 0);
    const credit = Math.round((totalAmount - allocated) * 100) / 100;

    try {
      await allocatePayment.mutateAsync({
        customer_id: customerId,
        total_amount: totalAmount,
        cash_amount: cashAmount,
        mpesa_amount: mpesaAmount,
        allocations,
        credit_amount: credit > 0 ? credit : 0,
        credit_invoice_id: credit > 0 ? allocations[allocations.length - 1].invoice_id : undefined,
        created_by: user?.id,
      });
      toast.success(
        credit > 0
          ? `KES ${allocated.toLocaleString()} allocated · KES ${credit.toLocaleString()} kept as credit`
          : `KES ${totalAmount.toLocaleString()} allocated to ${allocations.length} invoice(s)`
      );
      onOpenChange(false);
      resetForm();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleManualAllocate = async () => {
    const allocations = Object.entries(manualAllocations)
      .filter(([, amt]) => amt > 0)
      .map(([invoice_id, amount]) => ({ invoice_id, amount }));

    if (allocations.length === 0) { toast.error("Allocate amounts to invoices"); return; }
    const allocated = allocations.reduce((s, a) => s + a.amount, 0);
    const total = Math.max(totalAmount, allocated);
    const credit = Math.round((total - allocated) * 100) / 100;

    try {
      await allocatePayment.mutateAsync({
        customer_id: customerId,
        total_amount: total,
        cash_amount: cashAmount,
        mpesa_amount: mpesaAmount,
        allocations,
        credit_amount: credit > 0 ? credit : 0,
        credit_invoice_id: credit > 0 ? allocations[allocations.length - 1].invoice_id : undefined,
        created_by: user?.id,
      });
      toast.success(
        credit > 0
          ? `KES ${allocated.toLocaleString()} allocated · KES ${credit.toLocaleString()} kept as credit`
          : `KES ${total.toLocaleString()} allocated manually`
      );
      onOpenChange(false);
      resetForm();
    } catch (e: any) { toast.error(e.message); }
  };

  const resetForm = () => {
    setTotalAmount(0);
    setCashAmount(0);
    setMpesaAmount(0);
    setManualAllocations({});
    setStkTxId(null); setStkAmount(0); setStkPhone("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record Payment — {customerName}</DialogTitle>
          <p className="text-sm text-muted-foreground">Outstanding: <span className="font-bold text-destructive">KES {currentBalance.toLocaleString()}</span></p>
        </DialogHeader>

        <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
          <p className="text-sm font-medium flex items-center gap-2"><Smartphone className="h-4 w-4 text-success" /> M-Pesa Prompt (STK)</p>
          {!stkTxId || stkTx?.status === "failed" ? (
            <div className="grid grid-cols-[1fr_120px_auto] gap-2">
              <Input placeholder="0722 123 456" inputMode="tel" value={stkPhone} onChange={e => setStkPhone(e.target.value)} />
              <Input type="number" placeholder="Amount" value={stkAmount || ""} onChange={e => setStkAmount(Number(e.target.value))} />
              <Button onClick={sendStk} disabled={initiateStk.isPending} className="bg-success hover:bg-success/90 text-success-foreground">
                {initiateStk.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send"}
              </Button>
            </div>
          ) : stkPaid ? (
            <p className="text-sm text-success flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Paid KES {Number(stkTx?.amount).toLocaleString()}{stkTx?.mpesa_receipt_number ? ` · ${stkTx.mpesa_receipt_number}` : ""} — choose FIFO or Manual below to allocate.</p>
          ) : (
            <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Waiting for the customer to enter their PIN…</p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div><Label className="text-xs">Cash</Label><Input type="number" disabled={stkPaid} value={cashAmount} onChange={e => { setCashAmount(Number(e.target.value)); setTotalAmount(Number(e.target.value) + mpesaAmount); }} /></div>
          <div><Label className="text-xs">M-Pesa</Label><Input type="number" disabled={stkPaid} value={mpesaAmount} onChange={e => { setMpesaAmount(Number(e.target.value)); setTotalAmount(cashAmount + Number(e.target.value)); }} /></div>
          <div><Label className="text-xs">Total</Label><Input type="number" value={totalAmount} readOnly className="bg-muted font-bold" /></div>
        </div>

        <Tabs value={mode} onValueChange={v => setMode(v as "auto" | "manual")}>
          <TabsList className="w-full">
            <TabsTrigger value="auto" className="flex-1">Auto-Allocate (FIFO)</TabsTrigger>
            <TabsTrigger value="manual" className="flex-1">Manual</TabsTrigger>
          </TabsList>

          <TabsContent value="auto" className="space-y-3">
            <p className="text-xs text-muted-foreground">Payment will be applied to the oldest invoices first.</p>
            {unpaidInvoices.length > 0 && (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Invoice</TableHead><TableHead>Date</TableHead><TableHead>Age</TableHead><TableHead className="text-right">Balance</TableHead><TableHead className="text-right">Will Pay</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {(() => {
                    const preview = autoAllocateFIFO(
                      unpaidInvoices.map(i => ({ id: i.id, balance: Number(i.balance) })),
                      totalAmount
                    );
                    return unpaidInvoices.map(inv => {
                      const alloc = preview.find(a => a.invoice_id === inv.id);
                      const aging = agingLabel(inv.created_at);
                      return (
                        <TableRow key={inv.id}>
                          <TableCell className="text-sm font-medium">{inv.invoice_number}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{format(new Date(inv.created_at), "dd MMM")}</TableCell>
                          <TableCell><Badge className={`text-xs ${aging.cls}`}>{aging.text}</Badge></TableCell>
                          <TableCell className="text-right text-sm">KES {Number(inv.balance).toLocaleString()}</TableCell>
                          <TableCell className="text-right text-sm font-bold">{alloc ? `KES ${alloc.amount.toLocaleString()}` : "—"}</TableCell>
                        </TableRow>
                      );
                    });
                  })()}
                </TableBody>
              </Table>
            )}
            <Button className="w-full" onClick={handleAutoAllocate} disabled={allocatePayment.isPending || totalAmount <= 0}>
              {allocatePayment.isPending ? "Processing..." : `Auto-Allocate KES ${totalAmount.toLocaleString()}`}
            </Button>
          </TabsContent>

          <TabsContent value="manual" className="space-y-3">
            <p className="text-xs text-muted-foreground">Enter amounts for specific invoices.</p>
            {unpaidInvoices.length > 0 && (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Invoice</TableHead><TableHead>Age</TableHead><TableHead className="text-right">Balance</TableHead><TableHead className="w-32">Pay Amount</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {unpaidInvoices.map(inv => {
                    const aging = agingLabel(inv.created_at);
                    return (
                      <TableRow key={inv.id}>
                        <TableCell className="text-sm font-medium">{inv.invoice_number}</TableCell>
                        <TableCell><Badge className={`text-xs ${aging.cls}`}>{aging.text}</Badge></TableCell>
                        <TableCell className="text-right text-sm">KES {Number(inv.balance).toLocaleString()}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            className="h-8 w-28"
                            max={Number(inv.balance)}
                            value={manualAllocations[inv.id] || ""}
                            onChange={e => setManualAllocations(prev => ({ ...prev, [inv.id]: Math.min(Number(e.target.value), Number(inv.balance)) }))}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
            <Button className="w-full" onClick={handleManualAllocate} disabled={allocatePayment.isPending}>
              {allocatePayment.isPending ? "Processing..." : "Allocate Manually"}
            </Button>
          </TabsContent>
        </Tabs>

        {unpaidInvoices.length === 0 && <p className="text-center text-muted-foreground py-4">No outstanding invoices</p>}
      </DialogContent>
    </Dialog>
  );
}
