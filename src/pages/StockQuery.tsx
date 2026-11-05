import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useProduct, useProductBatches, useProductMovements, useDeleteProduct } from "@/hooks/useProducts";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Database, Edit3, Trash2, Lock } from "lucide-react";
import { ProductFormDialog } from "@/components/ProductFormDialog";
import { usePriceHistory } from "@/hooks/usePriceHistory";
import { TrendingUp, TrendingDown } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export default function StockQuery() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { data: product, isLoading } = useProduct(productId);
  const { data: batches = [] } = useProductBatches(productId);
  const { data: movements = [] } = useProductMovements(productId);
  const { data: priceHistory = [] } = usePriceHistory(isAdmin ? productId : undefined);
  const del = useDeleteProduct();
  const [editOpen, setEditOpen] = useState(false);

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }
  if (!product) return <div className="p-6 text-muted-foreground">Product not found.</div>;

  const onHand = batches.reduce((s, b: any) => s + (b.quantity_remaining || 0), 0);
  const stockValueAtCost = batches.reduce((s, b: any) => s + b.quantity_remaining * Number(b.cost_price), 0);
  const avgCost = onHand > 0 ? stockValueAtCost / onHand : 0;

  const handleDelete = async () => {
    try {
      await del.mutateAsync(product.id);
      toast.success("Product deleted");
      navigate("/inventory");
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-4">
      {/* Header strip */}
      <div className="bg-primary text-primary-foreground p-4 rounded-lg flex items-center justify-between shadow-elegant">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/inventory")} className="text-primary-foreground hover:bg-primary-foreground/10">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Database className="h-5 w-5 text-accent" />
          <h1 className="font-bold tracking-tight font-heading">STOCK QUERY: {product.name.toUpperCase()}</h1>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setEditOpen(true)}>
              <Edit3 className="h-4 w-4 mr-1" /> Edit
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="destructive"><Trash2 className="h-4 w-4 mr-1" /> Delete</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this product?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently removes <b>{product.name}</b>. Blocked if it has any sales or stock batches.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      {/* Details card */}
      <Card className="p-5 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-3">
          <h3 className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">General</h3>
          <div className="text-sm space-y-1">
            <p className="flex justify-between border-b py-1"><span className="text-muted-foreground">Name:</span> <span className="font-bold text-primary">{product.name}</span></p>
            <p className="flex justify-between border-b py-1"><span className="text-muted-foreground">Category:</span> <span className="font-medium">{product.category}</span></p>
            <p className="flex justify-between border-b py-1"><span className="text-muted-foreground">Unit:</span> <span>{product.unit}</span></p>
            <p className="flex justify-between py-1"><span className="text-muted-foreground">Type:</span> <span>{product.is_service ? "Service" : "Stock Item"}</span></p>
          </div>
        </div>
        <div className="space-y-3">
          <h3 className="text-[11px] font-black text-muted-foreground uppercase tracking-widest">Pricing & Tax</h3>
          <div className="text-sm space-y-1">
            <p className="flex justify-between border-b py-1"><span className="text-muted-foreground">Selling Price:</span> <span className="font-bold text-lg">KES {Number(product.base_sell_price).toLocaleString()}</span></p>
            <p className="flex justify-between border-b py-1"><span className="text-muted-foreground">Floor Price:</span> <span>KES {Number(product.floor_price).toLocaleString()}</span></p>
            <p className="flex justify-between border-b py-1"><span className="text-muted-foreground">Tax:</span> <Badge variant="outline" className="text-xs capitalize">{product.tax_category.replace("_", "-")}</Badge></p>
            {isAdmin ? (
              <p className="flex justify-between py-1 text-xs">
                <span className="text-muted-foreground italic">Avg FIFO Cost:</span>
                <span className="font-mono font-bold">KES {avgCost.toFixed(2)}</span>
              </p>
            ) : (
              <p className="flex items-center gap-1 py-1 text-xs text-muted-foreground italic">
                <Lock className="h-3 w-3" /> Cost data restricted to admins
              </p>
            )}
          </div>
        </div>
        <div className="bg-accent-soft border border-accent/30 rounded-lg p-4 flex flex-col justify-center items-center">
          <p className="text-xs text-primary font-bold uppercase tracking-widest">
            {product.is_service ? "Service" : "Total On-Hand"}
          </p>
          {product.is_service ? (
            <h2 className="text-3xl font-black text-primary font-heading">∞</h2>
          ) : (
            <h2 className="text-4xl font-black text-primary font-heading">
              {onHand} <span className="text-sm font-normal">{product.unit}</span>
            </h2>
          )}
          {isAdmin && !product.is_service && (
            <p className="text-xs text-muted-foreground mt-2">Stock value: KES {stockValueAtCost.toLocaleString()}</p>
          )}
          {product.is_service && (
            <p className="text-xs text-muted-foreground mt-2 italic">No stock tracking</p>
          )}
        </div>
      </Card>

      {/* Tabs */}
      <Card className="overflow-hidden">
        <Tabs defaultValue="movements">
          <TabsList className="rounded-none border-b w-full justify-start bg-muted/30 h-auto p-0">
            <TabsTrigger value="movements" className="data-[state=active]:bg-background data-[state=active]:border-t-2 data-[state=active]:border-t-primary rounded-none px-6 py-3 text-xs font-bold uppercase">
              {product.is_service ? "Invoices" : "Movements"}
            </TabsTrigger>
            {isAdmin && !product.is_service && (
              <TabsTrigger value="batches" className="data-[state=active]:bg-background data-[state=active]:border-t-2 data-[state=active]:border-t-primary rounded-none px-6 py-3 text-xs font-bold uppercase">Warehouse Values</TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="prices" className="data-[state=active]:bg-background data-[state=active]:border-t-2 data-[state=active]:border-t-primary rounded-none px-6 py-3 text-xs font-bold uppercase">Price History</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="movements" className="m-0 max-h-[60vh] overflow-auto">
            {movements.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">No movements yet.</div>
            ) : (
              <Table>
                <TableHeader className="sticky top-0 bg-muted/50">
                  <TableRow>
                    <TableHead className="text-[10px] uppercase">Date</TableHead>
                    <TableHead className="text-[10px] uppercase">Type</TableHead>
                    <TableHead className="text-[10px] uppercase">Reference</TableHead>
                    <TableHead className="text-[10px] uppercase text-right">Qty</TableHead>
                    {isAdmin && <TableHead className="text-[10px] uppercase text-right">Unit Value</TableHead>}
                    <TableHead className="text-[10px] uppercase">Narration</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.map((m) => (
                    <TableRow key={`${m.type}-${m.id}`} className={m.type === "SALE" ? "hover:bg-destructive/5" : "hover:bg-accent-soft border-l-4 border-l-accent"}>
                      <TableCell className="font-mono text-xs text-muted-foreground">{new Date(m.date).toLocaleString()}</TableCell>
                      <TableCell>
                        {m.type === "SALE" ? (
                          <Badge className="bg-destructive/15 text-destructive border-destructive/20 font-bold">SALE</Badge>
                        ) : m.type === "RTN" ? (
                          <Badge className="bg-warning/15 text-warning border-warning/30 font-bold">RTN</Badge>
                        ) : (
                          <Badge className="bg-accent/20 text-primary border-accent/30 font-bold">REC</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {m.invoiceNumber ? (
                          <Link to="/invoices" className="font-bold text-primary underline">{m.reference}</Link>
                        ) : (
                          <span className="font-mono text-xs">{m.reference}</span>
                        )}
                      </TableCell>
                      <TableCell className={`text-right font-black ${m.qtyChange < 0 ? "text-destructive" : "text-success"}`}>
                        {m.qtyChange > 0 ? "+" : ""}{m.qtyChange}
                      </TableCell>
                      {isAdmin && <TableCell className="text-right font-mono text-xs">KES {m.unitValue.toLocaleString()}</TableCell>}
                      <TableCell className="text-xs text-muted-foreground">{m.narration}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          {isAdmin && !product.is_service && (
            <TabsContent value="batches" className="m-0 max-h-[60vh] overflow-auto">
              {batches.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">No stock batches.</div>
              ) : (
                <Table>
                  <TableHeader className="sticky top-0 bg-muted/50">
                    <TableRow>
                      <TableHead className="text-[10px] uppercase">Purchase Date</TableHead>
                      <TableHead className="text-[10px] uppercase">Supplier</TableHead>
                      <TableHead className="text-[10px] uppercase text-right">Bought</TableHead>
                      <TableHead className="text-[10px] uppercase text-right">Remaining</TableHead>
                      <TableHead className="text-[10px] uppercase text-right">Cost / Unit</TableHead>
                      <TableHead className="text-[10px] uppercase text-right">Batch Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batches.map((b: any) => (
                      <TableRow key={b.id}>
                        <TableCell className="font-mono text-xs">{b.purchase_date}</TableCell>
                        <TableCell className="text-sm">{b.suppliers?.name || "—"}</TableCell>
                        <TableCell className="text-right text-sm">{b.quantity_bought}</TableCell>
                        <TableCell className="text-right font-bold">{b.quantity_remaining}</TableCell>
                        <TableCell className="text-right font-mono text-xs">KES {Number(b.cost_price).toLocaleString()}</TableCell>
                        <TableCell className="text-right font-mono text-xs">KES {(b.quantity_remaining * Number(b.cost_price)).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="prices" className="m-0 max-h-[60vh] overflow-auto">
              {priceHistory.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  No price changes logged yet. Every edit to selling or floor price will appear here.
                </div>
              ) : (
                <Table>
                  <TableHeader className="sticky top-0 bg-muted/50">
                    <TableRow>
                      <TableHead className="text-[10px] uppercase">When</TableHead>
                      <TableHead className="text-[10px] uppercase">Field</TableHead>
                      <TableHead className="text-[10px] uppercase text-right">Old</TableHead>
                      <TableHead className="text-[10px] uppercase text-right">New</TableHead>
                      <TableHead className="text-[10px] uppercase text-right">Δ</TableHead>
                      <TableHead className="text-[10px] uppercase">Changed By</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {priceHistory.map((p) => {
                      const delta = Number(p.new_value) - Number(p.old_value);
                      const up = delta > 0;
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {new Date(p.changed_at).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {p.field_changed === "base_sell_price" ? "Selling Price" : "Floor Price"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-muted-foreground line-through">
                            KES {Number(p.old_value).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs font-bold">
                            KES {Number(p.new_value).toLocaleString()}
                          </TableCell>
                          <TableCell className={`text-right font-mono text-xs font-bold flex items-center justify-end gap-1 ${up ? "text-success" : "text-destructive"}`}>
                            {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                            {up ? "+" : ""}{delta.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-sm">{p.changed_by_name || "System"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          )}
        </Tabs>
      </Card>

      <ProductFormDialog open={editOpen} onOpenChange={setEditOpen} product={product as any} />
    </div>
  );
}
