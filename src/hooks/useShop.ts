import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useShopProducts(category?: string, search?: string) {
  return useQuery({
    queryKey: ["shop-products", category, search],
    queryFn: async () => {
      let q = supabase
        .from("products")
        .select("id,name,category,base_sell_price,unit,is_service,image_url,description,shop_featured")
        .eq("shop_visible", true)
        .order("shop_featured", { ascending: false })
        .order("name");
      if (category && category !== "all") q = q.eq("category", category as any);
      const { data, error } = await q;
      if (error) throw error;
      let rows = data || [];
      if (search?.trim()) {
        const s = search.toLowerCase();
        rows = rows.filter((p) => p.name.toLowerCase().includes(s));
      }
      return rows;
    },
  });
}

export function useShopProduct(id: string | undefined) {
  return useQuery({
    queryKey: ["shop-product", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,name,category,base_sell_price,unit,is_service,image_url,description")
        .eq("id", id!)
        .eq("shop_visible", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useShopFeatured() {
  return useQuery({
    queryKey: ["shop-featured"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,name,base_sell_price,image_url,category")
        .eq("shop_visible", true)
        .eq("shop_featured", true)
        .limit(8);
      if (error) throw error;
      return data || [];
    },
  });
}

export function useMyOrders(userId: string | undefined) {
  return useQuery({
    queryKey: ["my-orders", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shop_orders")
        .select("*, shop_order_items(*)")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useAdminShopOrders() {
  return useQuery({
    queryKey: ["admin-shop-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shop_orders")
        .select("*, shop_order_items(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useLogServiceInquiry() {
  return useMutation({
    mutationFn: async (input: {
      service_key: string;
      service_name: string;
      whatsapp_message?: string;
      customer_name?: string;
      customer_phone?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("service_inquiries").insert({
        ...input,
        user_id: user?.id ?? null,
      });
      if (error) throw error;
    },
  });
}

export function useServiceInquiries() {
  return useQuery({
    queryKey: ["service-inquiries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_inquiries")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useUpdateProductShop() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      image_url?: string | null;
      description?: string | null;
      shop_visible?: boolean;
      shop_featured?: boolean;
    }) => {
      const { id, ...updates } = input;
      const { error } = await supabase.from("products").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["products-with-stock"] });
      qc.invalidateQueries({ queryKey: ["shop-products"] });
      qc.invalidateQueries({ queryKey: ["shop-featured"] });
    },
  });
}

export async function uploadProductImage(file: File, productId: string): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${productId}/${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("product-images")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (upErr) throw upErr;
  const { data } = supabase.storage.from("product-images").getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadBlogImage(file: File): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("blog-images")
    .upload(path, file, { contentType: file.type });
  if (upErr) throw upErr;
  const { data } = supabase.storage.from("blog-images").getPublicUrl(path);
  return data.publicUrl;
}
