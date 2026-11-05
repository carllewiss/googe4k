import { useAdminShopOrders } from "@/hooks/useShop";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AdminShopOrders() {
  const { data: orders = [], isLoading } = useAdminShopOrders();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold font-heading">Online Orders</h1>
      <p className="text-sm text-muted-foreground">All orders placed through the shop</p>
      {isLoading ? <p>Loading...</p> : orders.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">No online orders yet.</Card>
      ) : (
        <div className="space-y-3">
          {orders.map((o: any) => (
            <Card key={o.id} className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-bold">{o.order_number}</p>
                  <p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()} · {o.customer_name} · {o.customer_phone}</p>
                </div>
                <div className="text-right">
                  <Badge variant={o.status === "paid" || o.status === "fulfilled" ? "default" : o.status === "failed" ? "destructive" : "secondary"}>{o.status}</Badge>
                  <p className="font-bold mt-1">KES {Number(o.total).toLocaleString()}</p>
                </div>
              </div>
              <div className="text-sm border-t pt-2 space-y-0.5">
                {o.shop_order_items?.map((it: any) => (
                  <div key={it.id} className="flex justify-between">
                    <span>{it.product_name} × {it.quantity}</span>
                    <span>KES {Number(it.total).toLocaleString()}</span>
                  </div>
                ))}
              </div>
              {o.mpesa_receipt && <p className="text-xs text-muted-foreground mt-2">M-Pesa: {o.mpesa_receipt}</p>}
              {o.delivery_address && <p className="text-xs mt-1"><strong>Delivery:</strong> {o.delivery_address}</p>}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
