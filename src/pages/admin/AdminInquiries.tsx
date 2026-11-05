import { useServiceInquiries } from "@/hooks/useShop";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buildWaLink } from "@/lib/whatsapp";
import { MessageCircle } from "lucide-react";

export default function AdminInquiries() {
  const { data: inquiries = [], isLoading } = useServiceInquiries();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold font-heading">Service Inquiries</h1>
      <p className="text-sm text-muted-foreground">Leads from customers who clicked a service on the shop</p>
      {isLoading ? <p>Loading...</p> : inquiries.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">No inquiries yet.</Card>
      ) : (
        <div className="space-y-2">
          {inquiries.map((inq: any) => (
            <Card key={inq.id} className="p-4 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold">{inq.service_name}</p>
                  <Badge variant="outline">{inq.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {new Date(inq.created_at).toLocaleString()}
                  {inq.customer_name && ` · ${inq.customer_name}`}
                  {inq.customer_phone && ` · ${inq.customer_phone}`}
                </p>
              </div>
              {inq.whatsapp_message && (
                <Button size="sm" asChild className="bg-[#25D366] hover:bg-[#1DA851] text-white">
                  <a href={buildWaLink(inq.whatsapp_message)} target="_blank" rel="noopener">
                    <MessageCircle className="h-4 w-4 mr-1" /> Reply
                  </a>
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
