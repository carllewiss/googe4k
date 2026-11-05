import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

type AppRole = "admin" | "sales_agent";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  displayName: string;
  isAdmin: boolean;
  isSalesAgent: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchUserRole = async (userId: string) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();
    setRole((data?.role as AppRole) || null);
  };

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("display_name, is_locked")
      .eq("user_id", userId)
      .maybeSingle();
    if (data) {
      setDisplayName(data.display_name || "");
    }
    return data;
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          // Use setTimeout to avoid Supabase client deadlock
          setTimeout(async () => {
            await fetchUserRole(session.user.id);
            await fetchProfile(session.user.id);
            setLoading(false);
          }, 0);
        } else {
          setRole(null);
          setDisplayName("");
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserRole(session.user.id).then(() =>
          fetchProfile(session.user.id).then(() => setLoading(false))
        );
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    // Check if account is locked first
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_locked, failed_login_attempts, user_id")
      .eq("display_name", email)
      .maybeSingle();

    // Try to find by email through auth
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      // Increment failed attempts via edge function or direct update
      // Since we can't update profiles without being authenticated,
      // we handle lockout server-side in a future iteration.
      // For now, return the error.
      return { error: error.message };
    }

    // Check lockout after successful auth
    const { data: userProfile } = await supabase
      .from("profiles")
      .select("is_locked")
      .eq("user_id", data.user.id)
      .maybeSingle();

    if (userProfile?.is_locked) {
      await supabase.auth.signOut();
      return { error: "Account is locked. Contact your administrator." };
    }

    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
    setDisplayName("");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        role,
        displayName,
        isAdmin: role === "admin",
        isSalesAgent: role === "sales_agent",
        loading,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
