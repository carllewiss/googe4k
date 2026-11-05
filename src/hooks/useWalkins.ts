import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const normalizePhone = (p?: string | null) => (p || "").replace(/\s+/g, "").trim();

/** The single shared walk-in ledger account every untagged walk-in sale is booked to. */
export const WALKIN_CUSTOMER_CODE = "4K-CUST-015";
export const WALKIN_CUSTOMER_NAME = "WALKIN-CUSTOMER";

/** Picks the official walk-in account from a customer list (never any other walk_in row). */
export function findWalkinAccount<T extends { customer_code?: string | null; name?: string | null; customer_type?: string | null }>(
  customers: T[]
): T | undefined {
  return (
    customers.find((c) => c.customer_code === WALKIN_CUSTOMER_CODE) ||
    customers.find((c) => (c.name || "").trim().toUpperCase() === WALKIN_CUSTOMER_NAME) ||
    customers.find((c) => c.customer_type === "walk_in")
  );
}

export interface WalkinHistory {
  phone: string;
  visits: number;
  totalSpent: number;
  lastName: string | null;
  lastDate: string | null;
}

/** Looks up previous walk-in sales made with the same phone number. */
export function useWalkinHistory(phone: string) {
  const clean = normalizePhone(phone);
  return useQuery({
    queryKey: ["walkin-history", clean],
    enabled: clean.length >= 9,
    queryFn: async (): Promise<WalkinHistory | null> => {
      const { data, error } = await supabase
        .from("invoices")
        .select("total, paid_amount, walkin_name, created_at")
        .eq("walkin_phone", clean)
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (!data || data.length === 0) return null;
      return {
        phone: clean,
        visits: data.length,
        totalSpent: data.reduce((s, i) => s + Number(i.total || 0), 0),
        lastName: data.find((d) => d.walkin_name)?.walkin_name ?? null,
        lastDate: data[0].created_at,
      };
    },
  });
}

/** Creates a real customer account from a walk-in phone and moves all past invoices onto it. */
export function useConvertWalkin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      phone: string;
      name: string;
      email?: string | null;
      kra_pin?: string | null;
      location?: string | null;
      debt_limit?: number;
      credit_terms?: number;
      /** When false, only the account is created; past invoices stay as walk-ins. */
      convertPrevious: boolean;
      /** Reuse an existing customer instead of creating a new one. */
      existingCustomerId?: string;
    }) => {
      const phone = normalizePhone(params.phone);
      let customerId = params.existingCustomerId;

      if (!customerId) {
        const { data, error } = await supabase
          .from("customers")
          .insert({
            name: params.name.trim(),
            phone,
            email: params.email || null,
            kra_pin: params.kra_pin || null,
            location: params.location || null,
            customer_type: "regular",
            debt_limit: params.debt_limit ?? 0,
            credit_terms: params.credit_terms ?? 0,
          })
          .select()
          .single();
        if (error) throw error;
        customerId = data.id;
      }

      let moved = 0;
      if (params.convertPrevious) {
        const { data, error } = await supabase.rpc("convert_walkin_to_customer", {
          p_phone: phone,
          p_customer_id: customerId!,
        });
        if (error) throw error;
        moved = Number(data) || 0;
      }
      return { customerId: customerId!, moved };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["walkin-history"] });
    },
  });
}
