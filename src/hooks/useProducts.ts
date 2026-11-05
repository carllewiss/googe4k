import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useProducts() {
  return useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useProductWithStock() {
  return useQuery({
    queryKey: ["products-with-stock"],
    queryFn: async () => {
      const { data: products, error } = await supabase.from("products").select("*").order("name");
      if (error) throw error;

      // Get stock from batches
      const { data: batches, error: bErr } = await supabase
        .from("stock_batches")
        .select("product_id, quantity_remaining");
      if (bErr) throw bErr;

      const stockMap: Record<string, number> = {};
      batches?.forEach(b => {
        stockMap[b.product_id] = (stockMap[b.product_id] || 0) + (b.quantity_remaining || 0);
      });

      return products?.map(p => ({
        ...p,
        stock_on_hand: stockMap[p.id] || 0,
      })) || [];
    },
  });
}

export function useProduct(id: string | undefined) {
  return useQuery({
    queryKey: ["products", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useProductBatches(productId: string | undefined) {
  return useQuery({
    queryKey: ["product-batches", productId],
    enabled: !!productId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_batches")
        .select("*, suppliers(name)")
        .eq("product_id", productId!)
        .order("purchase_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useProductMovements(productId: string | undefined) {
  return useQuery({
    queryKey: ["product-movements", productId],
    enabled: !!productId,
    queryFn: async () => {
      // SALE rows from invoice_items
      const { data: sales, error: sErr } = await supabase
        .from("invoice_items")
        .select("id, quantity, unit_price, cogs, created_at, invoices(invoice_number, customers(name, customer_code))")
        .eq("product_id", productId!)
        .order("created_at", { ascending: false })
        .limit(200);
      if (sErr) throw sErr;

      // REC rows from stock_batches (purchases)
      const { data: receipts, error: rErr } = await supabase
        .from("stock_batches")
        .select("id, quantity_bought, cost_price, purchase_date, created_at, suppliers(name)")
        .eq("product_id", productId!)
        .order("created_at", { ascending: false })
        .limit(200);
      if (rErr) throw rErr;

      // RTN rows from credit_note_items (returns restored to stock)
      const { data: returns, error: cnErr } = await supabase
        .from("credit_note_items")
        .select("id, quantity, unit_price, created_at, restored_to_stock, credit_notes(credit_note_number, customers(name, customer_code))")
        .eq("product_id", productId!)
        .order("created_at", { ascending: false })
        .limit(200);
      if (cnErr) throw cnErr;

      type Row = {
        id: string;
        type: "SALE" | "REC" | "RTN";
        date: string;
        reference: string;
        qtyChange: number;
        unitValue: number;
        narration: string;
        invoiceNumber?: string;
      };

      const rows: Row[] = [
        ...(sales || []).map((s: any) => ({
          id: s.id,
          type: "SALE" as const,
          date: s.created_at,
          reference: s.invoices?.invoice_number || "—",
          qtyChange: -Number(s.quantity),
          unitValue: Number(s.unit_price),
          narration: s.invoices?.customers
            ? `Sold to: ${s.invoices.customers.name} (${s.invoices.customers.customer_code})`
            : "Sale",
          invoiceNumber: s.invoices?.invoice_number,
        })),
        ...(receipts || []).map((r: any) => ({
          id: r.id,
          type: "REC" as const,
          date: r.created_at,
          reference: r.purchase_date,
          qtyChange: Number(r.quantity_bought),
          unitValue: Number(r.cost_price),
          narration: r.suppliers ? `Supplier: ${r.suppliers.name}` : "Stock receipt",
        })),
        ...(returns || []).map((c: any) => ({
          id: c.id,
          type: "RTN" as const,
          date: c.created_at,
          reference: c.credit_notes?.credit_note_number || "—",
          qtyChange: c.restored_to_stock ? Number(c.quantity) : 0,
          unitValue: Number(c.unit_price),
          narration: c.credit_notes?.customers
            ? `Return from: ${c.credit_notes.customers.name} (${c.credit_notes.customers.customer_code})`
            : "Customer return",
        })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      return rows;
    },
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (product: {
      name: string;
      category: "Phone Accessories" | "Internet Services" | "Printing Services" | "Other Services";
      base_sell_price: number;
      floor_price: number;
      unit: string;
      min_stock: number;
      is_service: boolean;
      tax_category?: string;
      vat_rate?: number | null;
    }) => {
      const { data, error } = await supabase.from("products").insert(product as any).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["products-with-stock"] });
    },
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: {
      id: string;
      name?: string;
      category?: "Phone Accessories" | "Internet Services" | "Printing Services" | "Other Services";
      base_sell_price?: number;
      floor_price?: number;
      unit?: string;
      min_stock?: number;
      is_service?: boolean;
      tax_category?: string;
      vat_rate?: number | null;
    }) => {
      const { error } = await supabase.from("products").update(updates as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["products-with-stock"] });
    },
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Block delete if invoice_items or batches exist
      const { count: invCount } = await supabase
        .from("invoice_items")
        .select("id", { count: "exact", head: true })
        .eq("product_id", id);
      if ((invCount || 0) > 0) {
        throw new Error("Cannot delete: product has sales history. Consider hiding instead.");
      }
      const { count: batchCount } = await supabase
        .from("stock_batches")
        .select("id", { count: "exact", head: true })
        .eq("product_id", id);
      if ((batchCount || 0) > 0) {
        throw new Error("Cannot delete: product has stock batches. Clear batches first.");
      }
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["products-with-stock"] });
    },
  });
}
