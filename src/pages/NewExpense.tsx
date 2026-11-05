import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAccounts } from "@/hooks/useAccounting";
import { useSuppliers } from "@/hooks/useSuppliers";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { useCreateExpense, uploadExpenseReceipt, PaymentMethod } from "@/hooks/useExpenses";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, UploadCloud, FileText, Trash2, CheckCircle2, Save } from "lucide-react";
import { toast } from "sonner";

const PAYMENT_METHODS: { value: PaymentMethod; label: string; code: string | null }[] = [
  { value: "cash", label: "Cash", code: "1000" },
  { value: "bank", label: "Bank", code: "1010" },
  { value: "mpesa", label: "M-Pesa", code: "1030" },
  { value: "credit", label: "Credit (Pay Later)", code: "2000" },
];
const BANK_CODES = ["1010", "1020"];
const fmt = (n: number) => `KSh ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function NewExpense() {
  const navigate = useNavigate();
  const { data: accounts = [] } = useAccounts();
  const { data: suppliers = [] } = useSuppliers();
  const { data: settings = {} } = useSystemSettings();
  const createExpense = useCreateExpense();
  const fileRef = useRef<HTMLInputElement>(null);

  const vatRate = Number(settings.default_tax_rate || "16") / 100;
  const expenseAccounts = accounts.filter((a: any) => a.type === "expense");
  const bankAccounts = accounts.filter((a: any) => BANK_CODES.includes(a.code));

  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split("T")[0]);
  const [accountId, setAccountId] = useState("");
  const [supplierId, setSupplierId] = useState<string>("none");
  const [referenceNo, setReferenceNo] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [bankAccountId, setBankAccountId] = useState("");
  const [gross, setGross] = useState(0); // total entered by user
  const [includeVat, setIncludeVat] = useState(false);
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  // VAT math: gross is the total; when includeVat, back out VAT to get net.
  const { net, vat, total } = useMemo(() => {
    if (includeVat && vatRate > 0) {
      const netV = gross / (1 + vatRate);
      return { net: netV, vat: gross - netV, total: gross };
    }
    return { net: gross, vat: 0, total: gross };
  }, [gross, includeVat, vatRate]);

  const selectedAccount = expenseAccounts.find((a: any) => a.id === accountId);

  const resolvePaymentAccountId = () => {
    if (method === "bank") {
      return bankAccountId || bankAccounts[0]?.id || null;
    }
    const code = PAYMENT_METHODS.find(m => m.value === method)?.code;
    return accounts.find((a: any) => a.code === code)?.id || null;
  };

  const save = async (again: boolean) => {
    if (!accountId) { toast.error("Select an expense account"); return; }
    if (gross <= 0) { toast.error("Enter an amount"); return; }
    const payAcc = resolvePaymentAccountId();
    if (!payAcc) { toast.error("Could not resolve payment account"); return; }
    setSaving(true);
    try {
      let attachment_url: string | null = null;
      if (file) attachment_url = await uploadExpenseReceipt(file);
      await createExpense.mutateAsync({
        category: selectedAccount?.name || "Other",
        description,
        amount: Number(net.toFixed(2)),
        vat_amount: Number(vat.toFixed(2)),
        reference_no: referenceNo || null,
        payment_method: method,
        account_id: accountId,
        payment_account_id: payAcc,
        supplier_id: supplierId === "none" ? null : supplierId,
        attachment_url,
        expense_date: expenseDate,
      });
      toast.success("Expense recorded & posted to the General Ledger");
      if (again) {
        setGross(0); setDescription(""); setReferenceNo(""); setFile(null); setIncludeVat(false);
      } else {
        navigate("/expenses");
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <button onClick={() => navigate("/expenses")} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1">
            <ChevronLeft className="h-3.5 w-3.5" /> Expenses
          </button>
          <h1 className="text-2xl font-bold font-heading">New Expense</h1>
          <p className="text-sm text-muted-foreground">Record and manage your business expenses</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate("/expenses")}>Cancel</Button>
          <Button onClick={() => save(false)} disabled={saving}><Save className="h-4 w-4 mr-1" /> Save Expense</Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Main form */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3"><CardTitle className="text-base text-primary">Expense Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Expense Date <span className="text-destructive">*</span></Label>
                <Input type="date" value={expenseDate} onChange={e => setExpenseDate(e.target.value)} />
              </div>
              <div>
                <Label>Expense Category <span className="text-destructive">*</span></Label>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger><SelectValue placeholder="Select expense account..." /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {expenseAccounts.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Supplier (Optional)</Label>
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger><SelectValue placeholder="Select supplier..." /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value="none">— None —</SelectItem>
                    {suppliers.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Reference / Receipt No.</Label>
                <Input value={referenceNo} onChange={e => setReferenceNo(e.target.value)} placeholder="e.g. FUEL-INV-0987" />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Payment Method <span className="text-destructive">*</span></Label>
                <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {method === "bank" && (
                <div>
                  <Label>Bank Account</Label>
                  <Select value={bankAccountId} onValueChange={setBankAccountId}>
                    <SelectTrigger><SelectValue placeholder="Select bank..." /></SelectTrigger>
                    <SelectContent>
                      {bankAccounts.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="grid sm:grid-cols-3 gap-4 items-end">
              <div>
                <Label>Amount (KSh) <span className="text-destructive">*</span></Label>
                <Input type="number" min={0} value={gross || ""} onChange={e => setGross(Number(e.target.value))} />
              </div>
              <label className="flex items-center gap-2 pb-2.5 cursor-pointer select-none">
                <Checkbox checked={includeVat} onCheckedChange={(c) => setIncludeVat(!!c)} />
                <span className="text-sm">Amount Includes VAT</span>
              </label>
              <div>
                <Label>VAT ({(vatRate * 100).toFixed(0)}%)</Label>
                <Input value={vat.toFixed(2)} readOnly className="bg-muted/40" />
              </div>
            </div>

            <div>
              <Label>Description <span className="text-destructive">*</span></Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value.slice(0, 200))} rows={3} placeholder="What was this expense for?" />
              <p className="text-[11px] text-muted-foreground text-right mt-1">{description.length}/200</p>
            </div>

            <div>
              <Label>Receipt Upload</Label>
              <div
                onClick={() => fileRef.current?.click()}
                className="mt-1 border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
              >
                <UploadCloud className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
                <p className="text-sm text-muted-foreground">Drag & drop or <span className="text-primary font-medium">choose a file</span></p>
                <p className="text-[11px] text-muted-foreground mt-1">JPG, PNG, PDF (Max 5MB)</p>
                <input ref={fileRef} type="file" accept="image/*,application/pdf" hidden
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f && f.size > 5 * 1024 * 1024) { toast.error("File must be ≤ 5MB"); return; }
                    setFile(f || null);
                  }} />
              </div>
              {file && (
                <div className="flex items-center justify-between border rounded-md px-3 py-2 mt-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="text-sm truncate">{file.name}</span>
                    <span className="text-[11px] text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</span>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => setFile(null)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Summary sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base text-primary">Expense Summary</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Expense Account</p>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{selectedAccount?.name || "—"}</span>
                  <span className="font-mono text-xs text-muted-foreground">{selectedAccount?.code || ""}</span>
                </div>
              </div>
              <div className="border-t pt-3 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Base Amount</span><span>{fmt(net)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">VAT ({(vatRate * 100).toFixed(0)}%)</span><span>{fmt(vat)}</span></div>
              </div>
              <div className="border-t pt-3 flex justify-between items-center">
                <span className="font-semibold">Total Amount</span>
                <span className="text-xl font-bold text-primary">{fmt(total)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start gap-2 text-sm bg-accent-soft rounded-md p-3">
                <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
                <span className="text-xs">This expense will be recorded and posted to the General Ledger immediately.</span>
              </div>
              <Button variant="outline" className="w-full" onClick={() => save(true)} disabled={saving}>Save &amp; New</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
