import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { usePostById, useSavePost, slugify } from "@/hooks/useBlog";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { TiptapEditor } from "@/components/blog/TiptapEditor";
import { uploadBlogImage } from "@/hooks/useShop";
import { toast } from "sonner";
import { ArrowLeft, ImageIcon } from "lucide-react";

export default function AdminBlogEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === "new";
  const { data: existing } = usePostById(id);
  const save = useSavePost();
  const { displayName } = useAuth();

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [content, setContent] = useState<any>(null);
  const [published, setPublished] = useState(false);

  useEffect(() => {
    if (existing) {
      setTitle(existing.title);
      setSlug(existing.slug);
      setExcerpt(existing.excerpt || "");
      setCoverUrl(existing.cover_image_url);
      setContent(existing.content);
      setPublished(existing.published);
    }
  }, [existing]);

  useEffect(() => {
    if (isNew && title && !slug) setSlug(slugify(title));
  }, [title, isNew, slug]);

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadBlogImage(file);
      setCoverUrl(url);
      toast.success("Cover image uploaded");
    } catch (err: any) { toast.error(err.message); }
  };

  const handleSave = async (publishNow?: boolean) => {
    if (!title.trim()) return toast.error("Title is required");
    if (!slug.trim()) return toast.error("Slug is required");
    try {
      const finalPublished = publishNow !== undefined ? publishNow : published;
      const saved: any = await save.mutateAsync({
        id: isNew ? undefined : id,
        title, slug, excerpt, cover_image_url: coverUrl, content,
        published: finalPublished,
        author_name: displayName || "Admin",
      });
      toast.success(finalPublished ? "Published!" : "Saved as draft");
      if (isNew && saved?.id) navigate(`/admin/blog/${saved.id}`);
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-4 max-w-5xl">
      <Button variant="ghost" size="sm" onClick={() => navigate("/admin/blog")}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to posts
      </Button>

      <Card className="p-6 space-y-4">
        <div>
          <Label>Title</Label>
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Your post title" className="text-lg" />
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label>Slug (URL)</Label>
            <Input value={slug} onChange={e => setSlug(slugify(e.target.value))} />
          </div>
          <div>
            <Label>Cover Image</Label>
            <div className="flex items-center gap-2">
              {coverUrl && <img src={coverUrl} alt="cover" className="h-10 w-10 rounded object-cover" />}
              <label className="cursor-pointer">
                <input type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
                <Button type="button" variant="outline" asChild><span><ImageIcon className="h-4 w-4 mr-1" /> Upload</span></Button>
              </label>
              {coverUrl && <Button type="button" variant="ghost" size="sm" onClick={() => setCoverUrl(null)}>Remove</Button>}
            </div>
          </div>
        </div>
        <div>
          <Label>Excerpt (short description)</Label>
          <Textarea rows={2} value={excerpt} onChange={e => setExcerpt(e.target.value)} placeholder="A short summary shown on the blog listing" />
        </div>
      </Card>

      <Card className="p-2">
        <TiptapEditor content={content} onChange={(json) => setContent(json)} />
      </Card>

      <Card className="p-4 flex items-center justify-between sticky bottom-4">
        <div className="flex items-center gap-2">
          <Switch checked={published} onCheckedChange={setPublished} />
          <Label className="text-sm">Published</Label>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleSave(false)} disabled={save.isPending}>Save Draft</Button>
          <Button onClick={() => handleSave(true)} disabled={save.isPending}>Publish</Button>
        </div>
      </Card>
    </div>
  );
}
