import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface PortalVoucher {
  id: string;
  code: string | null;
  package_type: string | null;
  duration_hours: number | null;
  status: string | null;
  is_used: boolean | null;
  used_by_mac: string | null;
  used_at: string | null;
  created_at: string | null;
}

export interface VoucherListResult {
  rows: PortalVoucher[];
  total: number;
  page: number;
  pageSize: number;
  totals: { all: number; used: number; unused: number };
}

export interface VoucherUploadRow {
  code: string;
  package_type?: string;
  duration_hours?: number;
}

export function useVoucherInventory(params: {
  page: number;
  pageSize: number;
  status: "all" | "used" | "unused";
  search: string;
}) {
  return useQuery({
    queryKey: ["wifi_voucher_inventory", params],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("wifi-vouchers", {
        body: { action: "list", ...params },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as VoucherListResult;
    },
    placeholderData: (prev) => prev,
  });
}

export function useUploadVouchers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vouchers: VoucherUploadRow[]) => {
      const { data, error } = await supabase.functions.invoke("wifi-vouchers", {
        body: { action: "upload", vouchers },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { inserted: number; skipped: number; received: number };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["wifi_voucher_inventory"] });
      toast({
        title: "Vouchers uploaded",
        description: `${data.inserted} added${data.skipped ? ` · ${data.skipped} duplicate${data.skipped === 1 ? "" : "s"} skipped` : ""}.`,
      });
    },
    onError: (e: any) => {
      toast({ title: "Upload failed", description: String(e?.message ?? e), variant: "destructive" });
    },
  });
}
