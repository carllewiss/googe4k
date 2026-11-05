import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type EtimsStatus = "not_required" | "pending_sync" | "signed" | "failed";

export function usePendingEtimsInvoices() {
  return useQuery({
    queryKey: ["etims-pending"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*, customers(name, customer_code, kra_pin)")
        .in("etims_status", ["pending_sync", "failed"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

/**
 * Stub: simulates a successful KRA OSCU API handshake.
 * Replace with a real edge function call when device certs are provisioned.
 */
export function useSyncEtimsInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (invoiceId: string) => {
      // TODO: call edge function `etims-submit` with invoice payload.
      // For now we simulate success and stamp a fake signature.
      const fakeSignature = `KRA-SIM-${Date.now().toString(36).toUpperCase()}`;
      const fakeQr = `https://etims.kra.go.ke/verify/${fakeSignature}`;
      const { error } = await supabase
        .from("invoices")
        .update({
          etims_status: "signed" as EtimsStatus,
          etims_signature: fakeSignature,
          etims_qr_data: fakeQr,
          etims_synced_at: new Date().toISOString(),
          etims_error: null,
        })
        .eq("id", invoiceId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["etims-pending"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}

export function useMarkReprint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (invoiceId: string) => {
      const { data: inv } = await supabase
        .from("invoices")
        .select("reprint_count")
        .eq("id", invoiceId)
        .maybeSingle();
      const next = (inv?.reprint_count || 0) + 1;
      const { error } = await supabase
        .from("invoices")
        .update({
          reprint_count: next,
          last_reprinted_at: new Date().toISOString(),
        })
        .eq("id", invoiceId);
      if (error) throw error;
      return next;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invoices"] }),
  });
}
