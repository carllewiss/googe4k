import { useEffect, useRef, useState, useMemo } from "react";
import { Search, Package, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useProductWithStock } from "@/hooks/useProducts";

export interface StockSearchProduct {
  id: string;
  name: string;
  category: string;
  base_sell_price: number;
  floor_price: number;
  unit: string;
  is_service: boolean;
  stock_on_hand: number;
  tax_category: string;
}

interface Props {
  onSelect: (product: StockSearchProduct) => void;
  /** Show price inclusive of VAT for standard-rated items when true */
  etimsEnabled?: boolean;
  vatRate?: number; // e.g. 0.16
  placeholder?: string;
}

export function StockSearchAutocomplete({
  onSelect,
  etimsEnabled = false,
  vatRate = 0.16,
  placeholder = "Search stock by name or category...",
}: Props) {
  const { data: products = [], isLoading } = useProductWithStock();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // 300ms debounce
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  // close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const results = useMemo(() => {
    const q = debounced.trim().toLowerCase();
    const list = !q
      ? products
      : products.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.category.toLowerCase().includes(q)
        );
    return list.slice(0, 50);
  }, [debounced, products]);

  useEffect(() => setHighlight(0), [debounced]);

  const displayPrice = (p: any) => {
    const base = Number(p.base_sell_price);
    const inclusive = etimsEnabled && p.tax_category === "standard";
    const value = inclusive ? Math.round(base * (1 + vatRate)) : base;
    return { value, inclusive };
  };

  const handleSelect = (p: any) => {
    onSelect(p);
    setQuery("");
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter" && results[highlight]) {
      e.preventDefault();
      handleSelect(results[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          {isLoading || (query !== debounced && query.length > 0) ? (
            <Loader2 className="h-4 w-4 text-accent animate-spin" />
          ) : (
            <Search className="h-4 w-4 text-muted-foreground group-focus-within:text-primary" />
          )}
        </div>
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="pl-10"
        />
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-popover shadow-elegant rounded-md border overflow-hidden max-h-80 overflow-y-auto">
          <div className="bg-muted/50 px-3 py-2 border-b text-[10px] font-black text-muted-foreground uppercase tracking-widest flex justify-between">
            <span>Search Results</span>
            <span>Price{etimsEnabled ? " (inc. VAT)" : ""}</span>
          </div>
          <ul className="divide-y">
            {results.map((p, i) => {
              const inStock = p.is_service || p.stock_on_hand > 0;
              const { value, inclusive } = displayPrice(p);
              return (
                <li
                  key={p.id}
                  onMouseDown={() => handleSelect(p)}
                  onMouseEnter={() => setHighlight(i)}
                  className={`px-4 py-2.5 cursor-pointer flex justify-between items-center transition ${
                    i === highlight ? "bg-accent-soft" : "hover:bg-accent-soft/50"
                  }`}
                >
                  <div className="flex gap-3 items-center min-w-0">
                    <div className="p-2 bg-muted rounded">
                      <Package className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-primary truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {p.category} ·{" "}
                        {p.is_service
                          ? "Service"
                          : `${p.stock_on_hand} ${p.unit} in stock`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className="text-sm font-black">KES {value.toLocaleString()}</p>
                    {inStock ? (
                      <span className="text-[10px] bg-success/10 text-success px-1.5 py-0.5 rounded border border-success/20">
                        In Stock
                      </span>
                    ) : (
                      <span className="text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded border border-destructive/20">
                        Out
                      </span>
                    )}
                    {inclusive && (
                      <p className="text-[9px] text-muted-foreground">inc. VAT</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {open && results.length === 0 && debounced.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-popover shadow-elegant rounded-md border p-4 text-center text-sm text-muted-foreground">
          No products match "{debounced}"
        </div>
      )}
    </div>
  );
}
