import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useCreateCreditNote, type RefundMethod } from "@/hooks/useCreditNotes";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  invoiceId: string | null;
  onCreated?: (creditNoteId: string) => void;
}

interface InvLine {
  id: string;
  product_id: string;
  product_name: string;
  is_service: boolean;
  quantity: number;
  already_credited: number;
  unit_price: number;
}

export function CreditNoteDialog({ open, onOpenChange, invoiceId, onCreated }: Props) {
  const [invoice, setInvoice] = useState<any>(null);
  const [lines, setLines] = useState<InvLine[]>([]);
  const [scope, setScope] = useState<"full" | "partial">("full");
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  const [refundMethod, setRefundMethod] = useState<RefundMethod>("none");
  const [loading, setLoading] = useState(false);
  const create = useCreateCreditNote();

  useEffect(() => {
    if (!open || !invoiceId) return;
    setLoading(true);
    (async () => {
      const { data: inv } = await supabase
        .from("invoices")
        .select("*, customers(name, customer_code)")
        .eq("id", invoiceId).maybeSingle();
      const { data: items } = await supabase
        .from("invoice_items")
        .select("id, product_id, quantity, unit_price, products(name, is_service)")
        .eq("invoice_id", invoiceId);
      const { data: priorCN } = await supabase
        .from("credit_note_items")
        .select("invoice_item_id, quantity")
        .in("invoice_item_id", (items || []).map((i: any) => i.id));
      const credited: Record<string, number> = {};
      (priorCN || []).forEach((c: any) => {
        credited[c.invoice_item_id] = (credited[c.invoice_item_id] || 0) + Number(c.quantity);
      });
      const ls: InvLine[] = (items || []).map((it: any) => ({
        id: it.id,
        product_id: it.product_id,
        product_name: it.products?.name || "Item",
        is_service: !!it.products?.is_service,
        quantity: Number(it.quantity),
        already_credited: credited[it.id] || 0,
        unit_price: Number(it.unit_price),
      }));
      setInvoice(inv);
      setLines(ls);
      const init: Record<string, number> = {};
      ls.forEach(l => { init[l.id] = Math.max(l.quantity - l.already_credited, 0); });
      setSelected(init);
      setScope("full");
      setReason("");
      setRefundMethod(Number(inv?.paid_amount || 0) > 0 ? "credit_balance" : "none");
      setLoading(false);
    })();
  }, [open, invoiceId]);

  const fullyPaid = invoice && Number(invoice.paid_amount) >= Number(invoice.total) && Number(invoice.total) > 0;
  const hasPaid = invoice && Number(invoice.paid_amount) > 0;

  const totalCredited = useMemo(() => {
    return lines.reduce((sum, l) => sum + (selected[l.id] || 0) * l.unit_price, 0);
  }, [lines, selected]);

  const setLineQty = (id: string, v: number, max: number) => {
    const q = Math.max(0, Math.min(max, Math.floor(v) || 0));
    setSelected(s => ({ ...s, [id]: q }));
  };

  const onScopeChange = (v: "full" | "partial") => {
    setScope(v);
    if (v === "full") {
      const all: Record<string, number> = {};
      lines.forEach(l => { all[l.id] = Math.max(l.quantity - l.already_credited, 0); });
      setSelected(all);
    }
  };

  const submit = async () => {
    if (!invoiceId) return;
    const payload = lines
      .filter(l => (selected[l.id] || 0) > 0)
      .map(l => ({ invoice_item_id: l.id, quantity: selected[l.id] }));
    if (payload.length === 0) {
      toast.error("Select at least one item to credit");
      return;
    }
    try {
      const id = await create.mutateAsync({
        invoice_id: invoiceId, reason, refund_method: refundMethod, items: payload,
      });
      toast.success("Credit note created — stock restored");
      onOpenChange(false);
      onCreated?.(id);
    } catch (e: any) {
      toast.error(e.message || "Failed to create credit note");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Issue Credit Note</DialogTitle>
        </DialogHeader>

        {loading && <p className="text-sm text-muted-foreground">Loading invoice…</p>}

        {invoice && (
          <div className="space-y-4">
            <div className="text-sm bg-muted/40 p-3 rounded-md">
              <div className="flex justify-between">
                <span><span className="font-bold">Invoice:</span> {invoice.invoice_number}</span>
                <span><span className="font-bold">Customer:</span> {invoice.customers?.name}</span>
              </div>
              <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                <span>Total: KES {Number(invoice.total).toLocaleString()}</span>
                <span>Paid: KES {Number(invoice.paid_amount).toLocaleString()}</span>
                <span>Balance: KES {Number(invoice.balance).toLocaleString()}</span>
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Scope</Label>
              <RadioGroup value={scope} onValueChange={(v) => onScopeChange(v as any)} className="flex gap-4">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="full" id="full" />
                  <Label htmlFor="full" className="cursor-pointer">Full invoice</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="partial" id="partial" />
                  <Label htmlFor="partial" className="cursor-pointer">Specific items / quantities</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="border rounded-md">
              <div className="grid grid-cols-12 text-xs font-bold p-2 border-b bg-muted/30">
                <div className="col-span-6">Item</div>
                <div className="col-span-2 text-right">Sold</div>
                <div className="col-span-2 text-right">Credited</div>
                <div className="col-span-2 text-right">Return Qty</div>
              </div>
              {lines.map(l => {
                const max = l.quantity - l.already_credited;
                return (
                  <div key={l.id} className="grid grid-cols-12 items-center p-2 border-b text-sm">
                    <div className="col-span-6">
                      {l.product_name}
                      {l.is_service && <Badge variant="outline" className="ml-2 text-[10px]">service</Badge>}
                    </div>
                    <div className="col-span-2 text-right">{l.quantity}</div>
                    <div className="col-span-2 text-right text-muted-foreground">{l.already_credited}</div>
                    <div className="col-span-2 text-right">
                      <Input
                        type="number" min={0} max={max}
                        disabled={scope === "full" || max === 0}
                        value={selected[l.id] ?? 0}
                        onChange={(e) => setLineQty(l.id, Number(e.target.value), max)}
                        className="h-8 text-right"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div>
              <Label htmlFor="reason">Reason</Label>
              <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Customer returned faulty unit" rows={2} />
            </div>

            <div>
              <Label className="mb-2 block">Settlement</Label>
              {!hasPaid ? (
                <p className="text-xs text-muted-foreground">Invoice has no payments — credit will reduce the outstanding balance.</p>
              ) : (
                <RadioGroup value={refundMethod} onValueChange={(v) => setRefundMethod(v as RefundMethod)} className="space-y-2">
                  <div className="flex items-start gap-2">
                    <RadioGroupItem value="credit_balance" id="cb" className="mt-1" />
                    <Label htmlFor="cb" className="cursor-pointer font-normal">
                      Credit customer account
                      <span className="block text-xs text-muted-foreground">Keeps cash, reduces customer balance / creates store credit.</span>
                    </Label>
                  </div>
                  <div className="flex items-start gap-2">
                    <RadioGroupItem value="cash_refund" id="cr" className="mt-1" />
                    <Label htmlFor="cr" className="cursor-pointer font-normal">
                      Cash refund
                      <span className="block text-xs text-muted-foreground">Refund cash; customer balance untouched.</span>
                    </Label>
                  </div>
                  <div className="flex items-start gap-2">
                    <RadioGroupItem value="mpesa_refund" id="mr" className="mt-1" />
                    <Label htmlFor="mr" className="cursor-pointer font-normal">M-Pesa refund</Label>
                  </div>
                  {!fullyPaid && (
                    <div className="flex items-start gap-2">
                      <RadioGroupItem value="none" id="none" className="mt-1" />
                      <Label htmlFor="none" className="cursor-pointer font-normal">
                        No refund — reduce outstanding balance only
                      </Label>
                    </div>
                  )}
                </RadioGroup>
              )}
            </div>

            <div className="bg-primary/5 border border-primary/20 rounded p-3 flex justify-between text-sm">
              <span className="font-bold">Credit Note Total</span>
              <span className="font-mono font-bold">KES {totalCredited.toLocaleString()}</span>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={create.isPending || !invoice || totalCredited <= 0}>
            {create.isPending ? "Issuing…" : "Issue Credit Note"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
