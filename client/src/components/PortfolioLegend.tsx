import { useEffect, useState, type RefObject } from "react";
import { ChevronDown, X } from "lucide-react";
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
export default function PortfolioLegend({ darkMode, onClose, visualLens, moverRingEnabled, panelRef, viewMode = "holdings", showCostumes = true, onShowCostumesChange, marketProfile = DEFAULT_MARKET_PROFILE }: { darkMode: boolean; onClose: () => void; visualLens: VisualLens; moverRingEnabled: boolean; panelRef?: RefObject<HTMLElement | null>; viewMode?: PortfolioView; showCostumes?: boolean; onShowCostumesChange: (show: boolean) => void; marketProfile?: MarketProfile }) {
  const copy = VISUAL_LENS_COPY[visualLens];
  const panel = darkMode ? "border-[#49636a] bg-[#142022] text-stone-100" : "border-stone-300 bg-[#fcfcfb] text-stone-800";
  const muted = darkMode ? "text-stone-300" : "text-stone-700";
  const [panelTop, setPanelTop] = useState(140);
  const [costumeLibraryOpen, setCostumeLibraryOpen] = useState(false);
  useEffect(() => {
    const header = document.getElementById("ekitty-header");
    if (!header) return;
    const measure = () => setPanelTop(Math.ceil(header.getBoundingClientRect().bottom + 12));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    window.addEventListener("resize", measure);
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); };
  }, []);

  return (
    <aside ref={panelRef} role="dialog" aria-modal="false" aria-labelledby="portfolio-legend-title" className={`portfolio-overlay-column fixed z-50 overflow-y-auto rounded-xl border p-4 shadow-[0_18px_46px_-28px_rgba(41,37,36,.55)] ${panel}`} style={{ top: panelTop, maxHeight: `calc(100dvh - ${panelTop + 16}px)` }}>
      <div className="flex items-center justify-between gap-3">
        <h2 id="portfolio-legend-title" className="font-serif text-xl leading-tight">How to read the field</h2>
        <button type="button" onClick={onClose} aria-label="Close portfolio legend" className="grid min-h-11 min-w-11 place-items-center rounded-full"><X size={16} /></button>
      </div>
      <ul className={`mt-2 space-y-3 font-mono text-[13px] leading-5 ${muted}`}>
        <li className="font-semibold text-current">Active lens · {copy.label}</li>
        <li>{copy.size}</li>
        <li>{copy.color}</li>
        <li>Dashed ring on loss cats — shown when emphasis halos are on.</li>
        <li className="flex items-center gap-3"><span aria-hidden="true" className="ml-3 grid h-4 w-4 shrink-0 place-items-center rounded-full border border-stone-900 bg-white text-[11px] font-bold text-stone-900">±</span><span>plus/minus badge · profit/loss without relying on colour</span></li>
        <li className="flex items-center gap-3"><span aria-hidden="true" className="ml-3 h-4 w-4 shrink-0 rounded-full border-2 border-stone-900 bg-[#D8AE37]" /><span>{taxReviewDescription(marketProfile)}</span></li>
        {moverRingEnabled && <li className="flex items-center gap-3"><span aria-hidden="true" className="ml-3 h-5 w-5 shrink-0 rounded-full border-2 border-dashed border-[#7c3aed] opacity-80" /><span>mover ring · daily movement of at least 2%</span></li>}
      </ul>
      <div className={`mt-4 font-mono text-[13px] leading-5 ${muted}`}>
        <div className="flex min-h-11 items-center justify-between gap-3">
          <button type="button" aria-expanded={costumeLibraryOpen} aria-controls="portfolio-costume-library" onClick={() => setCostumeLibraryOpen((current) => !current)} className="flex min-h-11 min-w-0 items-center gap-2 text-left text-sm font-semibold text-current outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8AE37]"><ChevronDown aria-hidden="true" className={`h-4 w-4 shrink-0 transition-transform ${costumeLibraryOpen ? "" : "-rotate-90"}`} /><span id="costume-library-title">Costume library</span></button>
          <button type="button" role="switch" aria-checked={showCostumes} aria-labelledby="costume-library-title" title={showCostumes ? "Turn costumes off" : "Turn costumes on"} onClick={() => onShowCostumesChange(!showCostumes)} className="grid min-h-11 min-w-11 shrink-0 place-items-center rounded-full outline-none transition hover:-translate-y-0.5 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8AE37] active:scale-95">
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
              <path d={showCostumes ? "M16 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" : "M8 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"} />
              <path d="M2 6m0 6a6 6 0 0 1 6 -6h8a6 6 0 0 1 6 6v0a6 6 0 0 1 -6 6h-8a6 6 0 0 1 -6 -6z" />
            </svg>
          </button>
        </div>
        <div id="portfolio-costume-library" hidden={!costumeLibraryOpen}>
          <p className="mt-2 text-[12px] leading-5">One main costume, in this priority order; the ETF basket may join it. Gold collars remain tax flags.</p>
          <ul className="mt-2 space-y-4">
            {COSTUME_ORDER.filter((id) => COSTUME_LEGEND[id][viewMode] != null).map((id) => (
              <li key={id} className="portfolio-costume-row">
                <span aria-hidden="true" className="grid h-[72px] w-[72px] shrink-0 place-items-center"><PortfolioKittySvg stroke={darkMode ? "#d8e1df" : "#353b38"} fill="transparent" fillOpacity={0} strokeWidth={2.4} costumes={[id]} darkMode={darkMode} className="h-[72px] w-[72px] overflow-visible" /></span>
                <span className="min-w-0 break-words"><span className="text-[14px] font-semibold leading-5 text-current">{COSTUME_LEGEND[id].label}</span><span className="mt-1 block text-[13px] leading-5">{COSTUME_LEGEND[id][viewMode]}</span></span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className={`mt-3 space-y-3 border-t pt-3 font-mono text-[13px] leading-5 ${muted} ${darkMode ? "border-[#49636a]/50" : "border-stone-200"}`}>
        <p>Click Mr. Bungles to send a small portfolio digest to your connected AI provider. No conversation is opened.</p>
        <p>AI commentary is not personal financial advice; verify decisions with a qualified adviser.</p>
        <p><a href="/privacy" className="underline decoration-[#D8AE37] underline-offset-2 outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8AE37]">Read the privacy policy</a></p>
      </div>
    </aside>
  );
}
