import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useCustomerNotes(customerId: string | undefined) {
  return useQuery({
    queryKey: ["customer-notes", customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_notes")
        .select("*")
        .eq("customer_id", customerId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useCreateCustomerNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ customerId, note }: { customerId: string; note: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("customer_notes").insert({
        customer_id: customerId,
        note,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_, vars) =>
      qc.invalidateQueries({ queryKey: ["customer-notes", vars.customerId] }),
  });
}

export function useDeleteCustomerNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; customerId: string }) => {
      const { error } = await supabase.from("customer_notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) =>
      qc.invalidateQueries({ queryKey: ["customer-notes", vars.customerId] }),
  });
}
