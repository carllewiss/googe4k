import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Loader2, PackagePlus, Package, Wrench, Receipt, Monitor } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useProductsPurchaseView } from "@/hooks/usePurchaseWorkspace";
import { useAccounts } from "@/hooks/useAccounting";
import { useCreateProduct } from "@/hooks/useProducts";
import { toast } from "sonner";

export const ASSET_CATEGORIES = [
  "computer", "printer", "router", "furniture", "vehicle", "ups", "generator", "other",
] as const;

export type PickedItem = {
  line_type: "stock" | "service" | "expense" | "asset";
  product_id?: string | null;
  label: string;
  description?: string;
  unit_cost?: number | null;
  vat_rate?: number;
  expense_account_id?: string | null;
  asset_category?: string | null;
  meta?: string;
};

const TYPE_STYLES: Record<PickedItem["line_type"], { label: string; className: string; Icon: any }> = {
  stock: { label: "STOCK", className: "bg-primary/10 text-primary", Icon: Package },
  service: { label: "SERVICE", className: "bg-accent/20 text-accent-foreground", Icon: Wrench },
  expense: { label: "EXPENSE", className: "bg-warning/15 text-warning", Icon: Receipt },
  asset: { label: "ASSET", className: "bg-success/10 text-success", Icon: Monitor },
};

export function TypeBadge({ type }: { type: PickedItem["line_type"] }) {
  const s = TYPE_STYLES[type];
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider ${s.className}`}>
      {s.label}
    </span>
  );
}

interface Props {
  onSelect: (item: PickedItem) => void;
  placeholder?: string;
}

/** One search box across products, services, expense accounts and asset categories. */
export function PurchaseItemSearch({ onSelect, placeholder = "Search products, services, expenses or assets..." }: Props) {
  const { data: products = [], isLoading } = useProductsPurchaseView();
  const { data: accounts = [] } = useAccounts();
  const createProduct = useCreateProduct();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [np, setNp] = useState({
    name: "", category: "Phone Accessories" as any, base_sell_price: 0,
    unit: "pcs", tax_category: "standard" as any, is_service: false,
  });

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 180);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const results = useMemo<PickedItem[]>(() => {
    const q = debounced.trim().toLowerCase();
    const match = (s: string) => !q || s.toLowerCase().includes(q);

    const prod: PickedItem[] = products
      .filter((p) => match(p.name) || match(p.category || ""))
      .map((p) => ({
        line_type: p.is_service ? "service" : "stock",
        product_id: p.id,
        label: p.name,
        unit_cost: p.last_cost,
        vat_rate: p.vat_rate != null ? Number(p.vat_rate) : p.tax_category === "standard" ? 16 : 0,
        meta: p.is_service
          ? p.category
          : `${p.category} · ${p.stock_on_hand} in stock${p.last_cost != null ? ` · last KES ${Number(p.last_cost).toLocaleString()}` : ""}`,
      }));

    const exp: PickedItem[] = (accounts as any[])
      .filter((a) => a.type === "expense" && a.is_active !== false && (match(a.name) || match(a.code)))
      .map((a) => ({
        line_type: "expense" as const,
        label: a.name,
        description: a.name,
        expense_account_id: a.id,
        vat_rate: 16,
        meta: `Expense account ${a.code}`,
      }));

    const assets: PickedItem[] = ASSET_CATEGORIES
      .filter((c) => match(c) || match("asset"))
      .map((c) => ({
        line_type: "asset" as const,
        label: c.charAt(0).toUpperCase() + c.slice(1),
        description: c.charAt(0).toUpperCase() + c.slice(1),
        asset_category: c,
        vat_rate: 16,
        meta: "Fixed asset — added to the asset register",
      }));

    return [...prod, ...exp, ...assets].slice(0, 60);
  }, [debounced, products, accounts]);

  const pick = (item: PickedItem) => {
    onSelect(item);
    setQuery("");
    setOpen(false);
  };

  const submitQuick = async () => {
    if (!np.name.trim()) return toast.error("Item name required");
    try {
      const created = await createProduct.mutateAsync({
        name: np.name.trim(),
        category: np.category,
        base_sell_price: Number(np.base_sell_price) || 0,
        floor_price: 0,
        unit: np.unit || "pcs",
        min_stock: 0,
        is_service: np.is_service,
        tax_category: np.tax_category,
        vat_rate: np.tax_category === "standard" ? 16 : 0,
      });
      pick({
        line_type: created.is_service ? "service" : "stock",
        product_id: created.id,
        label: created.name,
        unit_cost: null,
        vat_rate: np.tax_category === "standard" ? 16 : 0,
      });
      setQuickOpen(false);
      setNp({ name: "", category: "Phone Accessories", base_sell_price: 0, unit: "pcs", tax_category: "standard", is_service: false });
      toast.success("Item added");
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4 text-muted-foreground" />}
        </div>
        <Input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="pl-9"
        />
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-popover shadow-elegant rounded-md border max-h-96 overflow-y-auto">
          {results.length > 0 ? (
            <ul className="divide-y">
              {results.map((r, i) => {
                const { Icon } = TYPE_STYLES[r.line_type];
                return (
                  <li key={`${r.line_type}-${r.product_id || r.expense_account_id || r.asset_category}-${i}`}
                    onMouseDown={() => pick(r)}
                    className="px-3 py-2 cursor-pointer hover:bg-accent-soft">
                    <div className="flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <p className="text-sm font-semibold truncate">{r.label}</p>
                      <span className="ml-auto"><TypeBadge type={r.line_type} /></span>
                    </div>
                    {r.meta && <p className="mt-0.5 pl-5 text-xs text-muted-foreground truncate">{r.meta}</p>}
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="p-4 text-center text-sm text-muted-foreground">No match for "{debounced}"</div>
          )}
          <div className="border-t p-2 sticky bottom-0 bg-popover">
            <Button size="sm" variant="ghost" className="w-full justify-start text-xs"
              onMouseDown={(e) => { e.preventDefault(); setNp((s) => ({ ...s, name: query })); setQuickOpen(true); setOpen(false); }}>
              <PackagePlus className="h-3.5 w-3.5 mr-1" /> New item
            </Button>
          </div>
        </div>
      )}

      <Dialog open={quickOpen} onOpenChange={setQuickOpen}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader><DialogTitle>New Item</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name *</Label>
              <Input value={np.name} onChange={(e) => setNp({ ...np, name: e.target.value })} placeholder="e.g. USB-C Cable 2m" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Category</Label>
                <Select value={np.category} onValueChange={(v) => setNp({ ...np, category: v, is_service: v.includes("Services") })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Phone Accessories">Phone Accessories</SelectItem>
                    <SelectItem value="Internet Services">Internet Services</SelectItem>
                    <SelectItem value="Printing Services">Printing Services</SelectItem>
                    <SelectItem value="Other Services">Other Services</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Selling Price</Label>
                <Input type="number" min={0} value={np.base_sell_price} onChange={(e) => setNp({ ...np, base_sell_price: Number(e.target.value) })} />
              </div>
              <div>
                <Label>VAT Treatment</Label>
                <Select value={np.tax_category} onValueChange={(v) => setNp({ ...np, tax_category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard (16%)</SelectItem>
                    <SelectItem value="zero_rated">Zero Rated</SelectItem>
                    <SelectItem value="exempt">Exempt</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Unit</Label>
                <Input value={np.unit} onChange={(e) => setNp({ ...np, unit: e.target.value })} placeholder="pcs" />
              </div>
            </div>
            <Button className="w-full" onClick={submitQuick} disabled={createProduct.isPending}>Save &amp; Continue</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
