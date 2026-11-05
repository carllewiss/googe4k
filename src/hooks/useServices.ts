import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Service = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

/** Public: only active services, ordered for the storefront */
export function useActiveServices() {
  return useQuery({
    queryKey: ["services-active"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("services")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as Service[];
    },
  });
}

/** Admin: all services */
export function useAllServices() {
  return useQuery({
    queryKey: ["services-all"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("services")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as Service[];
    },
  });
}

export function useSaveService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Service> & { id?: string }) => {
      if (input.id) {
        const { id, ...rest } = input;
        const { error } = await (supabase as any).from("services").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("services").insert(input);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["services-all"] });
      qc.invalidateQueries({ queryKey: ["services-active"] });
    },
  });
}

export function useDeleteService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("services").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["services-all"] });
      qc.invalidateQueries({ queryKey: ["services-active"] });
    },
  });
}

/** Uploads a service image to the public blog-images bucket and returns its URL */
export async function uploadServiceImage(file: File): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `services/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("blog-images")
    .upload(path, file, { contentType: file.type });
  if (error) throw error;
  const { data } = supabase.storage.from("blog-images").getPublicUrl(path);
  return data.publicUrl;
}
