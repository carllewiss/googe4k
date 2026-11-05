import { useParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { ShopLayout } from "@/components/shop/ShopLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function ShopOrderSuccess() {
  const { orderId } = useParams();
  const [order, setOrder] = useState<any>(null);

  useEffect(() => {
    if (!orderId) return;
    supabase.from("shop_orders").select("*, shop_order_items(*)").eq("id", orderId).maybeSingle()
      .then(({ data }) => setOrder(data));
  }, [orderId]);

  return (
    <ShopLayout>
      <div className="max-w-2xl mx-auto px-4 py-12">
        <Card className="p-10 text-center">
          <CheckCircle2 className="h-16 w-16 mx-auto text-success mb-4" />
          <h1 className="text-3xl font-bold font-heading mb-2">Order Confirmed!</h1>
          <p className="text-muted-foreground mb-6">Thank you for your purchase.</p>
          {order && (
            <div className="bg-muted/30 p-4 rounded-lg text-left text-sm space-y-1 mb-6">
              <p><span className="text-muted-foreground">Order #:</span> <strong>{order.order_number}</strong></p>
              {order.mpesa_receipt && <p><span className="text-muted-foreground">M-Pesa Ref:</span> <strong>{order.mpesa_receipt}</strong></p>}
              <p><span className="text-muted-foreground">Total:</span> <strong>KES {Number(order.total).toLocaleString()}</strong></p>
            </div>
          )}
          <div className="flex gap-3 justify-center">
            <Button asChild className="bg-shop-deep text-shop-deep-foreground hover:bg-shop-deep/90">
              <Link to="/shop">Continue Shopping</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/shop/account/orders">View Orders</Link>
            </Button>
          </div>
        </Card>
      </div>
    </ShopLayout>
  );
}
