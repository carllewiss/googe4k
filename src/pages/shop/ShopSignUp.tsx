import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShopLayout } from "@/components/shop/ShopLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function ShopSignUp() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) return toast.error("Password must be at least 6 characters");
    setSubmitting(true);
    const redirectUrl = `${window.location.origin}/shop/account`;
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: redirectUrl, data: { display_name: name } },
    });
    if (error) {
      setSubmitting(false);
      return toast.error(error.message);
    }
    if (data.user) {
      await supabase.from("shop_customers").insert({
        user_id: data.user.id,
        full_name: name,
        phone,
        email,
      });
    }
    setSubmitting(false);
    toast.success("Account created! Check your email if confirmation is required.");
    navigate("/shop/account");
  };

  return (
    <ShopLayout>
      <div className="max-w-md mx-auto px-4 py-16">
        <Card className="p-8">
          <h1 className="text-2xl font-bold font-heading mb-1">Create Account</h1>
          <p className="text-sm text-muted-foreground mb-6">Track orders, save addresses, and check out faster.</p>
          <form onSubmit={submit} className="space-y-4">
            <div><Label>Full Name</Label><Input value={name} onChange={e => setName(e.target.value)} required /></div>
            <div><Label>Phone</Label><Input value={phone} onChange={e => setPhone(e.target.value)} required /></div>
            <div><Label>Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></div>
            <div><Label>Password</Label><Input type="password" value={password} onChange={e => setPassword(e.target.value)} required /></div>
            <Button type="submit" className="w-full bg-shop-deep text-shop-deep-foreground hover:bg-shop-deep/90" disabled={submitting}>
              {submitting ? "Creating..." : "Create Account"}
            </Button>
          </form>
          <p className="text-sm text-center mt-4 text-muted-foreground">
            Already have an account? <Link to="/shop/signin" className="text-shop-accent font-medium">Sign In</Link>
          </p>
        </Card>
      </div>
    </ShopLayout>
  );
}
