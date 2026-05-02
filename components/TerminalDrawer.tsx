"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Line =
  | { kind: "out"; text: string }
  | { kind: "in"; text: string }
  | { kind: "ascii"; text: string };

const BANNER = `
 ____  _______        _____  ____  ____ ___ _______   __
|  _ \\| ____\\ \\      / / _ \\|  _ \\|  _ \\_ _|  ___\\ \\ / /
| |_) |  _|  \\ \\ /\\ / / | | | |_) | | | | || |_   \\ V /
|  _ <| |___  \\ V  V /| |_| |  _ <| |_| | ||  _|   | |
|_| \\_\\_____|  \\_/\\_/  \\___/|_| \\_\\____/___|_|     |_|
`;

const HELP_LINES = [
  "available commands:",
  "  help        show this message",
  "  whoami      who's at the keyboard",
  "  detect      go to the AI detector",
  "  pricing     view pricing tiers",
  "  results     open the latest analysis",
  "  joke        request entertainment",
  "  coffee      brew a beverage",
  "  matrix      [REDACTED]",
  "  clear       wipe the screen",
  "  exit        close terminal (or press Esc)",
];

const JOKES = [
  "Why did the AI cross the road? To optimize the chicken's path.",
  "I told my essay it was AI-generated. It said 'no u'.",
  "An LLM walks into a bar. The bartender says 'we don't serve your kind here.' The LLM says 'as an AI language model, I respect that.'",
  "What's a detector's favorite snack? Burstiness chips.",
  "There are 10 types of people: those who understand binary, and those who don't.",
];

const COFFEE_ART = `
        )  (
       (   ) )
        ) ( (
      _______)_
   .-'---------|
  ( C|/\\/\\/\\/\\/|
   '-./\\/\\/\\/\\/|
     '_________'
      '-------'
`;

const MATRIX_LINE = () => {
  const chars = "01アイウエオカキクケコサシスセソタチツテト$#@*";
  let s = "";
  for (let i = 0; i < 56; i++) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
};

type DrawerProps = {
  open: boolean;
  onClose: () => void;
};

