import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingCart } from "lucide-react";
import { useCart } from "@/lib/cart";

interface Props {
  product: {
    id: string;
    name: string;
    base_sell_price: number;
    image_url: string | null;
    category?: string;
  };
}

export function ProductCard({ product }: Props) {
  const { add } = useCart();

  return (
    <Card className="group overflow-hidden hover:shadow-lg transition-all border-border/40">
      <Link to={`/shop/product/${product.id}`} className="block">
        <div className="aspect-square bg-shop-soft flex items-center justify-center overflow-hidden">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              loading="lazy"
              className="w-full h-full object-contain p-4 group-hover:scale-105 transition-transform"
            />
          ) : (
            <div className="text-muted-foreground text-sm">No image</div>
          )}
        </div>
      </Link>
      <div className="p-4 space-y-2">
        <Link to={`/shop/product/${product.id}`}>
          <h3 className="font-semibold text-sm line-clamp-2 min-h-[2.5rem] hover:text-shop-accent transition-colors">
            {product.name}
          </h3>
        </Link>
        <p className="text-lg font-bold text-foreground">
          KES {Number(product.base_sell_price).toLocaleString()}
        </p>
        <Button
          size="sm"
          className="w-full bg-shop-accent hover:bg-shop-accent/90 text-shop-accent-foreground"
          onClick={(e) => {
            e.preventDefault();
            add({
              product_id: product.id,
              name: product.name,
              unit_price: Number(product.base_sell_price),
              image_url: product.image_url,
            });
          }}
        >
          <ShoppingCart className="h-4 w-4 mr-1" /> Add to Cart
        </Button>
      </div>
    </Card>
  );
}
