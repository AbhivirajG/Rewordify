"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { TierUpgradeButton } from "@/components/TierUpgradeButton";

type PaidTier = "free" | "pro" | "max";

type SubscriptionRow = {
  tier: PaidTier;
  status: string;
  current_period_end: string | null;
};

function displayPlan(row: SubscriptionRow | null): PaidTier {
  if (!row) return "free";
  if (row.status === "active" || row.status === "trialing") {
    if (row.tier === "max") return "max";
    if (row.tier === "pro") return "pro";
  }
  return "free";
}

function formatRenewal(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function PricingPlansSection() {
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [row, setRow] = useState<SubscriptionRow | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSubscription = useCallback(
    async (uid: string) => {
      const { data } = await supabase
        .from("subscriptions")
        .select("tier, status, current_period_end")
        .eq("user_id", uid)
        .maybeSingle();
      if (!data) {
        setRow(null);
        return;
      }
      setRow({
        tier: (data.tier as PaidTier) ?? "free",
        status: String(data.status ?? ""),
        current_period_end:
          typeof data.current_period_end === "string"
            ? data.current_period_end
            : null,
      });
    },
    [supabase],
  );

  useEffect(() => {
    let cancelled = false;

    const sync = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const u = session?.user ?? null;
      if (cancelled) return;
      setUser(u);
      if (u) await loadSubscription(u.id);
      else setRow(null);
      if (!cancelled) setLoading(false);
    };

    void sync();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        setLoading(true);
        await loadSubscription(u.id);
        setLoading(false);
      } else {
        setRow(null);
      }
    });

    const onFocus = () => {
      void sync();
    };
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      window.removeEventListener("focus", onFocus);
    };
  }, [supabase, loadSubscription]);

  const currentPlan = displayPlan(row);
  const renewalLabel = formatRenewal(row?.current_period_end ?? null);

  return (
    <>
      {user && !loading && (
        <div className="mb-8 p-4 border border-neutral-800 bg-surface-container-low/80 font-code-sm text-[12px] text-on-surface-variant">
          <span className="text-amber-500/80 uppercase tracking-widest text-[10px]">
            account / status
          </span>
          <p className="mt-2 text-on-surface">
            <span className="text-outline">Current plan:</span>{" "}
            <span className="text-primary font-label-caps uppercase tracking-wider">
              {currentPlan === "free" ? "Free" : currentPlan === "pro" ? "Pro" : "Max"}
            </span>
            {renewalLabel && currentPlan !== "free" && row && (
              <span className="text-neutral-500">
                {" "}
                · Renews {renewalLabel}
              </span>
            )}
          </p>
          {row && currentPlan !== "free" && (
            <p className="mt-1 text-[11px] text-neutral-600 uppercase tracking-wide">
              Stripe status: {row.status}
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-24">
        <div
          className={`terminal-box p-8 flex flex-col transition-all duration-300 ${
            user && currentPlan === "free"
              ? "ring-1 ring-amber-500/40 border-amber-500/20"
              : ""
          }`}
        >
          <div className="mb-8 flex items-start justify-between gap-2">
            <div>
              <h3 className="font-label-caps text-label-caps text-outline mb-2">
                TIER_01
              </h3>
              <h2 className="font-headline-md text-headline-md text-on-surface">
                Free
              </h2>
            </div>
            {user && currentPlan === "free" && (
              <span className="shrink-0 font-label-caps text-[9px] px-2 py-0.5 border border-primary/50 text-primary uppercase tracking-widest">
                Current
              </span>
            )}
          </div>
          <div className="mb-8">
            <span className="font-headline-lg text-headline-lg text-primary">
              $0
            </span>
            <span className="font-code-sm text-code-sm text-outline">/mo</span>
          </div>
          <ul className="flex-grow space-y-4 mb-12">
            <li className="flex items-start gap-3">
              <span className="material-symbols-outlined text-primary text-sm mt-1">
                check_circle
              </span>
              <span className="font-body-md text-body-md text-on-surface-variant">
                1 free essay
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="material-symbols-outlined text-primary text-sm mt-1">
                check_circle
              </span>
              <span className="font-body-md text-body-md text-on-surface-variant">
                Standard AI detection
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="material-symbols-outlined text-outline-variant text-sm mt-1">
                block
              </span>
              <span className="font-body-md text-body-md text-outline">
                No API access
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="material-symbols-outlined text-outline-variant text-sm mt-1">
                block
              </span>
              <span className="font-body-md text-body-md text-outline">
                Basic metrics
              </span>
            </li>
          </ul>
          <Link
            href="/"
            className="block text-center w-full border border-outline-variant py-4 font-label-caps text-label-caps text-on-surface hover:bg-surface-container-high transition-colors"
          >
            INITIALIZE_FREE
          </Link>
        </div>

        <div
          className={`terminal-box p-8 flex flex-col border-primary bg-surface-container-low transition-all duration-300 relative overflow-hidden ${
            user && currentPlan === "pro"
              ? "ring-2 ring-primary/60"
              : ""
          }`}
        >
          <div className="absolute top-0 right-0 bg-primary text-on-primary px-3 py-1 font-label-caps text-[10px]">
            RECOMMENDED
          </div>
          <div className="mb-8 mt-6 flex items-start justify-between gap-2">
            <div>
              <h3 className="font-label-caps text-label-caps text-primary mb-2">
                TIER_02
              </h3>
              <h2 className="font-headline-md text-headline-md text-on-surface">
                Pro
              </h2>
            </div>
            {user && currentPlan === "pro" && (
              <span className="shrink-0 font-label-caps text-[9px] px-2 py-0.5 bg-primary/15 text-primary border border-primary/40 uppercase tracking-widest">
                Current
              </span>
            )}
          </div>
          <div className="mb-8">
            <span className="font-headline-lg text-headline-lg text-primary">
              $4.99
            </span>
            <span className="font-code-sm text-code-sm text-outline">/mo</span>
          </div>
          <ul className="flex-grow space-y-4 mb-12">
            <li className="flex items-start gap-3">
              <span className="material-symbols-outlined text-primary text-sm mt-1">
                check_circle
              </span>
              <span className="font-body-md text-body-md text-on-surface-variant">
                Unlimited essays
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="material-symbols-outlined text-primary text-sm mt-1">
                check_circle
              </span>
              <span className="font-body-md text-body-md text-on-surface-variant">
                Detailed metrics (Heatmaps)
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="material-symbols-outlined text-primary text-sm mt-1">
                check_circle
              </span>
              <span className="font-body-md text-body-md text-on-surface-variant">
                Standard API access
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="material-symbols-outlined text-primary text-sm mt-1">
                check_circle
              </span>
              <span className="font-body-md text-body-md text-on-surface-variant">
                Email support
              </span>
            </li>
          </ul>
          <TierUpgradeButton
            tier="pro"
            currentPlan={currentPlan}
            subscriptionReady={!user || !loading}
            className="w-full bg-primary py-4 font-label-caps text-label-caps text-on-primary hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            UPGRADE_PRO
          </TierUpgradeButton>
        </div>

        <div
          className={`terminal-box p-8 flex flex-col transition-all duration-300 ${
            user && currentPlan === "max" ? "ring-1 ring-primary/50" : ""
          }`}
        >
          <div className="mb-8 flex items-start justify-between gap-2">
            <div>
              <h3 className="font-label-caps text-label-caps text-outline mb-2">
                TIER_03
              </h3>
              <h2 className="font-headline-md text-headline-md text-on-surface">
                Max
              </h2>
            </div>
            {user && currentPlan === "max" && (
              <span className="shrink-0 font-label-caps text-[9px] px-2 py-0.5 border border-primary/50 text-primary uppercase tracking-widest">
                Current
              </span>
            )}
          </div>
          <div className="mb-8">
            <span className="font-headline-lg text-headline-lg text-primary">
              $9.99
            </span>
            <span className="font-code-sm text-code-sm text-outline">/mo</span>
          </div>
          <ul className="flex-grow space-y-4 mb-12">
            <li className="flex items-start gap-3">
              <span className="material-symbols-outlined text-primary text-sm mt-1">
                check_circle
              </span>
              <span className="font-body-md text-body-md text-on-surface-variant">
                Everything in Pro
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="material-symbols-outlined text-primary text-sm mt-1">
                check_circle
              </span>
              <span className="font-body-md text-body-md text-on-surface-variant">
                Priority humanizer queue
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="material-symbols-outlined text-primary text-sm mt-1">
                check_circle
              </span>
              <span className="font-body-md text-body-md text-on-surface-variant">
                Bulk document processing
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="material-symbols-outlined text-primary text-sm mt-1">
                check_circle
              </span>
              <span className="font-body-md text-body-md text-on-surface-variant">
                Early access to new models
              </span>
            </li>
          </ul>
          <TierUpgradeButton
            tier="max"
            currentPlan={currentPlan}
            subscriptionReady={!user || !loading}
            className="w-full border border-primary py-4 font-label-caps text-label-caps text-primary hover:bg-primary/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            UPGRADE_MAX
          </TierUpgradeButton>
        </div>
      </div>
    </>
  );
}
