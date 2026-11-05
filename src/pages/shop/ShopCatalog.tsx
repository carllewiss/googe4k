import { useSearchParams } from "react-router-dom";
import { useState } from "react";
import { ShopLayout } from "@/components/shop/ShopLayout";
import { ProductCard } from "@/components/shop/ProductCard";
import { useShopProducts } from "@/hooks/useShop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

const CATEGORIES = [
  { key: "all", label: "All" },
  { key: "Phone Accessories", label: "Phone Accessories" },
  { key: "Internet Services", label: "Internet" },
  { key: "Printing Services", label: "Printing" },
  { key: "Other Services", label: "Other" },
];

export default function ShopCatalog() {
  const [params, setParams] = useSearchParams();
  const [category, setCategory] = useState(params.get("category") || "all");
  const [search, setSearch] = useState(params.get("search") || "");
  const { data: products = [], isLoading } = useShopProducts(category, search);

  const onCat = (k: string) => {
    setCategory(k);
    const p = new URLSearchParams(params);
    if (k === "all") p.delete("category"); else p.set("category", k);
    setParams(p);
  };

  return (
    <ShopLayout>
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold font-heading">Shop</h1>
          <p className="text-muted-foreground">Browse our full catalogue</p>
        </div>

        {/* Search + categories */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              className="pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map((c) => (
              <Button
                key={c.key}
                variant={category === c.key ? "default" : "outline"}
                size="sm"
                onClick={() => onCat(c.key)}
                className={category === c.key ? "bg-shop-deep text-shop-deep-foreground hover:bg-shop-deep/90" : ""}
              >
                {c.label}
              </Button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-20 text-muted-foreground">Loading...</div>
        ) : products.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            No products found. Try a different category or search.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {products.map((p: any) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </div>
    </ShopLayout>
  );
}
