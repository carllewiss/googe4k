import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, User, Mail, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const { signIn } = useAuth();
  const [mode, setMode] = useState<"signin" | "forgot" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await signIn(email, password);
    if (error) setError(error);
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setError("");
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: email.split("@")[0] || "Admin" },
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    if (data?.user) {
      // Assign role admin in user_roles
      try {
        await supabase.from("user_roles").upsert(
          { user_id: data.user.id, role: "admin" },
          { onConflict: "user_id" }
        );
      } catch {
        // ignore if table not yet seeded
      }
      toast.success("Account registered! Signing you in...");
      await signIn(email, password);
    }
    setLoading(false);
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Enter your email address");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setResetSent(true);
    toast.success("Password reset email sent");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-2">
            <Lock className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-heading">4K SMART SOLUTIONS</CardTitle>
          <p className="text-sm text-muted-foreground">
            {mode === "signin"
              ? "Sign in to your ERP account"
              : mode === "signup"
              ? "Register first administrator account"
              : "Reset your password"}
          </p>
        </CardHeader>
        <CardContent>
          {mode === "signin" ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@4ksmart.co.ke"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9"
                    required
                  />
                </div>
              </div>
              <div className="flex justify-between items-center text-xs">
                <button
                  type="button"
                  onClick={() => { setMode("signup"); setError(""); }}
                  className="text-primary hover:underline font-medium"
                >
                  Create Admin Account
                </button>
                <button
                  type="button"
                  onClick={() => { setMode("forgot"); setError(""); setResetSent(false); }}
                  className="text-muted-foreground hover:text-foreground hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              {error && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 text-sm text-destructive">
                  {error}
                </div>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          ) : mode === "signup" ? (
            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signup-email">Admin Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="admin@4ksmart.co.ke"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password">Password (min 6 characters)</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9"
                    required
                  />
                </div>
              </div>
              {error && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 text-sm text-destructive">
                  {error}
                </div>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Creating Account..." : "Create Account & Sign In"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => { setMode("signin"); setError(""); }}
              >
                <ArrowLeft className="h-4 w-4 mr-1" /> Back to Sign In
              </Button>
            </form>
          ) : resetSent ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto w-12 h-12 bg-success/10 rounded-full flex items-center justify-center">
                <Mail className="h-6 w-6 text-success" />
              </div>
              <p className="text-sm text-muted-foreground">
                If an account exists for <span className="font-medium text-foreground">{email}</span>, a
                password reset link has been sent. Check your inbox and follow the link to set a new password.
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => { setMode("signin"); setResetSent(false); }}
              >
                <ArrowLeft className="h-4 w-4 mr-1" /> Back to Sign In
              </Button>
            </div>
          ) : (
            <form onSubmit={handleForgot} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Enter your registered email and we'll send you a link to reset your password.
              </p>
              <div className="space-y-2">
                <Label htmlFor="forgot-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="forgot-email"
                    type="email"
                    placeholder="you@4ksmart.co.ke"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9"
                    required
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Sending..." : "Send Reset Link"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => { setMode("signin"); setError(""); }}
              >
                <ArrowLeft className="h-4 w-4 mr-1" /> Back to Sign In
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <div className="mt-6 text-center">
        <a
          href="/shop"
          className="text-xs text-muted-foreground hover:text-primary transition-colors underline inline-flex items-center gap-1"
        >
          <span>Open 4K Smart Customer Online Storefront</span> &rarr;
        </a>
      </div>
    </div>
  );
}
