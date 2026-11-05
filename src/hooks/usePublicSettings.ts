import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const PUBLIC_KEYS = [
  "adsense_enabled",
  "adsense_client",
  "adsense_slot_sidebar",
  "adsense_slot_footer",
  "adsense_slot_article",
];

/**
 * Public (anon-readable) shop settings — used on the customer-facing storefront.
 * Only a small allow-list of keys is exposed via RLS.
 */
export function usePublicSettings() {
  return useQuery({
    queryKey: ["public-settings"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("system_settings")
        .select("key,value")
        .in("key", PUBLIC_KEYS);
      if (error) throw error;
      const map: Record<string, string> = {};
      (data || []).forEach((s: any) => { map[s.key] = s.value; });
      return map;
    },
  });
}
