import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PriceHistoryRow {
  id: string;
  product_id: string;
  field_changed: "base_sell_price" | "floor_price";
  old_value: number;
  new_value: number;
  changed_by: string | null;
  changed_at: string;
  reason: string | null;
  changed_by_name?: string;
}

export function usePriceHistory(productId: string | undefined) {
  return useQuery({
    queryKey: ["price-history", productId],
    enabled: !!productId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("price_history" as any)
        .select("*")
        .eq("product_id", productId!)
        .order("changed_at", { ascending: false })
        .limit(100);
      if (error) throw error;

      const rows = (data || []) as unknown as PriceHistoryRow[];
      const userIds = Array.from(new Set(rows.map(r => r.changed_by).filter(Boolean))) as string[];
      if (userIds.length === 0) return rows;

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", userIds);

      const nameMap = new Map((profiles || []).map(p => [p.user_id, p.display_name]));
      return rows.map(r => ({
        ...r,
        changed_by_name: r.changed_by ? nameMap.get(r.changed_by) || "Unknown" : "System",
      }));
    },
  });
}
