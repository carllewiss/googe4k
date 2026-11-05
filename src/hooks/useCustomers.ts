import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useCustomers() {
  return useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (customer: {
      name: string;
      phone?: string;
      email?: string | null;
      kra_pin?: string;
      location?: string | null;
      customer_type?: "walk_in" | "regular";
      debt_limit?: number;
      credit_terms?: number;
    }) => {
      const { data, error } = await supabase.from("customers").insert(customer).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers"] }),
  });
}

export function useUpdateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; phone?: string; email?: string | null; kra_pin?: string | null; location?: string | null; debt_limit?: number; credit_terms?: number; is_suspended?: boolean; current_balance?: number; total_spent?: number; visit_count?: number }) => {
      const { error } = await supabase.from("customers").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers"] }),
  });
}
