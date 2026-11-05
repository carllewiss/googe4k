import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useCreateCustomer } from "@/hooks/useCustomers";
import { toast } from "sonner";

export default function AddCustomerDialog({
  open, onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const create = useCreateCustomer();
  const [form, setForm] = useState({
    name: "", phone: "", email: "", kra_pin: "", location: "",
    debt_limit: 0, credit_terms: 0,
  });

  const reset = () =>
    setForm({ name: "", phone: "", email: "", kra_pin: "", location: "", debt_limit: 0, credit_terms: 0 });

  const submit = async () => {
    if (!form.name.trim()) return toast.error("Name is required");
    try {
      await create.mutateAsync({
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || null,
        kra_pin: form.kra_pin.trim().toUpperCase() || undefined,
        location: form.location.trim() || null,
        customer_type: "regular",
        debt_limit: Number(form.debt_limit) || 0,
        credit_terms: Number(form.credit_terms) || 0,
      });
      toast.success("Customer added");
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Add Customer</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1">
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Phone</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>KRA PIN</Label>
            <Input className="uppercase" value={form.kra_pin} onChange={(e) => setForm({ ...form, kra_pin: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Location</Label>
            <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Credit Terms (days)</Label>
            <select
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
              value={form.credit_terms}
              onChange={(e) => setForm({ ...form, credit_terms: Number(e.target.value) })}
            >
              <option value={0}>Cash / 0 days</option>
              <option value={2}>2 days</option>
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
              <option value={60}>60 days</option>
              <option value={90}>90 days</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label>Credit Limit (KES)</Label>
            <Input type="number" min={0} value={form.debt_limit}
              onChange={(e) => setForm({ ...form, debt_limit: Number(e.target.value) })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={create.isPending}>Add Customer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
