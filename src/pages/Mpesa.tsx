import { useMemo, useState } from "react";
import { useMpesaPayments, type MpesaEntry, type MpesaSource } from "@/hooks/useMpesa";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Smartphone, ChevronLeft, ChevronRight, Search } from "lucide-react";

const PAGE_SIZE = 25;

const SOURCE_LABEL: Record<MpesaSource, string> = {
  invoice: "Invoice",
  shop: "Store",
  wifi: "WiFi",
};

const SOURCE_STYLE: Record<MpesaSource, string> = {
  invoice: "bg-primary/10 text-primary",
  shop: "bg-success/10 text-success",
  wifi: "bg-accent/10 text-accent-foreground",
};

export default function Mpesa() {
  const { data: entries = [], isLoading } = useMpesaPayments();
  const [search, setSearch] = useState("");
  const [source, setSource] = useState<"all" | MpesaSource>("all");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (source !== "all" && e.source !== source) return false;
      if (!q) return true;
      return (
        (e.mpesa_code ?? "").toLowerCase().includes(q) ||
        (e.party ?? "").toLowerCase().includes(q) ||
        (e.phone ?? "").toLowerCase().includes(q) ||
        (e.reference ?? "").toLowerCase().includes(q)
      );
    });
  }, [entries, search, source]);

  const total = filtered.reduce((s, e) => s + e.amount, 0);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const resetPage = () => setPage(1);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Smartphone className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold font-heading">M-Pesa Reconciliation</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total M-Pesa</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">KES {total.toLocaleString()}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Transactions</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{filtered.length.toLocaleString()}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Paybill</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">4183147</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">All M-Pesa Payments</CardTitle>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search code, name, phone..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); resetPage(); }}
                className="pl-8 w-full sm:w-64"
              />
            </div>
            <Select value={source} onValueChange={(v) => { setSource(v as any); resetPage(); }}>
              <SelectTrigger className="w-full sm:w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                <SelectItem value="invoice">Invoices</SelectItem>
                <SelectItem value="shop">Store</SelectItem>
                <SelectItem value="wifi">WiFi</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Paid By</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>M-Pesa Code</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                      No M-Pesa payments found.
                    </TableCell>
                  </TableRow>
                ) : pageRows.map((e: MpesaEntry) => (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap">
                      {new Date(e.date).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}
                    </TableCell>
                    <TableCell>
                      <Badge className={SOURCE_STYLE[e.source]}>{SOURCE_LABEL[e.source]}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[160px] truncate">{e.party || "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">{e.phone || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{e.mpesa_code || "—"}</TableCell>
                    <TableCell className="max-w-[180px] truncate text-muted-foreground text-sm">{e.reference || "—"}</TableCell>
                    <TableCell className="text-right font-semibold whitespace-nowrap">
                      {e.amount.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filtered.length > PAGE_SIZE && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline" size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                >
                  <ChevronLeft className="h-4 w-4" /> Prev
                </Button>
                <span className="text-sm">Page {currentPage} / {totalPages}</span>
                <Button
                  variant="outline" size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                >
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
