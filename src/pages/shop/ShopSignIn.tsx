import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShopLayout } from "@/components/shop/ShopLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export default function ShopSignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (user) navigate("/shop/account");
  }, [user, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back!");
    navigate("/shop/account");
  };

  return (
    <ShopLayout>
      <div className="max-w-md mx-auto px-4 py-16">
        <Card className="p-8">
          <h1 className="text-2xl font-bold font-heading mb-1">Sign In</h1>
          <p className="text-sm text-muted-foreground mb-6">Welcome back to 4K Smart Solutions</p>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label>Email</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div>
              <Label>Password</Label>
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full bg-shop-deep text-shop-deep-foreground hover:bg-shop-deep/90" disabled={submitting}>
              {submitting ? "Signing in..." : "Sign In"}
            </Button>
          </form>
          <p className="text-sm text-center mt-4 text-muted-foreground">
            New here? <Link to="/shop/signup" className="text-shop-accent font-medium">Create an account</Link>
          </p>
        </Card>
      </div>
    </ShopLayout>
  );
}
