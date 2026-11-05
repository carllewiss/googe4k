import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, FileDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { format, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { toast } from "sonner";

export function MonthlyReceiptsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (b: boolean) => void }) {
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    setBusy(true);
    try {
      const start = startOfMonth(parseISO(`${month}-01`));
      const end = endOfMonth(start);

      // Fetch purchases in month
      const { data: purchases, error: pErr } = await supabase
        .from("purchases")
        .select("id, invoice_number, total, vat_total, suppliers(name)")
        .gte("invoice_date", format(start, "yyyy-MM-dd"))
        .lte("invoice_date", format(end, "yyyy-MM-dd"));
      if (pErr) throw pErr;
      const ids = (purchases || []).map((p: any) => p.id);
      if (!ids.length) { toast.error("No purchases in selected month"); return; }

      const { data: receipts, error: rErr } = await (supabase as any)
        .from("purchase_receipts").select("*").in("purchase_id", ids);
      if (rErr) throw rErr;
      if (!receipts?.length) { toast.error("No receipts uploaded for this month"); return; }

      const pdf = await PDFDocument.create();
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

      // Cover page
      const cover = pdf.addPage([595, 842]);
      cover.drawText("Monthly Receipts Report", { x: 50, y: 780, size: 22, font: bold, color: rgb(0,0.38,0.35) });
      cover.drawText(`4K Smart Solutions Ltd`, { x: 50, y: 755, size: 12, font });
      cover.drawText(`Period: ${format(start, "MMMM yyyy")}`, { x: 50, y: 738, size: 12, font });
      cover.drawText(`Generated: ${format(new Date(), "dd MMM yyyy HH:mm")}`, { x: 50, y: 722, size: 10, font });

      let y = 690;
      cover.drawText("Invoice", { x: 50, y, size: 10, font: bold });
      cover.drawText("Supplier", { x: 150, y, size: 10, font: bold });
      cover.drawText("VAT", { x: 380, y, size: 10, font: bold });
      cover.drawText("Total (KES)", { x: 470, y, size: 10, font: bold });
      y -= 8;
      cover.drawLine({ start: {x: 50, y}, end: {x: 545, y}, thickness: 0.5, color: rgb(0.7,0.7,0.7) });
      y -= 14;

      let totalSum = 0, vatSum = 0;
      for (const p of (purchases || []) as any[]) {
        if (y < 80) { y = 780; pdf.addPage([595, 842]); }
        cover.drawText(p.invoice_number || "-", { x: 50, y, size: 9, font });
        cover.drawText((p.suppliers?.name || "").slice(0, 35), { x: 150, y, size: 9, font });
        cover.drawText(Number(p.vat_total || 0).toLocaleString(), { x: 380, y, size: 9, font });
        cover.drawText(Number(p.total).toLocaleString(), { x: 470, y, size: 9, font });
        totalSum += Number(p.total); vatSum += Number(p.vat_total || 0);
        y -= 14;
      }
      y -= 6;
      cover.drawLine({ start: {x: 50, y}, end: {x: 545, y}, thickness: 0.5 });
      y -= 16;
      cover.drawText("TOTALS", { x: 50, y, size: 10, font: bold });
      cover.drawText(vatSum.toLocaleString(), { x: 380, y, size: 10, font: bold });
      cover.drawText(`KES ${totalSum.toLocaleString()}`, { x: 460, y, size: 10, font: bold });

      // Map purchase -> invoice info
      const pmap: Record<string, any> = {};
      (purchases || []).forEach((p: any) => pmap[p.id] = p);

      for (const r of receipts) {
        try {
          const { data: signed } = await supabase.storage.from("purchase-receipts").createSignedUrl(r.file_path, 600);
          if (!signed?.signedUrl) continue;
          const bytes = await fetch(signed.signedUrl).then(x => x.arrayBuffer());
          const pinfo = pmap[r.purchase_id];
          if (r.mime_type === "application/pdf") {
            const src = await PDFDocument.load(bytes);
            const pages = await pdf.copyPages(src, src.getPageIndices());
            pages.forEach(pg => pdf.addPage(pg));
          } else if (r.mime_type?.startsWith("image/")) {
            const img = r.mime_type.includes("png") ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
            const page = pdf.addPage([595, 842]);
            page.drawText(`${pinfo?.invoice_number || ""} — ${pinfo?.suppliers?.name || ""}`, { x: 40, y: 800, size: 10, font: bold });
            page.drawText(r.file_name, { x: 40, y: 786, size: 8, font, color: rgb(0.4,0.4,0.4) });
            const maxW = 515, maxH = 720;
            const ratio = Math.min(maxW / img.width, maxH / img.height);
            const w = img.width * ratio, h = img.height * ratio;
            page.drawImage(img, { x: (595 - w) / 2, y: 60, width: w, height: h });
          }
        } catch (e) { console.error("Failed embedding", r.file_name, e); }
      }

      const out = await pdf.save();
      const blob = new Blob([out as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `receipts-${month}.pdf`; a.click();
      URL.revokeObjectURL(url);
      toast.success("PDF generated");
    } catch (e: any) { toast.error(e.message || "Failed to generate PDF"); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Compile Monthly Receipts PDF</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Combines every receipt uploaded in a chosen month into a single PDF, with a summary cover page.
          </p>
          <div>
            <Label>Month</Label>
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>
          <Button className="w-full" onClick={generate} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileDown className="h-4 w-4 mr-1" />}
            {busy ? "Generating..." : "Generate & Download"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
