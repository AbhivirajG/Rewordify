"use client";

import { useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  /** App path after OAuth (e.g. `/` or `/results?id=…`). Passed as auth `next`. */
  returnTo?: string;
  /** Run before redirecting to Google (e.g. stash draft text). */
  onBeforeOAuth?: () => void;
};

export function SignInForResultsModal({
  open,
  onClose,
  title = "Sign in to view your report",
  description = "Create a free account with Google to unlock your detection results and keep them linked to your profile.",
  returnTo = "/",
  onBeforeOAuth,
}: Props) {
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function signIn() {
    onBeforeOAuth?.();
    const next = returnTo.startsWith("/") ? returnTo : `/${returnTo}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) console.error(error);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="signin-results-title"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-black/75 backdrop-blur-sm border-0 cursor-default"
        aria-label="Close dialog"
      />

      <div className="relative w-full max-w-md bg-surface-container-lowest border border-amber-500/40 shadow-[0_20px_60px_-10px_rgba(255,211,65,0.2)] p-8">
        <div className="flex items-center gap-2 mb-4">
          <span className="material-symbols-outlined text-amber-500 text-[18px]">
            lock
          </span>
          <span className="font-label-caps text-[10px] text-amber-500 uppercase tracking-widest">
            Account required
          </span>
        </div>

        <h2
          id="signin-results-title"
          className="font-headline-md text-headline-md text-on-surface mb-4 leading-tight"
        >
          {title}
        </h2>

        <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed mb-8">
          {description}
        </p>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-3 border border-neutral-700 text-outline hover:text-on-surface hover:border-neutral-500 transition-colors font-label-caps text-label-caps uppercase tracking-widest"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={() => void signIn()}
            className="px-5 py-3 bg-primary text-on-primary hover:opacity-90 transition-all active:scale-95 font-label-caps text-label-caps uppercase tracking-widest flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">login</span>
            Continue with Google
          </button>
        </div>
      </div>
    </div>
  );
}
