import { useParams, Link, useNavigate } from "react-router-dom";
import { ShopLayout } from "@/components/shop/ShopLayout";
import { useShopProduct } from "@/hooks/useShop";
import { useCart } from "@/lib/cart";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ShoppingCart, Plus, Minus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function ShopProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: product, isLoading } = useShopProduct(id);
  const { add } = useCart();
  const [qty, setQty] = useState(1);

  if (isLoading) return <ShopLayout><div className="py-20 text-center text-muted-foreground">Loading...</div></ShopLayout>;
  if (!product) return <ShopLayout><div className="py-20 text-center">Product not found.</div></ShopLayout>;

  const handleAdd = () => {
    add({
      product_id: product.id,
      name: product.name,
      unit_price: Number(product.base_sell_price),
      image_url: product.image_url,
    }, qty);
    toast.success(`Added ${qty} × ${product.name} to cart`);
  };

  return (
    <ShopLayout>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <Link to="/shop" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6">
          <ChevronLeft className="h-4 w-4" /> Back to Products
        </Link>

        <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
          <div className="aspect-square bg-shop-soft rounded-xl flex items-center justify-center overflow-hidden">
            {product.image_url ? (
              <img src={product.image_url} alt={product.name} className="w-full h-full object-contain p-8" />
            ) : (
              <div className="text-muted-foreground">No image</div>
            )}
          </div>

          <div className="space-y-5">
            <div>
              <Badge variant="outline" className="mb-3">{product.category}</Badge>
              <h1 className="text-3xl md:text-4xl font-bold font-heading mb-3">{product.name}</h1>
              {product.description && (
                <p className="text-muted-foreground leading-relaxed">{product.description}</p>
              )}
            </div>

            <div className="text-3xl font-bold">
              KES {Number(product.base_sell_price).toLocaleString()}
            </div>

            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">Quantity:</span>
              <div className="inline-flex items-center border rounded-md">
                <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => setQty(Math.max(1, qty - 1))}>
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="px-4 text-sm font-medium w-12 text-center">{qty}</span>
                <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => setQty(qty + 1)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex gap-3">
              <Button size="lg" className="bg-shop-accent hover:bg-shop-accent/90 text-shop-accent-foreground" onClick={handleAdd}>
                <ShoppingCart className="h-4 w-4 mr-2" /> Add to Cart
              </Button>
              <Button size="lg" variant="outline" onClick={() => { handleAdd(); navigate("/shop/cart"); }}>
                Buy Now
              </Button>
            </div>
          </div>
        </div>
      </div>
    </ShopLayout>
  );
}
