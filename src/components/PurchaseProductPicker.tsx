import { useEffect, useRef, useState, useMemo } from "react";
import { Search, Loader2, PackagePlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useProductsPurchaseView, type ProductPurchaseInfo } from "@/hooks/usePurchaseWorkspace";
import { useCreateProduct } from "@/hooks/useProducts";
import { toast } from "sonner";

export type PickerProduct = ProductPurchaseInfo;

interface Props {
  value?: string;
  onSelect: (product: PickerProduct) => void;
  placeholder?: string;
}

export function PurchaseProductPicker({ onSelect, value, placeholder = "Search product by name or code..." }: Props) {
  const { data: products = [], isLoading } = useProductsPurchaseView();
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

  useEffect(() => {
    if (value && products.length) {
      const p = products.find((x) => x.id === value);
      if (p && !query) setQuery(p.name);
    }
  }, [value, products]);

  const results = useMemo(() => {
    const q = debounced.trim().toLowerCase();
    const list = !q ? products : products.filter((p) =>
      p.name.toLowerCase().includes(q) || (p.category || "").toLowerCase().includes(q)
    );
    return list.slice(0, 50);
  }, [debounced, products]);

  const submitQuick = async () => {
    if (!np.name.trim()) return toast.error("Stock code / name required");
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
      const picked: PickerProduct = {
        id: created.id, name: created.name, category: created.category as string,
        unit: created.unit, is_service: created.is_service, tax_category: created.tax_category as string,
        vat_rate: created.vat_rate ?? null, stock_on_hand: 0, last_cost: null,
        last_supplier: null, last_purchase_date: null, last_qty: null,
      };
      onSelect(picked);
      setQuery(picked.name);
      setQuickOpen(false);
      setNp({ name: "", category: "Phone Accessories", base_sell_price: 0, unit: "pcs", tax_category: "standard", is_service: false });
      toast.success("Product added");
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
          {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>
        <Input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="pl-7 h-9 text-sm"
        />
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[280px] bg-popover shadow-elegant rounded-md border max-h-80 overflow-y-auto">
          {results.length > 0 ? (
            <ul className="divide-y">
              {results.map((p) => (
                <li key={p.id}
                  onMouseDown={() => { onSelect(p); setQuery(p.name); setOpen(false); }}
                  className="px-3 py-2 cursor-pointer hover:bg-accent-soft">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{p.name}</p>
                    {!p.is_service && (
                      <span className={`text-[10px] font-medium ${p.stock_on_hand > 0 ? "text-success" : "text-destructive"}`}>
                        Stock: {p.stock_on_hand}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>{p.category}{p.is_service ? " · Service" : ` · ${p.unit}`}</span>
                    {p.last_cost != null && (
                      <span>Last: KES {p.last_cost.toLocaleString()}{p.last_supplier ? ` · ${p.last_supplier}` : ""}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-4 text-center">
              <p className="text-sm text-muted-foreground mb-2">No item found</p>
              <Button size="sm" variant="outline" onMouseDown={(e) => { e.preventDefault(); setNp((s) => ({ ...s, name: query })); setQuickOpen(true); setOpen(false); }}>
                <PackagePlus className="h-3.5 w-3.5 mr-1" /> Quick Add Product
              </Button>
            </div>
          )}
          {results.length > 0 && (
            <div className="border-t p-2">
              <Button size="sm" variant="ghost" className="w-full justify-start text-xs"
                onMouseDown={(e) => { e.preventDefault(); setNp((s) => ({ ...s, name: query })); setQuickOpen(true); setOpen(false); }}>
                <PackagePlus className="h-3.5 w-3.5 mr-1" /> Quick Add New Product
              </Button>
            </div>
          )}
        </div>
      )}

      <Dialog open={quickOpen} onOpenChange={setQuickOpen}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader><DialogTitle>Quick Add Product</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Stock Code / Description *</Label>
              <Input value={np.name} onChange={(e) => setNp({ ...np, name: e.target.value })} placeholder="e.g. Vinyl Matt Emulsion 4L" />
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
                <Label>Tax Type</Label>
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

