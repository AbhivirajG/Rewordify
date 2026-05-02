"use client";

import { useEffect } from "react";

type HumanizeBetaModalProps = {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function HumanizeBetaModal({
  open,
  onConfirm,
  onCancel,
}: HumanizeBetaModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="humanize-beta-title"
    >
      <div
        onClick={onCancel}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />

      <div className="relative w-full max-w-md bg-surface-container-lowest border border-amber-500/40 shadow-[0_20px_60px_-10px_rgba(255,211,65,0.2)] p-8">
        <div className="flex items-center gap-2 mb-4">
          <span className="material-symbols-outlined text-amber-500 text-[16px]">
            science
          </span>
          <span className="font-label-caps text-[10px] text-amber-500 uppercase tracking-widest">
            BETA &nbsp;·&nbsp; HEADS UP
          </span>
        </div>

        <h2
          id="humanize-beta-title"
          className="font-headline-md text-headline-md text-on-surface mb-4 leading-tight"
        >
          This rewrites the entire document
        </h2>

        <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed mb-8">
          Humanize Text runs your full essay through our 2-pass Claude
          pipeline — paraphrase, then style-inject. Results are good but
          still being tuned. Want surgical edits instead? Hover any flagged
          sentence and use{" "}
          <span className="text-primary">&quot;Humanize this&quot;</span>.
        </p>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-5 py-3 border border-neutral-700 text-outline hover:text-on-surface hover:border-neutral-500 transition-colors font-label-caps text-label-caps uppercase tracking-widest"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-5 py-3 bg-primary text-on-primary hover:opacity-90 transition-all active:scale-95 font-label-caps text-label-caps uppercase tracking-widest flex items-center justify-center gap-2"
          >
            <span
              className="material-symbols-outlined text-[16px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              auto_fix_high
            </span>
            Rewrite the whole thing
          </button>
        </div>

        <button
          onClick={onCancel}
          aria-label="Close"
          className="absolute top-3 right-3 text-neutral-500 hover:text-amber-500 transition-colors leading-none"
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>
    </div>
  );
}
