import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShopLayout } from "@/components/shop/ShopLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useMyOrders } from "@/hooks/useShop";
import { Badge } from "@/components/ui/badge";

export default function ShopAccount() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { data: orders = [] } = useMyOrders(user?.id);

  useEffect(() => { if (!user) navigate("/shop/signin"); }, [user, navigate]);
  if (!user) return null;

  return (
    <ShopLayout>
      <div className="max-w-5xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold font-heading mb-6">My Account</h1>

        <div className="grid md:grid-cols-3 gap-6">
          <Card className="p-6 md:col-span-1">
            <h2 className="font-bold mb-3">Profile</h2>
            <p className="text-sm"><span className="text-muted-foreground">Email:</span> {user.email}</p>
            <Button variant="outline" className="w-full mt-4" onClick={() => signOut().then(() => navigate("/"))}>
              Sign Out
            </Button>
          </Card>

          <Card className="p-6 md:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold">Recent Orders</h2>
              <Link to="/shop/account/orders" className="text-sm text-shop-accent">View all →</Link>
            </div>
            {orders.length === 0 ? (
              <p className="text-sm text-muted-foreground">No orders yet.</p>
            ) : (
              <div className="space-y-2">
                {orders.slice(0, 5).map((o: any) => (
                  <div key={o.id} className="flex items-center justify-between border rounded-lg p-3">
                    <div>
                      <p className="font-medium text-sm">{o.order_number}</p>
                      <p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <Badge variant={o.status === "paid" || o.status === "fulfilled" ? "default" : o.status === "failed" ? "destructive" : "secondary"}>
                        {o.status}
                      </Badge>
                      <p className="font-bold text-sm mt-1">KES {Number(o.total).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </ShopLayout>
  );
}
