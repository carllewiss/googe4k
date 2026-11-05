import { Link } from "react-router-dom";
import { ShopLayout } from "@/components/shop/ShopLayout";
import { usePublishedPosts } from "@/hooks/useBlog";

export default function ShopBlog() {
  const { data: posts = [], isLoading } = usePublishedPosts();

  return (
    <ShopLayout>
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold font-heading">Blog & News</h1>
          <p className="text-muted-foreground">Insights, updates and tips from 4K Smart Solutions</p>
        </div>

        {isLoading ? (
          <div className="text-center text-muted-foreground py-12">Loading posts...</div>
        ) : posts.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">No posts published yet.</div>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            {posts.map((p) => (
              <Link key={p.id} to={`/shop/blog/${p.slug}`} className="group block">
                <div className="aspect-video bg-shop-soft rounded-lg overflow-hidden mb-3">
                  {p.cover_image_url && (
                    <img src={p.cover_image_url} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground mb-1">
                  {p.published_at && new Date(p.published_at).toLocaleDateString()} {p.author_name && `· by ${p.author_name}`}
                </p>
                <h2 className="font-bold text-lg group-hover:text-shop-accent">{p.title}</h2>
                {p.excerpt && <p className="text-sm text-muted-foreground line-clamp-3 mt-1">{p.excerpt}</p>}
              </Link>
            ))}
          </div>
        )}
      </div>
    </ShopLayout>
  );
}
