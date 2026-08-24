import { useEffect, type RefObject } from "react";
import { X } from "lucide-react";
import { VISUAL_LENS_COPY, type VisualLens } from "@/lib/portfolioVisuals";

/**
 * "How to read the field" legend.
 *
 * Opens to the LEFT of the consolidated icon cluster (never over the icons or
 * the header bar). When it mounts, any open kitty detail card is closed via
 * onOpen so the two panels can't overlap. The mover-ring entry is documented
 * but currently stubbed behind MOVER_RING_ENABLED in Home — see that flag's
 * investigation note before relying on it.
 */
export default function PortfolioLegend({ darkMode, onClose, onOpen, visualLens, panelRef }: { darkMode: boolean; onClose: () => void; onOpen?: () => void; visualLens: VisualLens; panelRef?: RefObject<HTMLElement | null> }) {
  const copy = VISUAL_LENS_COPY[visualLens];
  const panel = darkMode ? "border-[#49636a] bg-[#142022] text-stone-100" : "border-stone-300 bg-[#fcfcfb] text-stone-800";
  const muted = darkMode ? "text-stone-300" : "text-stone-700";

  useEffect(() => {
    // Auto-close any open detail card so the two panels never stack/overlap.
    onOpen?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <aside ref={panelRef} role="dialog" aria-modal="false" aria-labelledby="portfolio-legend-title" className={`fixed top-[7.0625rem] z-50 w-[min(300px,calc(100vw-24px))] rounded-xl border p-4 shadow-[0_18px_46px_-28px_rgba(41,37,36,.55)] ${panel}`} style={{ right: "calc(3rem + 54px + 12px)" }}>
      <div className="flex items-center justify-between gap-3">
        <h2 id="portfolio-legend-title" className="font-serif text-base">How to read the field</h2>
        <button type="button" onClick={onClose} aria-label="Close portfolio legend" className="grid min-h-11 min-w-11 place-items-center rounded-full"><X size={16} /></button>
      </div>
      <ul className={`mt-2 space-y-2 font-mono text-[10px] ${muted}`}>
        <li className="font-semibold text-current">Active lens · {copy.label}</li>
        <li>{copy.size}</li>
        <li>{copy.color}</li>
        <li>{copy.emphasis}</li>
        <li className="flex items-center gap-3"><span aria-hidden="true" className="ml-3 grid h-4 w-4 place-items-center rounded-full border border-stone-900 bg-white text-[9px] font-bold text-stone-900">±</span><span>plus/minus badge · profit/loss without relying on colour</span></li>
        <li className="flex items-center gap-3"><span aria-hidden="true" className="ml-3 h-4 w-4 rounded-full border-2 border-stone-900 bg-[#D8AE37]" /><span>330+ day loss · tax-loss eligible</span></li>
        <li className="flex items-center gap-3"><span aria-hidden="true" className="ml-3 h-5 w-5 rounded-full border-2 border-dashed border-[#7c3aed] opacity-80" /><span>mover ring · daily movement of at least 2%</span></li>
      </ul>
    </aside>
  );
}
