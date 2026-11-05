import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useConvertWalkin, type WalkinHistory } from "@/hooks/useWalkins";
import { toast } from "sonner";

export default function WalkinConvertDialog({
  open,
  onOpenChange,
  phone,
  defaultName,
  history,
  onConverted,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  phone: string;
  defaultName?: string | null;
  history?: WalkinHistory | null;
  onConverted?: (customerId: string) => void;
}) {
  const convert = useConvertWalkin();
  const [name, setName] = useState(defaultName || "");
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [location, setLocation] = useState("");
  const [limit, setLimit] = useState(0);
  const [terms, setTerms] = useState(0);
  const [convertPrevious, setConvertPrevious] = useState(true);

  useEffect(() => {
    if (open) setName(defaultName || "");
  }, [open, defaultName]);

  const submit = async () => {
    if (!name.trim()) return toast.error("Name is required");
    try {
      const res = await convert.mutateAsync({
        phone,
        name,
        email: email.trim() || null,
        kra_pin: pin.trim().toUpperCase() || null,
        location: location.trim() || null,
        debt_limit: Number(limit) || 0,
        credit_terms: Number(terms) || 0,
        convertPrevious,
      });
      toast.success(
        convertPrevious
          ? `Customer created · ${res.moved} previous invoice${res.moved === 1 ? "" : "s"} moved`
          : "Customer created",
      );
      onConverted?.(res.customerId);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Convert Walk-in to Customer</DialogTitle>
          <DialogDescription>
            {history
              ? `${history.visits} previous walk-in visit${history.visits === 1 ? "" : "s"} · KES ${history.totalSpent.toLocaleString()} spent on ${phone}`
              : `Create a customer account for ${phone}`}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Phone</Label>
            <Input value={phone} disabled />
          </div>
          <div className="space-y-1">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>KRA PIN</Label>
            <Input className="uppercase" value={pin} onChange={(e) => setPin(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Location</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Credit Terms (days)</Label>
            <select
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
              value={terms}
              onChange={(e) => setTerms(Number(e.target.value))}
            >
              {[0, 2, 7, 14, 30, 60, 90].map((d) => (
                <option key={d} value={d}>{d === 0 ? "Cash / 0 days" : `${d} days`}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Credit Limit (KES)</Label>
            <Input type="number" min={0} value={limit} onChange={(e) => setLimit(Number(e.target.value))} />
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-md border p-3">
          <Switch checked={convertPrevious} onCheckedChange={setConvertPrevious} />
          <div>
            <p className="text-sm font-medium">Convert previous invoices</p>
            <p className="text-xs text-muted-foreground">
              Move all past walk-in sales on {phone} to this customer account.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={convert.isPending}>
            {convert.isPending ? "Converting..." : "Create & Convert"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
