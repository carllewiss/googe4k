import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type BlogPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: any;
  cover_image_url: string | null;
  author_name: string | null;
  published: boolean;
  published_at: string | null;
  view_count: number;
  created_at: string;
  updated_at: string;
};

export function usePublishedPosts() {
  return useQuery({
    queryKey: ["blog-published"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("published", true)
        .order("published_at", { ascending: false });
      if (error) throw error;
      return (data || []) as BlogPost[];
    },
  });
}

export function usePostBySlug(slug: string | undefined) {
  return useQuery({
    queryKey: ["blog-post", slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("slug", slug!)
        .maybeSingle();
      if (error) throw error;
      return data as BlogPost | null;
    },
  });
}

export function useAllPostsAdmin() {
  return useQuery({
    queryKey: ["blog-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as BlogPost[];
    },
  });
}

export function usePostById(id: string | undefined) {
  return useQuery({
    queryKey: ["blog-id", id],
    enabled: !!id && id !== "new",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data as BlogPost | null;
    },
  });
}

export function useSavePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<BlogPost> & { id?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const payload: any = {
        ...input,
        author_id: user?.id ?? null,
      };
      if (input.published && !input.published_at) {
        payload.published_at = new Date().toISOString();
      }
      if (input.id) {
        const { id, ...rest } = payload;
        const { data, error } = await supabase
          .from("blog_posts")
          .update(rest)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase
        .from("blog_posts")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["blog-all"] });
      qc.invalidateQueries({ queryKey: ["blog-published"] });
    },
  });
}

export function useDeletePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("blog_posts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["blog-all"] });
      qc.invalidateQueries({ queryKey: ["blog-published"] });
    },
  });
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
