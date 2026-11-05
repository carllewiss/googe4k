import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useProductWithStock, useDeleteProduct } from "@/hooks/useProducts";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Edit3, Trash2, ChevronRight, Search, X } from "lucide-react";
import { ProductFormDialog } from "@/components/ProductFormDialog";
import { VirtualizedTable } from "@/components/VirtualizedTable";
import { ColumnDef } from "@tanstack/react-table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

type ProductRow = {
  id: string;
  name: string;
  category: string;
  tax_category: string;
  vat_rate: number | null;
  is_service: boolean;
  stock_on_hand: number;
  base_sell_price: number;
  floor_price: number;
  unit: string;
  min_stock: number;
};

export default function Inventory() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { data: products = [], isLoading } = useProductWithStock();
  const del = useDeleteProduct();
  const [open, setOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<any>(null);
  const [search, setSearch] = useState("");

  const q = search.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      !q
        ? products
        : products.filter(
            (p: any) =>
              p.name.toLowerCase().includes(q) ||
              p.category.toLowerCase().includes(q)
          ),
    [q, products]
  );

  const classifyStock = (stock: number, minStk: number) => {
    if (stock === 0) return "Dead Stock";
    if (stock <= minStk) return "Low";
    if (stock <= minStk * 2) return "Regular";
    return "Fast Moving";
  };

  const stockBadge = (cls: string) => {
    switch (cls) {
      case "Fast Moving": return "bg-success/10 text-success";
      case "Regular": return "bg-primary/10 text-primary";
      case "Low": return "bg-warning/10 text-warning";
      case "Service": return "bg-accent/20 text-primary";
      default: return "bg-destructive/10 text-destructive";
    }
  };

  // Stock value: services (∞) excluded
  const totalValue = products.reduce(
    (s, p) => (p.is_service ? s : s + p.stock_on_hand * Number(p.base_sell_price)),
    0
  );
  const lowStockCount = products.filter(
    p => !p.is_service && p.stock_on_hand <= p.min_stock && p.min_stock > 0
  ).length;

  const handleDelete = async (id: string) => {
    try {
      await del.mutateAsync(id);
      toast.success("Product deleted");
    } catch (e: any) { toast.error(e.message); }
  };

  const columns = useMemo<ColumnDef<ProductRow>[]>(() => {
    const cols: ColumnDef<ProductRow>[] = [
      {
        accessorKey: "name",
        header: "Product",
        cell: ({ row }) => <span className="font-medium text-sm">{row.original.name}</span>,
        size: 240,
      },
      {
        accessorKey: "category",
        header: "Category",
        cell: ({ row }) => <Badge variant="outline" className="text-xs">{row.original.category}</Badge>,
      },
      {
        id: "tax",
        header: "Tax",
        enableSorting: false,
        cell: ({ row }) => {
          const cat = row.original.tax_category || "standard";
          const rate = row.original.vat_rate;
          const label = cat === "standard"
            ? rate !== null && rate !== undefined ? `Std ${rate}%` : "Std"
            : cat.replace("_", "-");
          return <Badge variant="outline" className="text-xs capitalize">{label}</Badge>;
        },
      },
      {
        accessorKey: "stock_on_hand",
        header: () => <span className="block text-right w-full">Stock</span>,
        cell: ({ row }) => (
          <div className="text-right text-sm">
            {row.original.is_service ? "∞" : `${row.original.stock_on_hand} ${row.original.unit}`}
          </div>
        ),
      },
      {
        accessorKey: "base_sell_price",
        header: () => <span className="block text-right w-full">Sell Price</span>,
        cell: ({ row }) => (
          <div className="text-right text-sm">{Number(row.original.base_sell_price).toLocaleString()}</div>
        ),
      },
    ];

    if (isAdmin) {
      cols.push({
        accessorKey: "floor_price",
        header: () => <span className="block text-right w-full">Floor</span>,
        cell: ({ row }) => (
          <div className="text-right text-sm text-muted-foreground">
            {Number(row.original.floor_price).toLocaleString()}
          </div>
        ),
      });
    }

    cols.push(
      {
        id: "status",
        header: "Status",
        enableSorting: false,
        cell: ({ row }) => {
          const cls = row.original.is_service ? "Service" : classifyStock(row.original.stock_on_hand, row.original.min_stock);
          return <Badge className={`text-xs ${stockBadge(cls)}`}>{cls}</Badge>;
        },
      },
      {
        id: "level",
        header: "Level",
        enableSorting: false,
        size: 130,
        cell: ({ row }) => {
          if (row.original.is_service) return <span className="text-xs text-muted-foreground italic">N/A</span>;
          const stockPct = row.original.min_stock > 0
            ? Math.min(100, (row.original.stock_on_hand / (row.original.min_stock * 3)) * 100)
            : 100;
          return <Progress value={stockPct} className="h-2 w-24" />;
        },
      },
      {
        id: "actions",
        header: () => <span className="block text-right w-full">Actions</span>,
        enableSorting: false,
        size: 130,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            {isAdmin && (
              <>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditProduct(row.original); setOpen(true); }}>
                  <Edit3 className="h-3.5 w-3.5" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete {row.original.name}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This is permanent. Blocked if the product has any sales history or stock batches.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(row.original.id)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        ),
      }
    );

    return cols;
  }, [isAdmin]);

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold font-heading">Inventory</h1>
        {isAdmin && (
          <Button onClick={() => { setEditProduct(null); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Add Product
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Items</p><p className="text-xl font-bold">{products.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Stock Value (Retail)</p><p className="text-xl font-bold">KES {totalValue.toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Low Stock Items</p><p className="text-xl font-bold text-destructive">{lowStockCount}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Services</p><p className="text-xl font-bold">{products.filter(p => p.is_service).length}</p></CardContent></Card>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products as you type — name or category…"
            className="pl-10 pr-9"
            aria-label="Search inventory"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {q && (
          <p className="text-xs text-muted-foreground">
            {filtered.length} of {products.length} products
          </p>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <VirtualizedTable<ProductRow>
            data={filtered as ProductRow[]}
            columns={columns}
            rowHeight={48}
            height="65vh"
            onRowClick={(p) => navigate(`/inventory/${p.id}`)}
            empty={q ? `No products match "${search}".` : "No products yet."}
          />
        </CardContent>
      </Card>

      <ProductFormDialog open={open} onOpenChange={setOpen} product={editProduct} />
    </div>
  );
}
