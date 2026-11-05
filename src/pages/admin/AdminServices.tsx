import { useEffect, useState } from "react";
import { useAllServices, useSaveService, useDeleteService, uploadServiceImage, Service } from "@/hooks/useServices";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Edit3, Trash2, ImageIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";

const EMPTY = { name: "", description: "", image_url: "", sort_order: 0, is_active: true };

export default function AdminServices() {
  const { data: services = [], isLoading } = useAllServices();
  const save = useSaveService();
  const del = useDeleteService();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [form, setForm] = useState<typeof EMPTY>(EMPTY);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(editing
        ? {
            name: editing.name,
            description: editing.description || "",
            image_url: editing.image_url || "",
            sort_order: editing.sort_order,
            is_active: editing.is_active,
          }
        : { ...EMPTY, sort_order: services.length + 1 });
    }
  }, [open, editing]); // eslint-disable-line react-hooks/exhaustive-deps

  const openNew = () => { setEditing(null); setOpen(true); };
  const openEdit = (s: Service) => { setEditing(s); setOpen(true); };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadServiceImage(file);
      setForm((f) => ({ ...f, image_url: url }));
      toast.success("Image uploaded");
    } catch (err: any) { toast.error(err.message); }
    finally { setUploading(false); }
  };

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error("Service name is required");
    try {
      await save.mutateAsync({
        id: editing?.id,
        name: form.name.trim(),
        description: form.description.trim() || null,
        image_url: form.image_url || null,
        sort_order: Number(form.sort_order) || 0,
        is_active: form.is_active,
      });
      toast.success(editing ? "Service updated" : "Service added");
      setOpen(false);
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading">Services</h1>
          <p className="text-sm text-muted-foreground">Manage the services shown on the customer website</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Add Service</Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : services.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">No services yet. Click "Add Service".</Card>
      ) : (
        <div className="grid gap-3">
          {services.map((s) => (
            <Card key={s.id} className="p-4 flex items-center gap-4">
              <div className="w-16 h-16 bg-muted rounded shrink-0 overflow-hidden flex items-center justify-center">
                {s.image_url
                  ? <img src={s.image_url} alt={s.name} className="w-full h-full object-cover" />
                  : <ImageIcon className="h-6 w-6 text-muted-foreground/50" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold truncate">{s.name}</h3>
                  <Badge variant={s.is_active ? "default" : "secondary"}>{s.is_active ? "Active" : "Hidden"}</Badge>
                </div>
                {s.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.description}</p>}
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(s)}>
                  <Edit3 className="h-4 w-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4" /></Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete "{s.name}"?</AlertDialogTitle>
                      <AlertDialogDescription>This is permanent.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground"
                        onClick={async () => { await del.mutateAsync(s.id); toast.success("Deleted"); }}
                      >Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Service" : "Add Service"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Service Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. KRA PIN Registration" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Short description shown to customers" />
            </div>
            <div>
              <Label>Service Picture</Label>
              <div className="flex items-center gap-3 mt-1">
                {form.image_url && <img src={form.image_url} alt="preview" className="h-14 w-14 rounded object-cover" />}
                <label className="cursor-pointer">
                  <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
                  <Button type="button" variant="outline" asChild>
                    <span>{uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <ImageIcon className="h-4 w-4 mr-1" />} Upload</span>
                  </Button>
                </label>
                {form.image_url && <Button type="button" variant="ghost" size="sm" onClick={() => setForm({ ...form, image_url: "" })}>Remove</Button>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 items-end">
              <div>
                <Label>Display Order</Label>
                <Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} />
              </div>
              <div className="flex items-center gap-2 pb-2">
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                <Label>Active (visible)</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={save.isPending}>{save.isPending ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
