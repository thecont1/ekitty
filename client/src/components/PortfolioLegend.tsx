import PortfolioKittySvg from "@/components/PortfolioKittySvg";
import { X } from "lucide-react";

export default function PortfolioLegend({ darkMode, onClose }: { darkMode: boolean; onClose: () => void }) {
  const panel = darkMode ? "border-[#49636a] bg-[#142022] text-stone-100" : "border-stone-300 bg-[#fcfcfb] text-stone-800";
  const muted = darkMode ? "text-stone-300" : "text-stone-700";
  return (
    <aside role="dialog" aria-modal="false" aria-labelledby="portfolio-legend-title" className={`fixed right-3 top-[15.5rem] z-50 w-[min(300px,calc(100vw-24px))] rounded-xl border p-4 shadow-[0_18px_46px_-28px_rgba(41,37,36,.55)] ${panel}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 id="portfolio-legend-title" className="font-serif text-base">How to read the field</h2>
        <button type="button" onClick={onClose} aria-label="Close portfolio legend" className="grid min-h-11 min-w-11 place-items-center rounded-full"><X size={16} /></button>
      </div>
      <ul className={`mt-2 space-y-2 font-mono text-[10px] ${muted}`}>
        <li className="flex items-center gap-3"><PortfolioKittySvg stroke="#087548" fill="#a7dfc1" fillOpacity={0.72} strokeWidth={3} className="h-9 w-9" /><span><strong className="text-current">+</strong> profit</span></li>
        <li className="flex items-center gap-3"><PortfolioKittySvg stroke="#c52222" fill="#f5b8b8" fillOpacity={0.72} strokeWidth={3} className="h-9 w-9" /><span><strong className="text-current">−</strong> loss</span></li>
        <li className="flex items-center gap-2"><PortfolioKittySvg stroke="currentColor" fill="transparent" fillOpacity={0} strokeWidth={2} className="h-5 w-5" /><PortfolioKittySvg stroke="currentColor" fill="transparent" fillOpacity={0} strokeWidth={2} className="h-10 w-10" /><span>position size</span></li>
        <li className="flex items-center gap-3"><span aria-hidden="true" className="ml-3 h-4 w-4 rounded-full border-2 border-stone-900 bg-[#D8AE37]" /><span>330+ day loss · tax-loss eligible</span></li>
      </ul>
    </aside>
  );
}
