import { useMemo, useState } from "react";
import { useAccounts, useCreateAccount, useUpdateAccount, AccountType } from "@/hooks/useAccounting";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Search } from "lucide-react";
import { toast } from "sonner";

const TYPES: AccountType[] = ["asset", "liability", "equity", "income", "expense"];
const typeColor: Record<string, string> = {
  asset: "bg-primary/10 text-primary",
  liability: "bg-warning/10 text-warning",
  equity: "bg-accent/20 text-accent-foreground",
  income: "bg-success/10 text-success",
  expense: "bg-destructive/10 text-destructive",
};

export function ChartOfAccountsManager() {
  const { data: accounts = [] } = useAccounts();
  const createAccount = useCreateAccount();
  const updateAccount = useUpdateAccount();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("expense");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return accounts
      .filter((a: any) => (typeFilter === "all" ? true : a.type === typeFilter))
      .filter((a: any) => !q || a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q));
  }, [accounts, search, typeFilter]);

  const openNew = () => {
    setEditingId(null); setCode(""); setName(""); setType("expense"); setOpen(true);
  };
  const openEdit = (a: any) => {
    setEditingId(a.id); setCode(a.code); setName(a.name); setType(a.type); setOpen(true);
  };

  const save = async () => {
    if (!code.trim() || !name.trim()) { toast.error("Code and name are required"); return; }
    try {
      if (editingId) {
        await updateAccount.mutateAsync({ id: editingId, code: code.trim(), name: name.trim(), type });
        toast.success("Account updated");
      } else {
        await createAccount.mutateAsync({ code: code.trim(), name: name.trim(), type });
        toast.success("Account created");
      }
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message?.includes("duplicate") ? "That account code already exists" : e.message);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between gap-3 flex-wrap">
        <CardTitle className="text-base">Chart of Accounts</CardTitle>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search code or name..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 w-56" />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {TYPES.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> New Account</Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead className="w-24">Code</TableHead>
            <TableHead>Account Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="w-16 text-right">Edit</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {filtered.map((a: any) => (
              <TableRow key={a.id}>
                <TableCell className="font-mono text-xs">{a.code}</TableCell>
                <TableCell className="text-sm font-medium">{a.name}</TableCell>
                <TableCell><Badge className={`text-xs capitalize ${typeColor[a.type] || ""}`}>{a.type}</Badge></TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(a)}><Pencil className="h-3.5 w-3.5" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-6">No accounts found</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? "Edit Account" : "New Account"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Code</Label><Input value={code} onChange={e => setCode(e.target.value)} placeholder="6200" /></div>
              <div className="col-span-2"><Label>Account Name</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Cleaning Expense" /></div>
            </div>
            <div><Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as AccountType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={createAccount.isPending || updateAccount.isPending}>Save Account</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
