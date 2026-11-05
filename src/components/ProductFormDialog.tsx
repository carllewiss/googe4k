import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useCreateProduct, useUpdateProduct } from "@/hooks/useProducts";
import { uploadProductImage } from "@/hooks/useShop";
import { toast } from "sonner";
import { Upload, Loader2 } from "lucide-react";

type Category = "Phone Accessories" | "Internet Services" | "Printing Services" | "Other Services";
type Tax = "standard" | "zero_rated" | "exempt";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  product?: {
    id: string;
    name: string;
    category: string;
    base_sell_price: number;
    floor_price: number;
    unit: string;
    min_stock: number;
    is_service: boolean;
    tax_category: string;
    vat_rate?: number | null;
    image_url?: string | null;
    description?: string | null;
    shop_visible?: boolean;
    shop_featured?: boolean;
  } | null;
}

export function ProductFormDialog({ open, onOpenChange, product }: Props) {
  const isEdit = !!product;
  const create = useCreateProduct();
  const update = useUpdateProduct();
  

  const [name, setName] = useState("");
  const [category, setCategory] = useState<Category>("Phone Accessories");
  const [sellPrice, setSellPrice] = useState(0);
  const [floorPrice, setFloorPrice] = useState(0);
  const [unit, setUnit] = useState("pcs");
  const [minStock, setMinStock] = useState(0);
  const [isService, setIsService] = useState(false);
  const [taxCategory, setTaxCategory] = useState<Tax>("standard");
  const [vatRate, setVatRate] = useState<string>(""); // string so empty = "use default"
  const [imageUrl, setImageUrl] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [shopVisible, setShopVisible] = useState(false);
  const [shopFeatured, setShopFeatured] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (product) {
      setName(product.name);
      setCategory(product.category as Category);
      setSellPrice(Number(product.base_sell_price));
      setFloorPrice(Number(product.floor_price));
      setUnit(product.unit);
      setMinStock(product.min_stock);
      setIsService(product.is_service);
      setTaxCategory((product.tax_category as Tax) || "standard");
      setVatRate(
        product.vat_rate === null || product.vat_rate === undefined ? "" : String(product.vat_rate)
      );
      setImageUrl(product.image_url || "");
      setDescription(product.description || "");
      setShopVisible(!!product.shop_visible);
      setShopFeatured(!!product.shop_featured);
    } else {
      setName(""); setCategory("Phone Accessories"); setSellPrice(0); setFloorPrice(0);
      setUnit("pcs"); setMinStock(0); setIsService(false); setTaxCategory("standard");
      setVatRate("");
      setImageUrl(""); setDescription(""); setShopVisible(false); setShopFeatured(false);
    }
  }, [product, open]);

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    try {
      const id = product?.id || crypto.randomUUID();
      const url = await uploadProductImage(file, id);
      setImageUrl(url);
      toast.success("Image uploaded");
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (!name.trim()) { toast.error("Enter product name"); return; }

    // Validate optional VAT rate
    let vatRateValue: number | null = null;
    if (vatRate.trim() !== "") {
      const parsed = Number(vatRate);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
        toast.error("Custom VAT rate must be between 0 and 100");
        return;
      }
      vatRateValue = parsed;
    }

    try {
      const payload: any = {
        name, category, base_sell_price: sellPrice, floor_price: floorPrice,
        unit, min_stock: minStock, is_service: isService, tax_category: taxCategory,
        vat_rate: taxCategory === "standard" ? vatRateValue : null,
        description: description || null,
        image_url: imageUrl || null,
        shop_visible: shopVisible,
        shop_featured: shopFeatured,
      };
      if (isEdit && product) {
        await update.mutateAsync({ id: product.id, ...payload });
        toast.success("Product updated");
      } else {
        await create.mutateAsync(payload);
        toast.success("Product added");
      }
      onOpenChange(false);
    } catch (e: any) { toast.error(e.message); }
  };

  const pending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{isEdit ? "Edit Product" : "Add Product / Service"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
          <div>
            <Label>Category</Label>
            <Select value={category} onValueChange={v => setCategory(v as Category)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Phone Accessories">Phone Accessories</SelectItem>
                <SelectItem value="Internet Services">Internet Services</SelectItem>
                <SelectItem value="Printing Services">Printing Services</SelectItem>
                <SelectItem value="Other Services">Other Services</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Sell Price (KES)</Label><Input type="number" value={sellPrice} onChange={e => setSellPrice(Number(e.target.value))} /></div>
            <div><Label>Floor Price (KES)</Label><Input type="number" value={floorPrice} onChange={e => setFloorPrice(Number(e.target.value))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Unit</Label><Input value={unit} onChange={e => setUnit(e.target.value)} /></div>
            <div><Label>Min Stock</Label><Input type="number" value={minStock} onChange={e => setMinStock(Number(e.target.value))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tax Category</Label>
              <Select value={taxCategory} onValueChange={v => setTaxCategory(v as Tax)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard VAT</SelectItem>
                  <SelectItem value="zero_rated">Zero-Rated (0%)</SelectItem>
                  <SelectItem value="exempt">Exempt (0%)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Custom VAT % {taxCategory !== "standard" && <span className="text-muted-foreground">(N/A)</span>}</Label>
              <Input
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={vatRate}
                onChange={e => setVatRate(e.target.value)}
                placeholder="Default"
                disabled={taxCategory !== "standard"}
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Leave empty to use system default. Range 0–100.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={isService} onCheckedChange={setIsService} />
            <Label className="text-xs">This is a service (no stock tracking)</Label>
          </div>

          <div className="border-t pt-3 space-y-3">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Online Shop</div>

            <div>
              <Label>Description (shown only on shop)</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Short marketing description..." />
            </div>

            <div>
              <Label>Product Image (shop & inventory only — never on invoices)</Label>
              <div className="flex items-center gap-3 mt-1">
                {imageUrl ? (
                  <img src={imageUrl} alt="" className="h-16 w-16 object-cover rounded border" />
                ) : (
                  <div className="h-16 w-16 rounded border bg-muted flex items-center justify-center text-muted-foreground text-[10px]">No image</div>
                )}
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); }}
                  />
                  <span className="inline-flex items-center gap-2 px-3 py-2 rounded border text-sm hover:bg-muted">
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {uploading ? "Uploading..." : "Upload"}
                  </span>
                </label>
                {imageUrl && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setImageUrl("")}>Remove</Button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={shopVisible} onCheckedChange={setShopVisible} />
              <Label className="text-xs">Show this item in the online shop</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={shopFeatured} onCheckedChange={setShopFeatured} disabled={!shopVisible} />
              <Label className="text-xs">Feature on shop home page</Label>
            </div>
          </div>

          <Button className="w-full" onClick={submit} disabled={pending || uploading}>
            {pending ? "Saving..." : isEdit ? "Save changes" : "Add Product"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
