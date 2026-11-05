import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { useVoucherInventory, useUploadVouchers, type VoucherUploadRow } from "@/hooks/useVouchers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Ticket, Upload, Download, ChevronLeft, ChevronRight, Search, CheckCircle2, Circle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";

const pkgLabel = (t?: string | null) => {
  if (!t) return "—";
  if (t === "2hour") return "2-Hour";
  if (t === "24hour") return "24-Hour";
  return t;
};

const TABS: { key: "all" | "unused" | "used"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unused", label: "Unused" },
  { key: "used", label: "Used" },
];

export default function VoucherInventory() {
  const [status, setStatus] = useState<"all" | "used" | "unused">("all");
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const pageSize = 25;
  const fileRef = useRef<HTMLInputElement>(null);

  const { data, isFetching } = useVoucherInventory({ page, pageSize, status, search });
  const upload = useUploadVouchers();

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totals = data?.totals ?? { all: 0, used: 0, unused: 0 };
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      { code: "ABC123XYZ", package_type: "2hour", duration_hours: 2 },
      { code: "DEF456UVW", package_type: "24hour", duration_hours: 24 },
    ]);
    ws["!cols"] = [{ wch: 18 }, { wch: 14 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Vouchers");
    XLSX.writeFile(wb, "wifi-voucher-template.xlsx");
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });
      const vouchers: VoucherUploadRow[] = json
        .map((r) => {
          const code = String(r.code ?? r.Code ?? r.CODE ?? r.voucher ?? r.Voucher ?? "").trim();
          const pkg = String(r.package_type ?? r.package ?? r.Package ?? r.PackageType ?? "").trim();
          const durRaw = r.duration_hours ?? r.duration ?? r.Duration ?? r.DurationHours;
          const dur = parseInt(String(durRaw ?? ""), 10);
          return code
            ? { code, package_type: pkg || undefined, duration_hours: isNaN(dur) ? undefined : dur }
            : null;
        })
        .filter(Boolean) as VoucherUploadRow[];
      if (vouchers.length === 0) {
        toast({ title: "No vouchers found", description: "Make sure the sheet has a 'code' column.", variant: "destructive" });
        return;
      }
      upload.mutate(vouchers);
    } catch (err: any) {
      toast({ title: "Could not read file", description: String(err?.message ?? err), variant: "destructive" });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Ticket className="h-4 w-4" /> Voucher Inventory
            <span className="text-xs font-normal text-muted-foreground">
              {totals.all} total · {totals.unused} unused · {totals.used} used
            </span>
          </CardTitle>
          <div className="flex items-center gap-2">
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-1.5" /> Template
            </Button>
            <Button size="sm" onClick={() => fileRef.current?.click()} disabled={upload.isPending}>
              <Upload className="h-4 w-4 mr-1.5" /> {upload.isPending ? "Uploading…" : "Upload Vouchers"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1">
            {TABS.map((t) => (
              <Button
                key={t.key}
                variant={status === t.key ? "default" : "outline"}
                size="sm"
                onClick={() => { setStatus(t.key); setPage(1); }}
              >
                {t.label}
                <Badge variant="secondary" className="ml-1.5">{totals[t.key]}</Badge>
              </Button>
            ))}
          </div>
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => { e.preventDefault(); setPage(1); setSearch(searchInput.trim()); }}
          >
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search code…"
                className="pl-8 h-9 w-44"
              />
            </div>
            <Button type="submit" variant="outline" size="sm">Search</Button>
          </form>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Voucher Code</TableHead>
                <TableHead>Package</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Used By (MAC)</TableHead>
                <TableHead>Used At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                    {isFetching ? "Loading…" : "No vouchers found."}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((v) => {
                  const used = v.is_used || v.status === "used";
                  return (
                    <TableRow key={v.id}>
                      <TableCell className="font-mono text-xs font-medium">{v.code || "—"}</TableCell>
                      <TableCell><Badge variant="secondary">{pkgLabel(v.package_type)}</Badge></TableCell>
                      <TableCell>
                        {used ? (
                          <Badge className="gap-1"><CheckCircle2 className="h-3 w-3" /> Used</Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 text-success border-success/40">
                            <Circle className="h-3 w-3" /> Unused
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{v.used_by_mac || "—"}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {v.used_at ? format(new Date(v.used_at), "dd MMM yyyy, HH:mm") : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Page {page} of {totalPages} · {total} voucher{total === 1 ? "" : "s"}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1 || isFetching} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              <ChevronLeft className="h-4 w-4" /> Prev
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages || isFetching} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
