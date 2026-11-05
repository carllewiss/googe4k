import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ADJUSTMENT_TYPES,
  useAdjustments,
  useAdjustmentAttachments,
  usePostAdjustment,
  useStockCosts,
  getEvidenceUrl,
  type AdjustmentType,
} from "@/hooks/useInventoryAdjustments";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Search, Package, Trash2, Paperclip, X, ClipboardList, AlertTriangle } from "lucide-react";

const money = (n: number) =>
  `KES ${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

type Line = {
  key: string;
  product_id: string;
  name: string;
  unit: string;
  on_hand: number;
  fifo_cost: number;
  avg_cost: number;
  sell_price: number;
  qty: string;
  cost: string;
  notes: string;
};

/* ---------------- product search ---------------- */
function ProductSearch({
  products,
  onSelect,
}: {
  products: any[];
  onSelect: (p: any) => void;
}) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 250);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const results = useMemo(() => {
    const q = debounced.trim().toLowerCase();
    const list = q
      ? products.filter(
          (p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
        )
      : products;
    return list.slice(0, 40);
  }, [debounced, products]);

  return (
    <div className="relative" ref={wrapRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          placeholder="Search stock to adjust — name or category…"
          className="pl-10"
          aria-label="Search stock"
        />
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-80 overflow-y-auto rounded-md border bg-popover shadow-elegant">
          {results.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground text-center">No stock items match.</p>
          ) : (
            <ul className="divide-y">
              {results.map((p) => (
                <li
                  key={p.id}
                  onMouseDown={() => { onSelect(p); setQuery(""); setOpen(false); }}
                  className="px-4 py-2.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-accent-soft/60"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded bg-muted"><Package className="h-4 w-4 text-primary" /></div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {p.category} · {p.stock_on_hand} {p.unit} on hand
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold">FIFO {money(p.fifo_cost)}</p>
                    <p className="text-[10px] text-muted-foreground">Sell {money(p.base_sell_price)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------- detail dialog ---------------- */
function AdjustmentDetail({ adj, onClose }: { adj: any; onClose: () => void }) {
  const { data: files = [] } = useAdjustmentAttachments(adj?.id);
  return (
    <Dialog open={!!adj} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{adj?.adjustment_no}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div><p className="text-muted-foreground text-xs">Type</p><p className="font-bold">{adj?.adjustment_type}</p></div>
            <div><p className="text-muted-foreground text-xs">Date</p><p className="font-bold">{adj?.adjustment_date}</p></div>
            <div><p className="text-muted-foreground text-xs">Warehouse</p><p className="font-bold">{adj?.warehouse}</p></div>
            <div><p className="text-muted-foreground text-xs">Value</p><p className="font-bold">{money(adj?.total_value)}</p></div>
          </div>
          {adj?.reason && <p className="text-sm"><span className="text-muted-foreground">Reason: </span>{adj.reason}</p>}
          {adj?.notes && <p className="text-sm"><span className="text-muted-foreground">Notes: </span>{adj.notes}</p>}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit cost</TableHead>
                <TableHead className="text-right">Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(adj?.inventory_adjustment_items || []).map((it: any) => (
                <TableRow key={it.id}>
                  <TableCell>{it.products?.name || "—"}</TableCell>
                  <TableCell className="text-right">{it.quantity}</TableCell>
                  <TableCell className="text-right">{money(it.unit_cost)}</TableCell>
                  <TableCell className="text-right">{money(it.value)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {files.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Evidence</p>
              <div className="flex flex-wrap gap-2">
                {files.map((f: any) => (
                  <Button
                    key={f.id}
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try { window.open(await getEvidenceUrl(f.file_path), "_blank"); }
                      catch (e: any) { toast.error(e.message || "Could not open file"); }
                    }}
                  >
                    <Paperclip className="h-3.5 w-3.5 mr-1" />{f.file_name}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- page ---------------- */
export default function InventoryAdjustments() {
  const { data: products = [], isLoading } = useStockCosts();
  const { data: history = [] } = useAdjustments();
  const post = usePostAdjustment();
  const fileRef = useRef<HTMLInputElement>(null);
  const [historySearch, setHistorySearch] = useState("");

  const [type, setType] = useState<AdjustmentType>("damaged");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [warehouse, setWarehouse] = useState("Kakamega Main Store");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [detail, setDetail] = useState<any>(null);

  const meta = ADJUSTMENT_TYPES.find((t) => t.value === type)!;
  const stockables = useMemo(() => products.filter((p: any) => !p.is_service), [products]);

  const filteredHistory = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    if (!q) return history;
    return history.filter((a: any) => {
      const inItems = (a.inventory_adjustment_items || []).some((it: any) =>
        (it.products?.name || "").toLowerCase().includes(q)
      );
      return (
        (a.adjustment_no || "").toLowerCase().includes(q) ||
        (a.adjustment_type || "").toLowerCase().includes(q) ||
        (a.reason || "").toLowerCase().includes(q) ||
        (a.notes || "").toLowerCase().includes(q) ||
        inItems
      );
    });
  }, [historySearch, history]);

  const addLine = (p: any) => {
    if (lines.some((l) => l.product_id === p.id)) {
      toast.info(`${p.name} is already on this adjustment`);
      return;
    }
    setLines((ls) => [
      ...ls,
      {
        key: crypto.randomUUID(),
        product_id: p.id,
        name: p.name,
        unit: p.unit,
        on_hand: p.stock_on_hand,
        fifo_cost: p.fifo_cost,
        avg_cost: p.avg_cost,
        sell_price: p.base_sell_price,
        qty: "",
        cost: String(p.fifo_cost || ""),
        notes: "",
      },
    ]);
  };

  const update = (key: string, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const signedQty = (l: Line) => {
    const n = Number(l.qty) || 0;
    if (meta.direction === "decrease") return -Math.abs(n);
    if (meta.direction === "increase") return Math.abs(n);
    if (meta.direction === "none") return 0;
    return n; // either — user may type a negative number
  };

  const lineValue = (l: Line) => {
    const q = signedQty(l);
    const unit = q > 0 ? Number(l.cost) || l.fifo_cost : l.avg_cost || l.fifo_cost;
    return q * unit;
  };

  const validLines = lines.filter((l) => meta.direction === "none" || Number(l.qty) > 0 || Number(l.qty) < 0);
  const totalValue = validLines.reduce((s, l) => s + lineValue(l), 0);
  const overdraw = validLines.filter((l) => signedQty(l) < 0 && Math.abs(signedQty(l)) > l.on_hand);

  const canPost = validLines.length > 0 && reason.trim().length > 0 && overdraw.length === 0 && !post.isPending;

  const submit = async () => {
    try {
      const res = await post.mutateAsync({
        type,
        reason: reason.trim(),
        notes: notes.trim() || null,
        date,
        warehouse,
        items: validLines.map((l) => ({
          product_id: l.product_id,
          quantity: signedQty(l),
          unit_cost: Number(l.cost) || 0,
          notes: l.notes || null,
        })),
        files,
      });
      toast.success("Adjustment posted — stock and ledger updated");
      if (res.failedUploads.length) toast.warning(`Could not upload: ${res.failedUploads.join(", ")}`);
      setLines([]); setFiles([]); setReason(""); setNotes("");
    } catch (e: any) {
      toast.error(e.message || "Failed to post adjustment");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading">Inventory Adjustments</h1>
        <p className="text-sm text-muted-foreground">
          Reason-coded stock changes with FIFO costing, evidence files and automatic double-entry posting.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="h-4 w-4" /> New adjustment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-1.5">
              <Label>Adjustment type</Label>
              <Select value={type} onValueChange={(v) => setType(v as AdjustmentType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ADJUSTMENT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">{meta.hint}</p>
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Warehouse</Label>
              <Input value={warehouse} onChange={(e) => setWarehouse(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Reason</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Screen cracked in transit" />
            </div>
          </div>

          <ProductSearch products={stockables} onSelect={addLine} />

          {lines.length > 0 && (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">On hand</TableHead>
                    <TableHead className="text-right">FIFO cost</TableHead>
                    <TableHead className="text-right w-28">Qty</TableHead>
                    <TableHead className="text-right w-32">Unit cost</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead className="w-48">Line note</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((l) => {
                    const q = signedQty(l);
                    const bad = q < 0 && Math.abs(q) > l.on_hand;
                    return (
                      <TableRow key={l.key} className={bad ? "bg-destructive/5" : ""}>
                        <TableCell>
                          <p className="font-bold text-sm">{l.name}</p>
                          <p className="text-xs text-muted-foreground">
                            avg {money(l.avg_cost)} · sell {money(l.sell_price)}
                          </p>
                        </TableCell>
                        <TableCell className="text-right">{l.on_hand} {l.unit}</TableCell>
                        <TableCell className="text-right">{money(l.fifo_cost)}</TableCell>
                        <TableCell className="text-right">
                          <Input
                            className="text-right"
                            type="number"
                            disabled={meta.direction === "none"}
                            value={l.qty}
                            onChange={(e) => update(l.key, { qty: e.target.value })}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            className="text-right"
                            type="number"
                            disabled={q < 0}
                            value={q < 0 ? String(l.avg_cost.toFixed(2)) : l.cost}
                            onChange={(e) => update(l.key, { cost: e.target.value })}
                          />
                        </TableCell>
                        <TableCell className="text-right font-bold">{money(lineValue(l))}</TableCell>
                        <TableCell>
                          <Input value={l.notes} onChange={(e) => update(l.key, { notes: e.target.value })} placeholder="optional" />
                        </TableCell>
                        <TableCell>
                          <Button size="icon" variant="ghost" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {overdraw.length > 0 && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
              <span>
                Not enough stock for: {overdraw.map((l) => l.name).join(", ")}. Reduce the quantity — negative stock is blocked.
              </span>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Extra context for the audit trail" />
            </div>
            <div className="space-y-1.5">
              <Label>Evidence (photos / PDF)</Label>
              <input
                ref={fileRef}
                type="file"
                multiple
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => {
                  setFiles((f) => [...f, ...Array.from(e.target.files || [])]);
                  if (fileRef.current) fileRef.current.value = "";
                }}
              />
              <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
                <Paperclip className="h-4 w-4 mr-2" /> Attach files
              </Button>
              <div className="flex flex-wrap gap-2 pt-1">
                {files.map((f, i) => (
                  <Badge key={`${f.name}-${i}`} variant="secondary" className="gap-1">
                    {f.name}
                    <button onClick={() => setFiles((fs) => fs.filter((_, x) => x !== i))} aria-label={`Remove ${f.name}`}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 flex-wrap border-t pt-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Total adjustment value</p>
              <p className={`text-xl font-black ${totalValue < 0 ? "text-destructive" : "text-success"}`}>
                {money(totalValue)}
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button disabled={!canPost}>Post adjustment</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Post this adjustment?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {validLines.length} line(s), {money(totalValue)}. Stock moves immediately and a journal is posted.
                    Adjustments cannot be edited — corrections require a reversing entry.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={submit}>Post</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3 space-y-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle className="text-base">Adjustment history</CardTitle>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Search by number, type, reason or product…"
                className="pl-10 pr-9"
                aria-label="Search adjustment history"
              />
              {historySearch && (
                <button
                  onClick={() => setHistorySearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Clear adjustment search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="text-right">Lines</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredHistory.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                      {isLoading
                        ? "Loading…"
                        : historySearch.trim()
                        ? `No adjustments match "${historySearch.trim()}".`
                        : "No adjustments posted yet."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredHistory.map((a: any) => (
                    <TableRow key={a.id} className="cursor-pointer" onClick={() => setDetail(a)}>
                      <TableCell className="font-bold">{a.adjustment_no}</TableCell>
                      <TableCell>{a.adjustment_date}</TableCell>
                      <TableCell><Badge variant="outline">{a.adjustment_type}</Badge></TableCell>
                      <TableCell className="max-w-xs truncate">{a.reason || "—"}</TableCell>
                      <TableCell className="text-right">{a.inventory_adjustment_items?.length || 0}</TableCell>
                      <TableCell className={`text-right font-bold ${Number(a.total_value) < 0 ? "text-destructive" : ""}`}>
                        {money(a.total_value)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {detail && <AdjustmentDetail adj={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
