"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { TerminalDrawer } from "./TerminalDrawer";
import { AuthButton } from "./AuthButton";

type NavItem = {
  label: string;
  href: string;
  match: (pathname: string) => boolean;
};

const NAV_ITEMS: NavItem[] = [
  {
    label: "Detect",
    href: "/",
    match: (p) => p === "/" || p.startsWith("/results"),
  },
  {
    label: "Archive",
    href: "/archive",
    match: (p) => p.startsWith("/archive"),
  },
  {
    label: "Pricing",
    href: "/pricing",
    match: (p) => p.startsWith("/pricing"),
  },
];

export function TopNav() {
  const pathname = usePathname();
  const [terminalOpen, setTerminalOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "`") {
        e.preventDefault();
        setTerminalOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <nav className="bg-neutral-950 border-b border-neutral-800 w-full sticky top-0 z-30">
        <div className="flex justify-between items-center w-full px-8 py-4 max-w-5xl mx-auto">
          <Link
            href="/"
            className="text-xl font-bold tracking-tighter text-amber-500 font-['Space_Grotesk'] uppercase"
          >
            REWORDIFY
          </Link>

          <div className="flex gap-8 items-center">
            {NAV_ITEMS.map((item) => {
              const active = item.match(pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    active
                      ? "font-['Space_Grotesk'] text-sm tracking-tighter uppercase text-amber-500 border-b-2 border-amber-500 pb-1 hover:text-neutral-200 transition-colors duration-200"
                      : "font-['Space_Grotesk'] text-sm tracking-tighter uppercase text-neutral-500 hover:text-neutral-200 transition-colors duration-200"
                  }
                >
                  {item.label}
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-4">
            <AuthButton />
            <button
              onClick={() => setTerminalOpen((v) => !v)}
              aria-label="Toggle terminal"
              title="Open terminal (⌘ + `)"
              className={`flex items-center transition-all duration-200 active:scale-90 ${
                terminalOpen
                  ? "text-neutral-200 rotate-12"
                  : "text-amber-500 hover:text-neutral-200 hover:rotate-12"
              }`}
            >
              <span className="material-symbols-outlined">terminal</span>
            </button>
          </div>
        </div>
      </nav>

      <TerminalDrawer
        open={terminalOpen}
        onClose={() => setTerminalOpen(false)}
      />
    </>
  );
}
