import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type OpeningStockLine = {
  product_id: string;
  quantity: number;
  unit_cost: number;
};

export function useOpeningStockRuns() {
  return useQuery({
    queryKey: ["opening-stock-runs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("opening_stock_runs")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export function usePostOpeningStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      items,
      entryDate,
      notes,
    }: {
      items: OpeningStockLine[];
      entryDate: string;
      notes?: string;
    }) => {
      const { data, error } = await supabase.rpc("post_opening_stock", {
        p_items: items as any,
        p_entry_date: entryDate,
        p_notes: notes || null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["opening-stock-runs"] });
      qc.invalidateQueries({ queryKey: ["products-with-stock"] });
      qc.invalidateQueries({ queryKey: ["product-batches"] });
      qc.invalidateQueries({ queryKey: ["accounting"] });
    },
  });
}
