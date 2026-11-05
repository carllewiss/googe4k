import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useAccounts, useTrialBalance, useJournals, useAccountLedger } from "@/hooks/useAccounting";

const fmt = (n: number) => `KES ${Number(n || 0).toLocaleString()}`;

export default function Accounting() {
  const { data: tb = [] } = useTrialBalance();
  const { data: journals = [] } = useJournals(200);
  const { data: accounts = [] } = useAccounts();
  const [acctId, setAcctId] = useState<string>("");
  const { data: ledger = [] } = useAccountLedger(acctId || null);

  const totals = useMemo(() => {
    let d = 0, c = 0;
    tb.forEach((r: any) => { d += Number(r.total_debit); c += Number(r.total_credit); });
    return { d, c };
  }, [tb]);

  const balanced = Math.abs(totals.d - totals.c) < 0.01;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-heading">Accounting</h1>
        <Badge className={balanced ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}>
          {balanced ? "Books Balanced" : `Out by ${fmt(totals.d - totals.c)}`}
        </Badge>
      </div>

      <Tabs defaultValue="tb">
        <TabsList>
          <TabsTrigger value="tb">Trial Balance</TabsTrigger>
          <TabsTrigger value="ledger">Account Ledger</TabsTrigger>
          <TabsTrigger value="journals">Journals</TabsTrigger>
        </TabsList>

        <TabsContent value="tb">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Trial Balance — All Accounts</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Code</TableHead><TableHead>Account</TableHead><TableHead>Type</TableHead>
                  <TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {tb.filter((r: any) => Number(r.total_debit) || Number(r.total_credit)).map((r: any) => (
                    <TableRow key={r.account_id}>
                      <TableCell className="font-mono text-xs">{r.code}</TableCell>
                      <TableCell className="text-sm font-medium">{r.name}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs capitalize">{r.type}</Badge></TableCell>
                      <TableCell className="text-right text-sm">{fmt(r.total_debit)}</TableCell>
                      <TableCell className="text-right text-sm">{fmt(r.total_credit)}</TableCell>
                      <TableCell className="text-right text-sm font-bold">{fmt(r.balance)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell colSpan={3}>TOTAL</TableCell>
                    <TableCell className="text-right">{fmt(totals.d)}</TableCell>
                    <TableCell className="text-right">{fmt(totals.c)}</TableCell>
                    <TableCell className="text-right">{fmt(totals.d - totals.c)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ledger">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Account Ledger</CardTitle>
              <Select value={acctId} onValueChange={setAcctId}>
                <SelectTrigger className="w-72"><SelectValue placeholder="Select account..." /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {accounts.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent className="p-0">
              {!acctId ? <p className="p-6 text-center text-muted-foreground text-sm">Select an account to view its ledger</p> : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Date</TableHead><TableHead>Reference</TableHead><TableHead>Description</TableHead>
                    <TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead>
                    <TableHead className="text-right">Running</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {(() => { let run = 0; return ledger.map((l: any) => {
                      run += Number(l.debit) - Number(l.credit);
                      return (
                        <TableRow key={l.id}>
                          <TableCell className="text-xs">{format(new Date(l.journal_entries.entry_date), "dd MMM yy")}</TableCell>
                          <TableCell className="text-xs"><Badge variant="outline" className="text-xs">{l.journal_entries.reference_type}</Badge></TableCell>
                          <TableCell className="text-sm">{l.journal_entries.description}</TableCell>
                          <TableCell className="text-right text-sm">{Number(l.debit) ? fmt(l.debit) : "—"}</TableCell>
                          <TableCell className="text-right text-sm">{Number(l.credit) ? fmt(l.credit) : "—"}</TableCell>
                          <TableCell className="text-right text-sm font-bold">{fmt(run)}</TableCell>
                        </TableRow>
                      );
                    }); })()}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="journals">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Recent Journal Entries</CardTitle></CardHeader>
            <CardContent className="p-0 space-y-2">
              {journals.map((j: any) => (
                <div key={j.id} className="border-b last:border-b-0 p-3">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{j.reference_type}</Badge>
                      <span className="text-sm font-medium">{j.description}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{format(new Date(j.entry_date), "dd MMM yyyy")}</span>
                  </div>
                  <Table>
                    <TableBody>
                      {j.journal_lines.map((l: any) => (
                        <TableRow key={l.id}>
                          <TableCell className="text-xs font-mono py-1">{l.accounts?.code}</TableCell>
                          <TableCell className="text-xs py-1">{l.accounts?.name}</TableCell>
                          <TableCell className="text-right text-xs py-1">{Number(l.debit) ? fmt(l.debit) : ""}</TableCell>
                          <TableCell className="text-right text-xs py-1">{Number(l.credit) ? fmt(l.credit) : ""}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
