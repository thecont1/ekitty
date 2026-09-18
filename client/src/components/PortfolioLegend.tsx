import { type RefObject } from "react";
import { X } from "lucide-react";
import { VISUAL_LENS_COPY, type VisualLens } from "@/lib/portfolioVisuals";
import { COSTUME_LEGEND, COSTUME_ORDER, type PortfolioView } from "@/lib/portfolioCostumes";
import { DEFAULT_MARKET_PROFILE, taxReviewDescription, type MarketProfile } from "@shared/marketProfiles";
import PortfolioKittySvg from "./PortfolioKittySvg";

/**
 * "How to read the field" legend.
 *
 * Opens to the LEFT of the consolidated icon cluster (never over the icons or
 * the header bar). The parent closes any open kitty detail card before opening
 * this panel so the two overlays never render together. The mover-ring entry
 * follows the same feature gate as CatGlyph — see the investigation note.
 */
export default function PortfolioLegend({ darkMode, onClose, visualLens, moverRingEnabled, panelRef, viewMode = "holdings", showCostumes = true, marketProfile = DEFAULT_MARKET_PROFILE }: { darkMode: boolean; onClose: () => void; visualLens: VisualLens; moverRingEnabled: boolean; panelRef?: RefObject<HTMLElement | null>; viewMode?: PortfolioView; showCostumes?: boolean; marketProfile?: MarketProfile }) {
  const copy = VISUAL_LENS_COPY[visualLens];
  const panel = darkMode ? "border-[#49636a] bg-[#142022] text-stone-100" : "border-stone-300 bg-[#fcfcfb] text-stone-800";
  const muted = darkMode ? "text-stone-300" : "text-stone-700";

  return (
    <aside ref={panelRef} role="dialog" aria-modal="false" aria-labelledby="portfolio-legend-title" className={`fixed top-[8.0625rem] z-50 max-h-[calc(100dvh-150px)] w-[min(300px,calc(100vw-106px))] overflow-y-auto rounded-xl border p-4 shadow-[0_18px_46px_-28px_rgba(41,37,36,.55)] ${panel}`} style={{ right: "calc(3rem + 54px - 8px)" }}>
      <div className="flex items-center justify-between gap-3">
        <h2 id="portfolio-legend-title" className="font-serif text-base">How to read the field</h2>
        <button type="button" onClick={onClose} aria-label="Close portfolio legend" className="grid min-h-11 min-w-11 place-items-center rounded-full"><X size={16} /></button>
      </div>
      <ul className={`mt-2 space-y-2 font-mono text-[10px] ${muted}`}>
        <li className="font-semibold text-current">Active lens · {copy.label}</li>
        <li>{copy.size}</li>
        <li>{copy.color}</li>
        <li>Dashed ring on loss cats — shown when emphasis halos are on.</li>
        <li className="flex items-center gap-3"><span aria-hidden="true" className="ml-3 grid h-4 w-4 place-items-center rounded-full border border-stone-900 bg-white text-[9px] font-bold text-stone-900">±</span><span>plus/minus badge · profit/loss without relying on colour</span></li>
        <li className="flex items-center gap-3"><span aria-hidden="true" className="ml-3 h-4 w-4 rounded-full border-2 border-stone-900 bg-[#D8AE37]" /><span>{taxReviewDescription(marketProfile)}</span></li>
        {moverRingEnabled && <li className="flex items-center gap-3"><span aria-hidden="true" className="ml-3 h-5 w-5 rounded-full border-2 border-dashed border-[#7c3aed] opacity-80" /><span>mover ring · daily movement of at least 2%</span></li>}
      </ul>
      <details className={`mt-3 font-mono text-[10px] ${muted}`}>
        <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-current outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8AE37]">Costume library · {showCostumes ? "on" : "off"}</summary>
        <p className="mt-2 text-[9px] leading-4">One main costume, in this priority order; the ETF basket may join it. Gold collars remain tax flags.</p>
        <ul className="mt-2 space-y-2">
          {COSTUME_ORDER.filter((id) => COSTUME_LEGEND[id][viewMode] != null).map((id) => (
            <li key={id} className="flex items-center gap-3">
              <span aria-hidden="true" className="grid h-12 w-12 shrink-0 place-items-center"><PortfolioKittySvg stroke={darkMode ? "#d8e1df" : "#353b38"} fill="transparent" fillOpacity={0} strokeWidth={2.4} costumes={[id]} darkMode={darkMode} className="h-12 w-12 overflow-visible" /></span>
              <span><span className="font-semibold text-current">{COSTUME_LEGEND[id].label}</span><span className="block text-[9px] leading-4">{COSTUME_LEGEND[id][viewMode]}</span></span>
            </li>
          ))}
        </ul>
      </details>
      <div className={`mt-3 space-y-1.5 border-t pt-3 font-mono text-[11px] leading-4 ${muted} ${darkMode ? "border-[#49636a]/50" : "border-stone-200"}`}>
        <p>Click Mr. Bungles to send a small portfolio digest to your connected AI provider. No conversation is opened.</p>
        <p>AI commentary is not personal financial advice; verify decisions with a qualified adviser.</p>
        <p><a href="/privacy" className="underline decoration-[#D8AE37] underline-offset-2 outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8AE37]">Read the privacy policy</a></p>
      </div>
    </aside>
  );
}
