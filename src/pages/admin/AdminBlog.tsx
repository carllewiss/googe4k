import { useState } from "react";
import { Link } from "react-router-dom";
import { useAllPostsAdmin, useDeletePost } from "@/hooks/useBlog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit3, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function AdminBlog() {
  const { data: posts = [], isLoading } = useAllPostsAdmin();
  const del = useDeletePost();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading">Blog Posts</h1>
          <p className="text-sm text-muted-foreground">Create and manage news & articles</p>
        </div>
        <Button asChild><Link to="/admin/blog/new"><Plus className="h-4 w-4 mr-1" /> New Post</Link></Button>
      </div>

      {isLoading ? <p className="text-muted-foreground">Loading...</p> : posts.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">No posts yet. Click "New Post" to write your first article.</Card>
      ) : (
        <div className="grid gap-3">
          {posts.map(p => (
            <Card key={p.id} className="p-4 flex items-center gap-4">
              <div className="w-20 h-20 bg-muted rounded shrink-0 overflow-hidden">
                {p.cover_image_url && <img src={p.cover_image_url} alt={p.title} className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold truncate">{p.title}</h3>
                  <Badge variant={p.published ? "default" : "secondary"}>{p.published ? "Published" : "Draft"}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1 truncate">/{p.slug}</p>
              </div>
              <div className="flex gap-1">
                {p.published && (
                  <Button asChild size="icon" variant="ghost" className="h-8 w-8">
                    <a href={`/shop/blog/${p.slug}`} target="_blank" rel="noopener"><ExternalLink className="h-4 w-4" /></a>
                  </Button>
                )}
                <Button asChild size="icon" variant="ghost" className="h-8 w-8">
                  <Link to={`/admin/blog/${p.id}`}><Edit3 className="h-4 w-4" /></Link>
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4" /></Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete "{p.title}"?</AlertDialogTitle>
                      <AlertDialogDescription>This is permanent.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground"
                        onClick={async () => { await del.mutateAsync(p.id); toast.success("Deleted"); }}
                      >Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
