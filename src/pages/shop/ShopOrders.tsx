import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ShopLayout } from "@/components/shop/ShopLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useMyOrders } from "@/hooks/useShop";

export default function ShopOrders() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: orders = [], isLoading } = useMyOrders(user?.id);

  useEffect(() => { if (!user) navigate("/shop/signin"); }, [user, navigate]);
  if (!user) return null;

  return (
    <ShopLayout>
      <div className="max-w-4xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold font-heading mb-6">My Orders</h1>
        {isLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : orders.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">No orders yet.</Card>
        ) : (
          <div className="space-y-4">
            {orders.map((o: any) => (
              <Card key={o.id} className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-bold">{o.order_number}</p>
                    <p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()}</p>
                  </div>
                  <Badge variant={o.status === "paid" || o.status === "fulfilled" ? "default" : o.status === "failed" ? "destructive" : "secondary"}>
                    {o.status}
                  </Badge>
                </div>
                <div className="text-sm space-y-1 border-t pt-3">
                  {o.shop_order_items?.map((it: any) => (
                    <div key={it.id} className="flex justify-between">
                      <span>{it.product_name} × {it.quantity}</span>
                      <span>KES {Number(it.total).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t mt-3 pt-3 flex justify-between font-bold">
                  <span>Total</span>
                  <span>KES {Number(o.total).toLocaleString()}</span>
                </div>
                {o.mpesa_receipt && <p className="text-xs text-muted-foreground mt-2">M-Pesa: {o.mpesa_receipt}</p>}
              </Card>
            ))}
          </div>
        )}
      </div>
    </ShopLayout>
  );
}
