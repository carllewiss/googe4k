import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Smartphone, CheckCircle2, XCircle, Loader2, Send } from "lucide-react";
import { useInitiateStk, useStkStatus, useInvalidateStk } from "@/hooks/useInvoiceStk";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  invoiceNumber?: string;
  customerId?: string | null;
  customerName?: string;
  defaultPhone?: string | null;
  amount: number;
  onPaid?: () => void;
}

export default function StkPushDialog({
  open, onOpenChange, invoiceId, invoiceNumber, customerId, customerName, defaultPhone, amount, onPaid,
}: Props) {
  const { user } = useAuth();
  const initiate = useInitiateStk();
  const invalidate = useInvalidateStk();

  const [phone, setPhone] = useState(defaultPhone || "");
  const [txId, setTxId] = useState<string | null>(null);
  const { data: tx } = useStkStatus(txId);

  useEffect(() => {
    if (open) {
      setPhone(defaultPhone || "");
      setTxId(null);
    }
  }, [open, defaultPhone]);

  // React to settlement
  useEffect(() => {
    if (!tx) return;
    if (tx.status === "success") {
      invalidate();
      onPaid?.();
    }
  }, [tx?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const phase: "form" | "waiting" | "success" | "failed" =
    tx?.status === "success" ? "success"
    : tx?.status === "failed" ? "failed"
    : txId ? "waiting"
    : "form";

  const send = async () => {
    if (!phone.trim()) { toast.error("Enter the customer's M-Pesa phone number"); return; }
    if (amount <= 0) { toast.error("Nothing to collect"); return; }
    try {
      const res = await initiate.mutateAsync({
        invoice_id: invoiceId,
        customer_id: customerId,
        phone: phone.trim(),
        amount,
        created_by: user?.id,
      });
      setTxId(res.transaction_id);
      toast.success(res.mode === "live" ? "STK push sent to customer" : "STK push sent (test mode)");
    } catch (e: any) {
      toast.error(e.message || "Failed to send STK push");
    }
  };

  const retry = () => setTxId(null);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-sm flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-success/10 text-success">
              <Smartphone className="h-5 w-5" />
            </span>
            M-Pesa STK Push
          </SheetTitle>
          <SheetDescription>Send a payment prompt to the customer's phone.</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4 flex-1">
          <div className="rounded-lg border bg-muted/40 p-3 space-y-2 text-sm">
            {invoiceNumber && (
              <div className="flex justify-between"><span className="text-muted-foreground">Invoice</span><span className="font-medium">{invoiceNumber}</span></div>
            )}
            <div className="flex justify-between"><span className="text-muted-foreground">Customer</span><span className="font-medium truncate max-w-[180px]">{customerName || "Walk-in"}</span></div>
            <div className="flex justify-between border-t pt-2"><span className="text-muted-foreground">Amount</span><span className="font-bold text-success">KES {Math.round(amount).toLocaleString()}</span></div>
          </div>

          {phase === "form" && (
            <div className="space-y-2">
              <Label className="text-xs">Phone Number</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0722 123 456"
                inputMode="tel"
              />
              <p className="text-xs text-muted-foreground">The customer receives a prompt to enter their M-Pesa PIN.</p>
            </div>
          )}

          {phase === "waiting" && (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-6 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-success" />
              <p className="text-sm font-medium">Waiting for customer…</p>
              <p className="text-xs text-muted-foreground">Prompt sent to {phone}. Ask the customer to enter their PIN.</p>
            </div>
          )}

          {phase === "success" && (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-success/30 bg-success/5 p-6 text-center">
              <CheckCircle2 className="h-9 w-9 text-success" />
              <p className="text-sm font-semibold text-success">Payment received</p>
              {tx?.mpesa_receipt_number && <p className="text-xs text-muted-foreground">Receipt: {tx.mpesa_receipt_number}</p>}
              <p className="text-xs text-muted-foreground">Invoice marked paid & posted to the ledger.</p>
            </div>
          )}

          {phase === "failed" && (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
              <XCircle className="h-9 w-9 text-destructive" />
              <p className="text-sm font-semibold text-destructive">Payment not completed</p>
              <p className="text-xs text-muted-foreground">{tx?.result_desc || "The customer cancelled or the request timed out."}</p>
            </div>
          )}
        </div>

        <div className="pt-3 border-t">
          {phase === "form" && (
            <Button className="w-full bg-success hover:bg-success/90 text-success-foreground" onClick={send} disabled={initiate.isPending}>
              {initiate.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Send STK Push
            </Button>
          )}
          {phase === "waiting" && (
            <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>Close (keeps waiting)</Button>
          )}
          {phase === "success" && (
            <Button className="w-full" onClick={() => onOpenChange(false)}>Done</Button>
          )}
          {phase === "failed" && (
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Close</Button>
              <Button className="flex-1 bg-success hover:bg-success/90 text-success-foreground" onClick={retry}>Retry STK</Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
