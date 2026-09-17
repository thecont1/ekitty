import { useCallback, useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";
import PortfolioKittySvg from "./PortfolioKittySvg";
import { getPortfolioOverlayTheme } from "@/lib/portfolioOverlayTheme";
import { MrBunglesClientError, requestMrBungles } from "@/lib/mrBunglesClient";
import type { MrBunglesDigest, MrBunglesReply } from "@shared/mrBungles";
import type { PortfolioView } from "@/lib/portfolioCostumes";

type MrBunglesProps = {
  digest: MrBunglesDigest | null;
  viewMode: PortfolioView;
  darkMode: boolean;
  frozen: boolean;
  onShowMe: (targetId: string) => void;
  onSpeak: () => void;
};

function MrBunglesGlass({ darkMode }: { darkMode: boolean }) {
  const glassId = `mr-bungles-glass-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <PortfolioKittySvg stroke={darkMode ? "#b4d0d5" : "#54717a"} fill={`url(#${glassId})`} fillOpacity={0.65} strokeWidth={2.3} className="mr-bungles-glass">
      <defs><linearGradient id={glassId} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={darkMode ? "#d8eff2" : "#eef8f9"} stopOpacity=".8" /><stop offset=".45" stopColor="#9cbcc2" stopOpacity=".18" /><stop offset="1" stopColor="#7d9da5" stopOpacity=".55" /></linearGradient></defs>
      <g fill="none" stroke={darkMode ? "#d8eff2" : "#668d98"} strokeWidth="1.4" opacity=".7"><path d="M63 80l22 12 32-16M62 136l19 17m35-18l13 12" /><path className="mr-bungles-glint" d="M57 61q1-15 13-20m-7 90l-3 15" strokeWidth="3" /></g>
      <g fill="#c78ca1" opacity=".7"><circle cx="86" cy="42" r="3" /><circle cx="94" cy="40" r="2.5" /><circle cx="101" cy="42" r="2" /></g>
    </PortfolioKittySvg>
  );
}

export default function MrBungles({ digest, viewMode, darkMode, frozen, onShowMe, onSpeak }: MrBunglesProps) {
  const theme = getPortfolioOverlayTheme(darkMode);
  const [reply, setReply] = useState<MrBunglesReply | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ignored, setIgnored] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const pendingAbort = useRef<AbortController | null>(null);
  const pendingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);
  const noun = viewMode === "holdings" ? "holding" : "purchase";
  const displayed = busy || reply !== null || error !== null;
  const noDirectives = !digest || digest.directives.length === 0;
  const empty = !digest || digest.targets.length === 0;
  const target = reply && digest ? digest.targets.find(t => t.id === reply.targetId) : undefined;

  const dismiss = useCallback((restoreFocus = true) => {
    pendingAbort.current?.abort();
    pendingAbort.current = null;
    if (pendingTimeout.current) {
      clearTimeout(pendingTimeout.current);
      pendingTimeout.current = null;
    }
    setBusy(false);
    setReply(null);
    setError(null);
    if (restoreFocus) triggerRef.current?.focus({ preventScroll: true });
  }, []);

  const armIdleTimer = useCallback(() => {
    if (idleTimeout.current) clearTimeout(idleTimeout.current);
    idleTimeout.current = setTimeout(() => setIgnored(true), 25_000);
  }, []);

  useEffect(() => {
    mounted.current = true;
    armIdleTimer();
    return () => {
      mounted.current = false;
      if (idleTimeout.current) clearTimeout(idleTimeout.current);
      if (pendingTimeout.current) clearTimeout(pendingTimeout.current);
      pendingAbort.current?.abort();
    };
  }, [armIdleTimer]);

  useEffect(() => {
    if (!displayed) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      dismiss(true);
    };
    const onPointer = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) dismiss(false);
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("pointerdown", onPointer, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("pointerdown", onPointer, true);
    };
  }, [displayed, dismiss]);

  const handleClick = () => {
    if (pendingAbort.current) return;
    setIgnored(false);
    armIdleTimer();
    if (!digest) {
      setReply(null);
      setError("This portfolio cannot form a valid Mr. Bungles digest.");
      return;
    }
    if (!digest.directives.length) {
      setReply(null);
      setError("No visible kitty to point to.");
      return;
    }
    onSpeak();
    const controller = new AbortController();
    pendingAbort.current = controller;
    setBusy(true);
    setError(null);
    setReply(null);
    pendingTimeout.current = setTimeout(() => {
      if (pendingAbort.current !== controller) return;
      controller.abort();
      if (mounted.current) setError("Mr. Bungles took too long. Try again.");
    }, 25_000);
    requestMrBungles(digest, controller.signal)
      .then(result => {
        if (!controller.signal.aborted && mounted.current) setReply(result);
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted || (caught instanceof DOMException && caught.name === "AbortError")) return;
        if (!mounted.current) return;
        setError(caught instanceof MrBunglesClientError ? caught.message : "Mr. Bungles cannot reach its provider. The field still works.");
      })
      .finally(() => {
        if (pendingAbort.current !== controller) return;
        pendingAbort.current = null;
        if (pendingTimeout.current) {
          clearTimeout(pendingTimeout.current);
          pendingTimeout.current = null;
        }
        if (mounted.current) setBusy(false);
      });
  };

  return (
    <div ref={rootRef} className="mr-bungles" data-frozen={frozen} data-ignored={ignored && !frozen} data-empty={empty}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Mr. Bungles, the Glass Kitty. Point to one ${noun}. Sends a small portfolio digest to the configured AI provider.`}
        aria-disabled={busy || noDirectives}
        aria-expanded={displayed}
        aria-controls="mr-bungles-utterance"
        title="Mr. Bungles, the Glass Kitty — sends a small portfolio digest to the configured AI provider."
        onPointerDown={(event) => event.stopPropagation()}
        onClick={handleClick}
        className="grid h-[68px] w-12 place-items-center content-center gap-0.5 rounded-lg outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8AE37]"
      >
        <span aria-hidden="true" className="block h-[52px] w-11"><MrBunglesGlass darkMode={darkMode} /></span>
        <span aria-hidden="true" className={`font-mono text-[8px] leading-tight tracking-[.04em] ${darkMode ? "text-stone-400" : "text-stone-500"}`}>Mr. Bungles</span>
      </button>
      <aside id="mr-bungles-utterance" hidden={!displayed} className={`absolute bottom-0 right-16 max-h-[min(60dvh,420px)] w-[min(336px,calc(100vw-90px))] overflow-auto rounded-lg border p-3 backdrop-blur ${theme.panel}`}>
        <div className="flex items-start justify-between gap-2">
          <p className={`min-w-0 break-words font-mono text-[10px] uppercase tracking-[.14em] ${theme.muted}`}>Mr. Bungles · {noun}{target?.purchaseDate ? ` · ${target.purchaseDate}` : ""}</p>
          <button type="button" aria-label="Dismiss Mr. Bungles" onClick={() => dismiss(true)} className={`grid min-h-11 min-w-11 shrink-0 place-items-center rounded-full transition ${theme.closeButton}`}><X size={14} /></button>
        </div>
        <div>
          {busy && <p className={`font-mono text-[11px] ${theme.muted}`}>Mr. Bungles is looking.</p>}
          {!busy && error && <p className={`break-words font-mono text-[11px] leading-4 ${theme.value}`}>{error}</p>}
          {!busy && reply && <p className={`min-w-0 break-words font-serif text-base leading-[1.45] ${theme.title}`}>{reply.utterance}</p>}
        </div>
        {!busy && reply && target && (
          <button type="button" aria-label={`Show the ${noun} kitty Mr. Bungles named`} className={`mt-2 min-h-11 rounded-md px-3 font-mono text-[10px] font-semibold tracking-[.08em] transition ${theme.closeButton}`} onClick={() => { const targetId = reply.targetId; dismiss(false); onShowMe(targetId); }}>Show me</button>
        )}
      </aside>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{busy ? "Mr. Bungles is looking." : error ?? reply?.utterance ?? ""}</div>
    </div>
  );
}
