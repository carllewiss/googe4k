import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, Trash2, FileText, Image as ImageIcon, Eye } from "lucide-react";
import { usePurchaseReceipts, useUploadReceipt, useDeleteReceipt, getReceiptSignedUrl } from "@/hooks/usePurchases";
import { toast } from "sonner";
import { format } from "date-fns";

export function PurchaseReceiptsUpload({ purchaseId }: { purchaseId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: files = [], isLoading } = usePurchaseReceipts(purchaseId);
  const upload = useUploadReceipt();
  const remove = useDeleteReceipt();

  const handleFiles = async (fl: FileList | null) => {
    if (!fl) return;
    for (const f of Array.from(fl)) {
      if (f.size > 5 * 1024 * 1024) { toast.error(`${f.name} > 5MB`); continue; }
      try {
        await upload.mutateAsync({ purchase_id: purchaseId, file: f });
        toast.success(`Uploaded ${f.name}`);
      } catch (e: any) { toast.error(e.message); }
    }
    if (inputRef.current) inputRef.current.value = "";
  };

  const view = async (path: string) => {
    try {
      const url = await getReceiptSignedUrl(path);
      window.open(url, "_blank");
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm uppercase tracking-wider">Receipts / Attachments</h3>
        <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={upload.isPending}>
          <Upload className="h-3.5 w-3.5 mr-1" /> Upload
        </Button>
        <input ref={inputRef} type="file" multiple accept="image/*,application/pdf" hidden
          onChange={(e) => handleFiles(e.target.files)} />
      </div>
      {isLoading ? <p className="text-xs text-muted-foreground">Loading...</p> :
       files.length === 0 ? (
        <div className="border-2 border-dashed rounded-md p-6 text-center text-sm text-muted-foreground">
          No receipts yet. Upload JPG, PNG or PDF (≤5MB each).
        </div>
       ) : (
        <ul className="space-y-2">
          {files.map((f: any) => (
            <li key={f.id} className="flex items-center justify-between border rounded-md px-3 py-2">
              <div className="flex items-center gap-2 min-w-0">
                {f.mime_type?.startsWith("image/") ? <ImageIcon className="h-4 w-4 text-primary" /> : <FileText className="h-4 w-4 text-primary" />}
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{f.file_name}</p>
                  <p className="text-[10px] text-muted-foreground">{format(new Date(f.uploaded_at), "dd MMM yyyy HH:mm")} · {(f.file_size/1024).toFixed(0)} KB</p>
                </div>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => view(f.file_path)}><Eye className="h-3.5 w-3.5" /></Button>
                <Button size="icon" variant="ghost" onClick={() => remove.mutate({ id: f.id, file_path: f.file_path, purchase_id: purchaseId })}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
       )}
    </Card>
  );
}
