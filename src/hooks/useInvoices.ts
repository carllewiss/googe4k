import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type InvoiceRow = Database["public"]["Tables"]["invoices"]["Row"];
type InvoiceItemRow = Database["public"]["Tables"]["invoice_items"]["Row"];

export interface InvoiceWithItems extends InvoiceRow {
  invoice_items: InvoiceItemRow[];
  customer_name?: string;
  customer_phone?: string | null;
  customer_kra_pin?: string | null;
  customer_code?: string | null;
  customer_email?: string | null;
  customer_credit_terms?: number | null;
  is_walkin?: boolean;
}

export function useInvoices() {
  return useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*, invoice_items(*, products(name)), customers(name, phone, kra_pin, customer_code, email, credit_terms, customer_type)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data?.map(inv => {
        const c = inv.customers as any;
        const walkinName = (inv as any).walkin_name as string | null;
        const walkinPhone = (inv as any).walkin_phone as string | null;
        const isWalkin = !!walkinPhone || !!walkinName || c?.customer_type === "walk_in";
        return {
          ...inv,
          is_walkin: isWalkin,
          customer_name: walkinName || c?.name || "Walk-in",
          customer_phone: walkinPhone ?? c?.phone ?? null,
          customer_kra_pin: c?.kra_pin ?? null,
          customer_code: c?.customer_code ?? null,
          customer_email: c?.email ?? null,
          customer_credit_terms: c?.credit_terms ?? 30,
        };
      }) as InvoiceWithItems[];
    },
  });
}

export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      invoice: Omit<Database["public"]["Tables"]["invoices"]["Insert"], "id" | "invoice_number" | "created_at" | "updated_at">;
      items: Array<{
        product_id: string;
        quantity: number;
        unit_price: number;
        discount: number;
        total: number;
      }>;
    }) => {
      // Create invoice
      const { data: inv, error: invErr } = await supabase
        .from("invoices")
        .insert(params.invoice)
        .select()
        .single();
      if (invErr) throw invErr;

      // Deduct stock via FIFO and create items
      for (const item of params.items) {
        const { data: cogs, error: cogsErr } = await supabase.rpc("deduct_stock_fifo", {
          p_product_id: item.product_id,
          p_quantity: item.quantity,
        });
        if (cogsErr) console.error("FIFO error:", cogsErr);

        const { error: itemErr } = await supabase.from("invoice_items").insert({
          invoice_id: inv.id,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount: item.discount,
          total: item.total,
          cogs: cogs || 0,
        });
        if (itemErr) throw itemErr;
      }

      // Update customer balance & stats
      const balance = params.invoice.balance || 0;
      const paid = params.invoice.paid_amount || 0;
      if (balance > 0 || paid > 0) {
        const { data: cust } = await supabase
          .from("customers")
          .select("current_balance, total_spent, visit_count")
          .eq("id", params.invoice.customer_id)
          .single();
        if (cust) {
          await supabase.from("customers").update({
            current_balance: Number(cust.current_balance) + balance,
            total_spent: Number(cust.total_spent) + paid,
            visit_count: Number(cust.visit_count) + 1,
          }).eq("id", params.invoice.customer_id);
        }
      }

      return inv;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["products-with-stock"] });
    },
  });
}
