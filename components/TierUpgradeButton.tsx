"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

type Tier = "pro" | "max";

type PaidTier = "free" | "pro" | "max";

type Props = {
  tier: Tier;
  /** Effective plan from Supabase (after subscription row loaded). */
  currentPlan?: PaidTier;
  /** False while parent is loading `subscriptions` row for logged-in user. */
  subscriptionReady?: boolean;
  className?: string;
  children: React.ReactNode;
};

const maxLinkConfigured =
  typeof process.env.NEXT_PUBLIC_STRIPE_MAX_PAYMENT_LINK === "string" &&
  process.env.NEXT_PUBLIC_STRIPE_MAX_PAYMENT_LINK.length > 0;

export function TierUpgradeButton({
  tier,
  currentPlan = "free",
  subscriptionReady = true,
  className,
  children,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      setLoadingUser(false);
    };
    void init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  const signIn = async () => {
    setError(null);
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (err) setError(err.message);
  };

  const goToCheckout = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/stripe/payment-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Checkout could not start.");
        return;
      }
      if (data.url) window.location.href = data.url;
    } finally {
      setBusy(false);
    }
  };

  const maxDisabled = tier === "max" && !maxLinkConfigured;

  if (loadingUser) {
    return (
      <div
        className={
          className ??
          "w-full py-4 font-label-caps text-label-caps uppercase tracking-[0.2em] bg-surface-container-high animate-pulse rounded-sm"
        }
      />
    );
  }

  if (!user) {
    return (
      <div className="space-y-3 w-full">
        <p className="font-code-sm text-[11px] text-neutral-500 uppercase tracking-wider text-center leading-relaxed">
          Sign in with Google to link your subscription to your account,
          then complete checkout.
        </p>
        <button
          type="button"
          onClick={() => void signIn()}
          className={
            className ??
            "w-full bg-primary py-4 font-label-caps text-label-caps text-on-primary hover:opacity-90 transition-opacity"
          }
        >
          SIGN_IN_TO_UPGRADE
        </button>
        {error && (
          <p className="font-code-sm text-[11px] text-error text-center">{error}</p>
        )}
      </div>
    );
  }

  if (!subscriptionReady) {
    return (
      <div
        className={
          (className ?? "") +
          " opacity-60 pointer-events-none animate-pulse min-h-[52px]"
        }
        aria-hidden
      />
    );
  }

  const isCurrent =
    (tier === "pro" && currentPlan === "pro") ||
    (tier === "max" && currentPlan === "max");
  const proIncludedInMax = tier === "pro" && currentPlan === "max";

  if (isCurrent) {
    return (
      <button
        type="button"
        disabled
        className={
          (className ?? "") + " opacity-70 cursor-not-allowed border-neutral-700"
        }
      >
        YOUR_CURRENT_PLAN
      </button>
    );
  }

  if (proIncludedInMax) {
    return (
      <button
        type="button"
        disabled
        className={
          (className ?? "") + " opacity-60 cursor-not-allowed border-neutral-700"
        }
      >
        INCLUDED_IN_MAX
      </button>
    );
  }

  return (
    <div className="w-full space-y-2">
      <button
        type="button"
        disabled={busy || maxDisabled}
        onClick={() => void goToCheckout()}
        className={
          (className ??
            "w-full bg-primary py-4 font-label-caps text-label-caps text-on-primary hover:opacity-90 transition-opacity") +
          (maxDisabled || busy ? " opacity-50 cursor-not-allowed" : "")
        }
      >
        {busy ? "REDIRECTING…" : children}
      </button>
      {maxDisabled && (
        <p className="font-code-sm text-[10px] text-neutral-600 text-center uppercase tracking-wider">
          Max checkout coming soon
        </p>
      )}
      {error && (
        <p className="font-code-sm text-[11px] text-error text-center">{error}</p>
      )}
    </div>
  );
}
