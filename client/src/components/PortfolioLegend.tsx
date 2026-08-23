import { X } from "lucide-react";
import { VISUAL_LENS_COPY, type VisualLens } from "@/lib/portfolioVisuals";

export default function PortfolioLegend({ darkMode, onClose, visualLens }: { darkMode: boolean; onClose: () => void; visualLens: VisualLens }) {
  const copy = VISUAL_LENS_COPY[visualLens];
  const panel = darkMode ? "border-[#49636a] bg-[#142022] text-stone-100" : "border-stone-300 bg-[#fcfcfb] text-stone-800";
  const muted = darkMode ? "text-stone-300" : "text-stone-700";
  return (
    <aside role="dialog" aria-modal="false" aria-labelledby="portfolio-legend-title" className={`fixed right-3 top-[15.5rem] z-50 w-[min(300px,calc(100vw-24px))] rounded-xl border p-4 shadow-[0_18px_46px_-28px_rgba(41,37,36,.55)] ${panel}`}>
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
        <li className="flex items-center gap-3"><span aria-hidden="true" className="ml-3 h-5 w-5 rounded-full border-2 border-current opacity-60" /><span>mover ring · daily movement of at least 2%</span></li>
      </ul>
    </aside>
  );
}