export function TerminalDrawer({ open, onClose }: DrawerProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState<number>(-1);

  const initialLines: Line[] = useMemo(
    () => [
      { kind: "ascii", text: BANNER },
      { kind: "out", text: "rewordify shell v1.0.4 — type 'help' to begin" },
      { kind: "out", text: "" },
    ],
    [],
  );
  const [lines, setLines] = useState<Line[]>(initialLines);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  function print(text: string, kind: Line["kind"] = "out") {
    setLines((prev) => [...prev, { kind, text }]);
  }

  function clearScreen() {
    setLines(initialLines);
  }

  async function runCommand(raw: string) {
    const cmd = raw.trim();
    print(`$ ${raw}`, "in");
    if (!cmd) return;

    setHistory((h) => [...h, raw]);
    setHistoryIdx(-1);

    const [name, ...rest] = cmd.split(/\s+/);
    const arg = rest.join(" ");

    switch (name.toLowerCase()) {
      case "help":
        HELP_LINES.forEach((l) => print(l));
        break;
      case "whoami":
        print("anonymous_visitor@rewordify.local");
        print("permissions: paste, detect, humanize, vibe");
        break;
      case "detect":
        print("→ routing to /…");
        setTimeout(() => {
          router.push("/");
          onClose();
        }, 300);
        break;
      case "pricing":
        print("→ routing to /pricing…");
        setTimeout(() => {
          router.push("/pricing");
          onClose();
        }, 300);
        break;
      case "results":
        print("→ routing to /results…");
        setTimeout(() => {
          router.push("/results");
          onClose();
        }, 300);
        break;
      case "joke":
        print(JOKES[Math.floor(Math.random() * JOKES.length)]);
        break;
      case "coffee":
        print(COFFEE_ART, "ascii");
        print("☕ brewing… enjoy your humanized beverage.");
        break;
      case "matrix": {
        for (let i = 0; i < 8; i++) {
          print(MATRIX_LINE());
        }
        print("wake up, neo.");
        break;
      }
      case "sudo":
        if (arg.toLowerCase().includes("make me a sandwich")) {
          print("ok.");
        } else {
          print(`sudo: ${arg || "(nothing)"}: permission denied`);
          print("(nice try though)");
        }
        break;
      case "rm":
        if (arg.includes("-rf") && arg.includes("/")) {
          print("…");
          print("just kidding. nothing was deleted. 🙃");
        } else {
          print(`rm: ${arg || "missing operand"}: not happening`);
        }
        break;
      case "ls":
        print("detect/  results/  pricing/  README.md  .secrets");
        break;
      case "cat":
        if (arg === ".secrets") {
          print("you didn't see anything.");
        } else if (arg) {
          print(`cat: ${arg}: nope`);
        } else {
          print("cat: missing argument (try '.secrets' 👀)");
        }
        break;
      case "echo":
        print(arg);
        break;
      case "date":
        print(new Date().toString());
        break;
      case "exit":
      case "quit":
      case "close":
        print("goodbye 👋");
        setTimeout(onClose, 250);
        break;
      case "clear":
      case "cls":
        clearScreen();
        break;
      default:
        print(`command not found: ${name}`);
        print("type 'help' for a list of commands");
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      runCommand(input);
      setInput("");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!history.length) return;
      const next =
        historyIdx === -1 ? history.length - 1 : Math.max(0, historyIdx - 1);
      setHistoryIdx(next);
      setInput(history[next]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIdx === -1) return;
      const next = historyIdx + 1;
      if (next >= history.length) {
        setHistoryIdx(-1);
        setInput("");
      } else {
        setHistoryIdx(next);
        setInput(history[next]);
      }
    } else if (e.key === "l" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      clearScreen();
    }
  }

  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 bg-black/40 z-40 transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />
      <div
        className={`fixed left-0 right-0 bottom-0 z-50 transition-transform duration-300 ease-out ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="mx-auto max-w-5xl bg-surface-container-lowest border-t border-x border-amber-500/40 shadow-[0_-20px_60px_-10px_rgba(255,211,65,0.15)]">
          <div className="flex items-center justify-between px-4 py-2 border-b border-neutral-800 bg-neutral-950">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-500 text-[16px]">
                terminal
              </span>
              <span className="font-code-sm text-[12px] text-outline tracking-widest uppercase">
                rewordify@local — sh
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-code-sm text-[10px] text-neutral-600 hidden sm:inline">
                press Esc to close
              </span>
              <button
                onClick={onClose}
                className="text-neutral-500 hover:text-amber-500 transition-colors leading-none"
                aria-label="Close terminal"
              >
                <span className="material-symbols-outlined text-[18px]">
                  close
                </span>
              </button>
            </div>
          </div>

          <div
            ref={scrollRef}
            onClick={() => inputRef.current?.focus()}
            className="h-[320px] overflow-y-auto p-5 font-code-sm text-[13px] leading-relaxed cursor-text"
          >
            {lines.map((line, i) => {
              if (line.kind === "ascii") {
                return (
                  <pre
                    key={i}
                    className="text-amber-500/80 whitespace-pre font-code-sm text-[11px] leading-tight"
                  >
                    {line.text}
                  </pre>
                );
              }
              if (line.kind === "in") {
                return (
                  <div key={i} className="text-on-surface whitespace-pre-wrap">
                    {line.text}
                  </div>
                );
              }
              return (
                <div
                  key={i}
                  className="text-on-surface-variant whitespace-pre-wrap"
                >
                  {line.text}
                </div>
              );
            })}

            <div className="flex items-center text-on-surface mt-1">
              <span className="text-amber-500 mr-2">$</span>
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                spellCheck={false}
                autoComplete="off"
                className="flex-1 bg-transparent border-none outline-none focus:ring-0 font-code-sm text-[13px] text-on-surface caret-amber-500 p-0"
                placeholder="type a command…"
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
