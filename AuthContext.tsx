import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  userRole: "admin" | "faculty" | "student" | null;
  loading: boolean;
  error: Error | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<"admin" | "faculty" | "student" | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const getUserRole = async (userId: string) => {
  try {
    // 1. Hardcoded Admin Check for demo safety
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (currentUser?.email === 'admin@earist.edu.ph') return "admin";

    // 2. Optimized Faculty check
    const { data: facultyData, error: facultyError } = await supabase
      .from("faculty")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle(); // maybeSingle avoids throwing errors if not found

    if (facultyError) {
      console.error("Database error during role check:", facultyError);
      return "student";
    }

    return facultyData ? "faculty" : "student";
  } catch (err) {
    console.error("Unexpected error in getUserRole:", err);
    return "student"; // Fail safely to student
  }
};

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUser(session.user);
          const role = await getUserRole(session.user.id);
          setUserRole(role);
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Auth init failed"));
      } finally {
        setLoading(false); // FIXED: Always stop loading
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setLoading(true); // Restart loading during transitions
      if (session?.user) {
        setUser(session.user);
        const role = await getUserRole(session.user.id);
        setUserRole(role);
      } else {
        setUser(null);
        setUserRole(null);
      }
      setLoading(false);
    });

    return () => { subscription?.unsubscribe(); };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      setError(null);
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
    } catch (err) {
      throw err instanceof Error ? err : new Error("Sign in failed");
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setUserRole(null);
    } catch (err) {
      console.error("Sign out failed");
    }
  };

  return (
    <AuthContext.Provider value={{ user, userRole, loading, error, signIn, signOut, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}