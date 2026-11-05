import { useParams, Link } from "react-router-dom";
import { ShopLayout } from "@/components/shop/ShopLayout";
import { usePostBySlug } from "@/hooks/useBlog";
import { ChevronLeft } from "lucide-react";
import { TiptapView } from "@/components/blog/TiptapView";
import { AdSlot } from "@/components/shop/AdSlot";

/** Split a Tiptap doc roughly in half so an ad can render between paragraphs */
function splitDoc(content: any): [any, any | null] {
  const nodes = content?.content;
  if (!Array.isArray(nodes) || nodes.length < 4) return [content, null];
  const mid = Math.ceil(nodes.length / 2);
  return [
    { ...content, content: nodes.slice(0, mid) },
    { ...content, content: nodes.slice(mid) },
  ];
}

export default function ShopBlogPost() {
  const { slug } = useParams();
  const { data: post, isLoading } = usePostBySlug(slug);

  if (isLoading) return <ShopLayout><div className="py-20 text-center">Loading...</div></ShopLayout>;
  if (!post) return <ShopLayout><div className="py-20 text-center">Post not found.</div></ShopLayout>;

  const [firstHalf, secondHalf] = splitDoc(post.content);

  return (
    <ShopLayout>
      <div className="max-w-6xl mx-auto px-4 py-10 grid lg:grid-cols-[1fr_300px] gap-10">
        <article className="min-w-0">
          <Link to="/shop/blog" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6">
            <ChevronLeft className="h-4 w-4" /> Back to Blog
          </Link>

          <p className="text-sm text-muted-foreground mb-2">
            {post.published_at && new Date(post.published_at).toLocaleDateString()} {post.author_name && `· by ${post.author_name}`}
          </p>
          <h1 className="text-3xl md:text-5xl font-bold font-heading mb-6">{post.title}</h1>

          {post.cover_image_url && (
            <img src={post.cover_image_url} alt={post.title} className="w-full rounded-xl mb-8 aspect-video object-cover" />
          )}

          <TiptapView content={firstHalf} />

          {/* Auto-sizing in-article ad between paragraphs */}
          {secondHalf && (
            <>
              <AdSlot placement="article" className="my-8" />
              <TiptapView content={secondHalf} />
            </>
          )}

          {/* Footer ad below the article */}
          <AdSlot placement="footer" className="mt-10" />
        </article>

        {/* Sidebar ad (sticky on large screens) */}
        <aside className="hidden lg:block">
          <div className="sticky top-28">
            <AdSlot placement="sidebar" />
          </div>
        </aside>
      </div>
    </ShopLayout>
  );
}
