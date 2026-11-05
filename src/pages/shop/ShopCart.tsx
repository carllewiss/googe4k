import { Link, useNavigate } from "react-router-dom";
import { ShopLayout } from "@/components/shop/ShopLayout";
import { useCart } from "@/lib/cart";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Minus, Trash2, ShoppingCart } from "lucide-react";

export default function ShopCart() {
  const { items, setQty, remove, subtotal } = useCart();
  const navigate = useNavigate();

  return (
    <ShopLayout>
      <div className="max-w-6xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold font-heading mb-6">Shopping Cart</h1>

        {items.length === 0 ? (
          <Card className="p-12 text-center">
            <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">Your cart is empty.</p>
            <Button asChild className="bg-shop-deep text-shop-deep-foreground hover:bg-shop-deep/90">
              <Link to="/shop">Continue Shopping</Link>
            </Button>
          </Card>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-3">
              {items.map((item) => (
                <Card key={item.product_id} className="p-4 flex gap-4 items-center">
                  <div className="w-20 h-20 bg-shop-soft rounded flex items-center justify-center overflow-hidden shrink-0">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.name} className="w-full h-full object-contain" />
                    ) : <span className="text-xs text-muted-foreground">No img</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">KES {item.unit_price.toLocaleString()}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setQty(item.product_id, item.quantity - 1)}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="text-sm font-medium w-6 text-center">{item.quantity}</span>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setQty(item.product_id, item.quantity + 1)}>
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive ml-2" onClick={() => remove(item.product_id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="font-bold text-right shrink-0">
                    KES {(item.unit_price * item.quantity).toLocaleString()}
                  </div>
                </Card>
              ))}
            </div>

            <div>
              <Card className="p-6 sticky top-24">
                <h2 className="font-bold text-lg mb-4">Order Summary</h2>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>KES {subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Shipping</span>
                    <span>Free</span>
                  </div>
                  <div className="border-t pt-2 mt-2 flex justify-between font-bold text-base">
                    <span>Total</span>
                    <span>KES {subtotal.toLocaleString()}</span>
                  </div>
                </div>
                <Button
                  className="w-full mt-5 bg-shop-deep text-shop-deep-foreground hover:bg-shop-deep/90"
                  size="lg"
                  onClick={() => navigate("/shop/checkout")}
                >
                  Proceed to Checkout
                </Button>
              </Card>
            </div>
          </div>
        )}
      </div>
    </ShopLayout>
  );
}
