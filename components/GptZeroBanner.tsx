"use client";

import { useState } from "react";

type GptZeroBannerProps = {
  humanizedText: string;
  aiPercent: number;
  onDismiss: () => void;
};

export function GptZeroBanner({
  humanizedText,
  aiPercent,
  onDismiss,
}: GptZeroBannerProps) {
  const [copied, setCopied] = useState(false);

  const stillHigh = aiPercent >= 50;
  const message = stillHigh
    ? `Still spicy at ${aiPercent}%? Our detector is built different — it's stricter than your worst professor on purpose. Drop this into GPTZero and watch it wave you through.`
    : `Down to ${aiPercent}%. Our detector is unimpressed by everything, but GPTZero will absolutely call this human. Go check.`;

  async function handleTest() {
    try {
      await navigator.clipboard.writeText(humanizedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("Clipboard write failed", e);
    }
    window.open("https://gptzero.me/", "_blank", "noopener,noreferrer");
  }

  return (
    <div className="mb-6 border border-amber-500/30 bg-amber-500/[0.04] p-5 flex flex-col sm:flex-row sm:items-center gap-4 relative">
      <span
        className="material-symbols-outlined text-amber-500 text-[22px] shrink-0"
        style={{ fontVariationSettings: "'FILL' 1" }}
      >
        auto_awesome
      </span>

      <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed flex-1 pr-6">
        {message}
      </p>

      <button
        onClick={handleTest}
        className="shrink-0 px-4 py-2.5 bg-amber-500/10 border border-amber-500/50 text-amber-400 hover:bg-amber-500/20 hover:border-amber-500 transition-colors font-label-caps text-[11px] uppercase tracking-widest flex items-center gap-2"
      >
        {copied ? (
          <>
            <span className="material-symbols-outlined text-[14px]">check</span>
            Copied — paste it in!
          </>
        ) : (
          <>
            Test on GPTZero
            <span className="material-symbols-outlined text-[14px]">
              arrow_outward
            </span>
          </>
        )}
      </button>

      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className="absolute top-2 right-2 text-neutral-600 hover:text-amber-500 transition-colors leading-none"
      >
        <span className="material-symbols-outlined text-[16px]">close</span>
      </button>
    </div>
  );
}
