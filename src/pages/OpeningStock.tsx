import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { useProductWithStock } from "@/hooks/useProducts";
import { useOpeningStockRuns, usePostOpeningStock } from "@/hooks/useOpeningStock";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, Upload, Download, PackagePlus } from "lucide-react";

type Line = { key: string; product_id: string; quantity: string; unit_cost: string };

const newLine = (): Line => ({ key: crypto.randomUUID(), product_id: "", quantity: "", unit_cost: "" });

export default function OpeningStock() {
  const { data: products = [] } = useProductWithStock();
  const { data: runs = [] } = useOpeningStockRuns();
  const post = usePostOpeningStock();
  const fileRef = useRef<HTMLInputElement>(null);

  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("Opening stock brought forward");
  const [lines, setLines] = useState<Line[]>([newLine()]);

  const stockables = useMemo(() => products.filter((p: any) => !p.is_service), [products]);

  const valid = lines.filter(
    (l) => l.product_id && Number(l.quantity) > 0 && Number(l.unit_cost) >= 0
  );
  const totalValue = valid.reduce((s, l) => s + Number(l.quantity) * Number(l.unit_cost), 0);

  const update = (key: string, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const downloadTemplate = () => {
    const rows = stockables.slice(0, 200).map((p: any) => ({
      "Product Name": p.name,
      Quantity: "",
      "Unit Cost (KES)": "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ "Product Name": "", Quantity: "", "Unit Cost (KES)": "" }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Opening Stock");
    XLSX.writeFile(wb, "opening-stock-template.xlsx");
  };

  const handleFile = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet);
      const byName = new Map(stockables.map((p: any) => [String(p.name).trim().toLowerCase(), p.id]));

      const parsed: Line[] = [];
      const unmatched: string[] = [];
      rows.forEach((r) => {
        const name = String(r["Product Name"] ?? r["Product"] ?? r["name"] ?? "").trim();
        const qty = Number(r["Quantity"] ?? r["quantity"] ?? 0);
        const cost = Number(r["Unit Cost (KES)"] ?? r["Unit Cost"] ?? r["unit_cost"] ?? 0);
        if (!name || !qty) return;
        const id = byName.get(name.toLowerCase());
        if (!id) { unmatched.push(name); return; }
        parsed.push({ key: crypto.randomUUID(), product_id: id, quantity: String(qty), unit_cost: String(cost) });
      });

      if (!parsed.length) {
        toast.error("No matching rows found in the file");
        return;
      }
      setLines(parsed);
      toast.success(`Loaded ${parsed.length} line${parsed.length > 1 ? "s" : ""}`);
      if (unmatched.length) {
        toast.warning(`${unmatched.length} product name(s) not found: ${unmatched.slice(0, 4).join(", ")}${unmatched.length > 4 ? "…" : ""}`);
      }
    } catch (e: any) {
      toast.error(e.message || "Could not read that file");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const submit = async () => {
    try {
      await post.mutateAsync({
        items: valid.map((l) => ({
          product_id: l.product_id,
          quantity: Number(l.quantity),
          unit_cost: Number(l.unit_cost),
        })),
        entryDate,
        notes,
      });
      toast.success("Opening stock posted to inventory and the ledger");
      setLines([newLine()]);
    } catch (e: any) {
      toast.error(e.message || "Failed to post opening stock");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold font-heading">Opening Stock</h1>
          <p className="text-sm text-muted-foreground">
            Load stock you already owned before going live. Posts Inventory (Dr) / Owner Capital (Cr) — no supplier, no VAT, no cash movement.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-1" /> Template
          </Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4 mr-1" /> Upload Excel/CSV
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-4 grid gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Cut-off date</Label>
            <Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Narration</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Stock lines</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="w-32 text-right">Quantity</TableHead>
                <TableHead className="w-36 text-right">Cost Price</TableHead>
                <TableHead className="w-36 text-right">Value</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((l) => (
                <TableRow key={l.key}>
                  <TableCell>
                    <select
                      className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                      value={l.product_id}
                      onChange={(e) => update(l.key, { product_id: e.target.value })}
                    >
                      <option value="">Select product…</option>
                      {stockables.map((p: any) => (
                        <option key={p.id} value={p.id}>
                          {p.name} (on hand: {p.stock_on_hand})
                        </option>
                      ))}
                    </select>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number" min="0" className="text-right"
                      value={l.quantity}
                      onChange={(e) => update(l.key, { quantity: e.target.value })}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number" min="0" step="0.01" className="text-right"
                      value={l.unit_cost}
                      onChange={(e) => update(l.key, { unit_cost: e.target.value })}
                    />
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {(Number(l.quantity || 0) * Number(l.unit_cost || 0)).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="icon" variant="ghost" className="h-8 w-8 text-destructive"
                      onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((x) => x.key !== l.key) : [newLine()]))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between p-4 border-t">
            <Button variant="outline" size="sm" onClick={() => setLines((ls) => [...ls, newLine()])}>
              <Plus className="h-4 w-4 mr-1" /> Add line
            </Button>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-xs text-muted-foreground">{valid.length} valid line(s)</p>
                <p className="text-lg font-bold">KES {totalValue.toLocaleString()}</p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button disabled={!valid.length || post.isPending}>
                    <PackagePlus className="h-4 w-4 mr-1" /> Post Opening Stock
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Post opening stock?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This creates {valid.length} stock batch(es) worth KES {totalValue.toLocaleString()} dated {entryDate},
                      and posts one journal: Inventory debit, Owner Capital credit. Journals are immutable — double-check
                      quantities and cost prices first.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={submit}>Post</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Previous opening stock runs</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Narration</TableHead>
                <TableHead className="text-right">Items</TableHead>
                <TableHead className="text-right">Value (KES)</TableHead>
                <TableHead>Posted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                    No opening stock has been loaded yet.
                  </TableCell>
                </TableRow>
              ) : (
                runs.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm">{r.entry_date}</TableCell>
                    <TableCell className="text-sm">{r.notes || "—"}</TableCell>
                    <TableCell className="text-right text-sm">{r.item_count}</TableCell>
                    <TableCell className="text-right text-sm">{Number(r.total_value).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {new Date(r.created_at).toLocaleString()}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
