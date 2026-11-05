import { ShopLayout } from "@/components/shop/ShopLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, Mail, MapPin, MessageCircle } from "lucide-react";
import { buildWaLink, WHATSAPP_DISPLAY } from "@/lib/whatsapp";

export default function ShopContact() {
  return (
    <ShopLayout>
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold font-heading">Contact Us</h1>
          <p className="text-muted-foreground">We'd love to hear from you.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="p-6 text-center">
            <Phone className="h-10 w-10 mx-auto text-shop-deep mb-3" />
            <h3 className="font-bold mb-1">Call Us</h3>
            <p className="text-sm text-muted-foreground">+254 736 217 411</p>
          </Card>
          <Card className="p-6 text-center">
            <Mail className="h-10 w-10 mx-auto text-shop-deep mb-3" />
            <h3 className="font-bold mb-1">Email</h3>
            <p className="text-sm text-muted-foreground">4ksmartsolutionsltd@gmail.com</p>
          </Card>
          <Card className="p-6 text-center">
            <MapPin className="h-10 w-10 mx-auto text-shop-deep mb-3" />
            <h3 className="font-bold mb-1">Visit</h3>
            <p className="text-sm text-muted-foreground">P.O Box 2706, Kakamega, Kenya</p>
          </Card>
        </div>
        <div className="text-center mt-10">
          <Button asChild size="lg" className="bg-[#25D366] hover:bg-[#1DA851] text-white">
            <a href={buildWaLink(`Hello 4K Smart Solutions, I'd like to make an inquiry.`)} target="_blank" rel="noopener">
              <MessageCircle className="h-4 w-4 mr-2" /> WhatsApp {WHATSAPP_DISPLAY}
            </a>
          </Button>
        </div>
      </div>
    </ShopLayout>
  );
}
