import { useState, useEffect, createContext, useContext, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

const isAuthNetworkError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message.includes("Failed to fetch") || message.includes("AuthRetryableFetchError");
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Failsafe: if auth doesn't respond within 8s (network/backend down),
    // unblock the UI so users see the auth/error screen instead of an infinite spinner.
    const timeout = setTimeout(() => {
      setLoading((prev) => {
        if (prev) console.warn("[Auth] Timeout reached — unblocking UI");
        return false;
      });
    }, 8000);

    // Set up auth listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      clearTimeout(timeout);
    });

    // Then get initial session
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
      })
      .catch((err) => {
        console.error("[Auth] getSession failed:", err);
        if (isAuthNetworkError(err)) {
          supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
        }
        setSession(null);
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
        clearTimeout(timeout);
      });

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error && isAuthNetworkError(error)) {
      await supabase.auth.signOut({ scope: "local" });
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
