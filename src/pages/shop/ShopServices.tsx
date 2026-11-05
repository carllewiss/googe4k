import { ShopLayout } from "@/components/shop/ShopLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { buildWaLink, serviceInquiryMessage, WHATSAPP_DISPLAY } from "@/lib/whatsapp";
import { useLogServiceInquiry } from "@/hooks/useShop";
import { useActiveServices, Service } from "@/hooks/useServices";
import { AdSlot } from "@/components/shop/AdSlot";
import { toast } from "sonner";
import { MessageCircle, Sparkles } from "lucide-react";

export default function ShopServices() {
  const [name, setName] = useState("");
  const { data: services = [], isLoading } = useActiveServices();
  const log = useLogServiceInquiry();

  const handleClick = async (svc: Service) => {
    const message = serviceInquiryMessage(svc.name, name || undefined);
    try {
      await log.mutateAsync({
        service_key: svc.id,
        service_name: svc.name,
        whatsapp_message: message,
        customer_name: name || undefined,
      });
    } catch {
      /* silently fail — opening WhatsApp matters more than logging */
    }
    window.open(buildWaLink(message), "_blank", "noopener");
    toast.success(`Opening WhatsApp for ${svc.name}`);
  };

  return (
    <ShopLayout>
      <section className="bg-shop-soft/40 py-16">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold font-heading mb-3">Our Services</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Tap any service to start a WhatsApp chat with our team on <strong>{WHATSAPP_DISPLAY}</strong>. We'll guide you through the process.
          </p>
          <div className="max-w-md mx-auto mt-6">
            <Label htmlFor="cust-name" className="text-left block mb-1 text-sm">Your name (optional, helps us address you)</Label>
            <Input id="cust-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
          </div>
        </div>
      </section>

      {isLoading ? (
        <div className="max-w-7xl mx-auto px-4 py-16 text-center text-muted-foreground">Loading services...</div>
      ) : services.length === 0 ? (
        <div className="max-w-7xl mx-auto px-4 py-16 text-center text-muted-foreground">No services available right now. Please check back soon.</div>
      ) : (
        <div className="max-w-7xl mx-auto px-4 py-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {services.map((svc) => (
            <Card key={svc.id} className="flex flex-col overflow-hidden hover:shadow-lg transition-shadow border-border/40">
              <div className="h-40 bg-shop-soft/60 flex items-center justify-center overflow-hidden">
                {svc.image_url ? (
                  <img src={svc.image_url} alt={svc.name} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <Sparkles className="h-10 w-10 text-shop-deep/40" />
                )}
              </div>
              <div className="p-6 flex flex-col flex-1 text-center">
                <h3 className="font-bold mb-2 text-shop-deep">{svc.name}</h3>
                {svc.description && <p className="text-sm text-muted-foreground mb-5 flex-1">{svc.description}</p>}
                <Button onClick={() => handleClick(svc)} className="bg-[#25D366] hover:bg-[#1DA851] text-white mt-auto">
                  <MessageCircle className="h-4 w-4 mr-2" /> WhatsApp Inquiry
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 pb-12">
        <AdSlot placement="footer" />
      </div>
    </ShopLayout>
  );
}
