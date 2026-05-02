"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

export function AuthButton() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    const getSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user ?? null);
      } catch (error) {
        console.error("Error getting session:", error);
      } finally {
        setLoading(false);
      }
    };
    
    getSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Auth state changed:", event, session?.user?.email);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const handleSignIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      console.error("Sign in error:", error);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setMenuOpen(false);
    setUser(null);
  };

  if (loading) {
    return (
      <div className="w-8 h-8 rounded-full bg-surface-container-high animate-pulse" />
    );
  }

  if (!user) {
    return (
      <button
        onClick={handleSignIn}
        className="flex items-center gap-2 px-4 py-2 border border-amber-500/50 text-amber-500 font-code-sm text-[12px] uppercase tracking-wider hover:bg-amber-500/10 transition-all active:scale-95"
      >
        <span className="material-symbols-outlined text-[16px]">login</span>
        Sign In
      </button>
    );
  }

  const initial =
    user.user_metadata?.full_name?.[0] || user.email?.[0] || "?";
  const avatarUrl = user.user_metadata?.avatar_url;
  const displayName =
    user.user_metadata?.full_name || user.email?.split("@")[0];

  return (
    <div className="relative">
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="flex items-center gap-3 hover:opacity-80 transition-opacity"
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={displayName}
            className="w-8 h-8 rounded-full border border-amber-500/30"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-amber-500 text-on-primary flex items-center justify-center font-label-caps text-[12px] uppercase">
            {initial}
          </div>
        )}
        <span className="font-code-sm text-[12px] text-on-surface hidden sm:inline">
          {displayName}
        </span>
        <span className="material-symbols-outlined text-[16px] text-neutral-500">
          {menuOpen ? "expand_less" : "expand_more"}
        </span>
      </button>

      {menuOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-48 bg-surface-container-low border border-neutral-800 shadow-xl z-50">
            <div className="px-4 py-3 border-b border-neutral-800">
              <p className="font-code-sm text-[10px] text-neutral-500 uppercase tracking-wider">
                Signed in as
              </p>
              <p className="font-code-sm text-[12px] text-on-surface truncate">
                {user.email}
              </p>
            </div>
            <button
              onClick={handleSignOut}
              className="w-full px-4 py-3 text-left font-code-sm text-[12px] text-error hover:bg-surface-container-high transition-colors flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[16px]">
                logout
              </span>
              Sign Out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
