import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShopLayout } from "@/components/shop/ShopLayout";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Smartphone, CheckCircle2 } from "lucide-react";

export default function ShopCheckout() {
  const { items, subtotal, clear } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState(user?.email || "");
  const [address, setAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pollingStatus, setPollingStatus] = useState<"idle" | "polling" | "success" | "failed">("idle");
  const [orderId, setOrderId] = useState<string | null>(null);

  const handleCheckout = async () => {
    if (!name.trim() || !phone.trim()) {
      toast.error("Please enter name and M-Pesa phone number");
      return;
    }
    if (items.length === 0) {
      toast.error("Cart is empty");
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("shop-checkout-stk", {
        body: {
          customer: { name, phone, email, address },
          items: items.map(i => ({
            product_id: i.product_id,
            quantity: i.quantity,
            unit_price: i.unit_price,
            name: i.name,
          })),
          user_id: user?.id ?? null,
        },
      });

      if (error) throw error;
      if (!data?.order_id) throw new Error("No order id returned");

      setOrderId(data.order_id);
      setPollingStatus("polling");
      toast.success("STK push sent! Check your phone and enter your M-Pesa PIN.");

      // Poll order status
      pollOrder(data.order_id);
    } catch (e: any) {
      toast.error(e.message || "Checkout failed");
      setSubmitting(false);
    }
  };

  const pollOrder = async (id: string) => {
    let attempts = 0;
    const maxAttempts = 30; // 60s
    const tick = async () => {
      attempts++;
      const { data } = await supabase.from("shop_orders").select("status,mpesa_receipt").eq("id", id).maybeSingle();
      if (data?.status === "paid") {
        setPollingStatus("success");
        clear();
        setTimeout(() => navigate(`/shop/order-success/${id}`), 1500);
        return;
      }
      if (data?.status === "failed" || data?.status === "cancelled") {
        setPollingStatus("failed");
        toast.error("Payment was not completed.");
        setSubmitting(false);
        return;
      }
      if (attempts >= maxAttempts) {
        setPollingStatus("failed");
        toast.error("Payment confirmation timed out. Check Orders for status.");
        setSubmitting(false);
        return;
      }
      setTimeout(tick, 2000);
    };
    setTimeout(tick, 3000);
  };

  if (items.length === 0 && pollingStatus === "idle") {
    return (
      <ShopLayout>
        <div className="max-w-md mx-auto py-20 text-center">
          <p className="text-muted-foreground mb-4">Your cart is empty.</p>
          <Button asChild><a href="/shop">Continue Shopping</a></Button>
        </div>
      </ShopLayout>
    );
  }

  return (
    <ShopLayout>
      <div className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold font-heading mb-6">Checkout</h1>

        {pollingStatus === "polling" ? (
          <Card className="p-10 text-center">
            <Loader2 className="h-12 w-12 mx-auto text-shop-accent animate-spin mb-4" />
            <h2 className="text-xl font-bold mb-2">Awaiting M-Pesa Confirmation</h2>
            <p className="text-muted-foreground mb-1">A push notification has been sent to <strong>{phone}</strong>.</p>
            <p className="text-muted-foreground text-sm">Enter your M-Pesa PIN on your phone to complete the payment.</p>
          </Card>
        ) : pollingStatus === "success" ? (
          <Card className="p-10 text-center">
            <CheckCircle2 className="h-12 w-12 mx-auto text-success mb-4" />
            <h2 className="text-xl font-bold">Payment Received!</h2>
            <p className="text-muted-foreground">Redirecting...</p>
          </Card>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="p-6 md:col-span-2 space-y-4">
              <h2 className="font-bold text-lg">Delivery & Payment Details</h2>
              <div>
                <Label>Full Name *</Label>
                <Input value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div>
                <Label>M-Pesa Phone (e.g. 0712345678) *</Label>
                <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="07XXXXXXXX" />
              </div>
              <div>
                <Label>Email (optional)</Label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} />
              </div>
              <div>
                <Label>Delivery Address (optional)</Label>
                <Textarea value={address} onChange={e => setAddress(e.target.value)} rows={3} />
              </div>
              <div className="bg-shop-soft/50 p-4 rounded-lg flex items-start gap-3">
                <Smartphone className="h-5 w-5 text-shop-deep mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="font-semibold">Pay with M-Pesa</p>
                  <p className="text-muted-foreground">An STK push will be sent to your phone. Enter your M-Pesa PIN to confirm.</p>
                </div>
              </div>
            </Card>

            <Card className="p-6 h-fit">
              <h2 className="font-bold mb-3">Summary</h2>
              <div className="space-y-2 text-sm mb-4">
                {items.map(i => (
                  <div key={i.product_id} className="flex justify-between gap-2">
                    <span className="truncate">{i.name} × {i.quantity}</span>
                    <span className="shrink-0">{(i.unit_price * i.quantity).toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div className="border-t pt-3 flex justify-between font-bold">
                <span>Total</span>
                <span>KES {subtotal.toLocaleString()}</span>
              </div>
              <Button
                className="w-full mt-5 bg-shop-deep text-shop-deep-foreground hover:bg-shop-deep/90"
                onClick={handleCheckout}
                disabled={submitting}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Pay with M-Pesa"}
              </Button>
            </Card>
          </div>
        )}
      </div>
    </ShopLayout>
  );
}
