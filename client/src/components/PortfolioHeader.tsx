import PortfolioKittySvg from "@/components/PortfolioKittySvg";
import { formatCurrency, type PortfolioStats } from "@/lib/portfolio";

type PortfolioHeaderProps = {
  stats: PortfolioStats;
  hasPortfolio: boolean;
  darkMode: boolean;
  onOpenPortfolio: () => void;
};

export default function PortfolioHeader({ stats, hasPortfolio, darkMode, onOpenPortfolio }: PortfolioHeaderProps) {
  const positive = stats.totalUnrealizedPnl >= 0;
  const sign = positive ? "+" : "−";
  const pnlClass = positive
    ? darkMode ? "text-[#4ade80]" : "text-[#087548]"
    : darkMode ? "text-[#ff8a8a]" : "text-[#c52222]";

  return (
    <header id="ekitty-header" className={darkMode ? "fixed right-24 top-3 z-[60] w-[min(288px,calc(100vw-7rem))] rounded-2xl bg-[#101617] px-3 py-2.5 text-stone-100" : "fixed right-24 top-3 z-[60] w-[min(288px,calc(100vw-7rem))] rounded-2xl bg-[#faf9f5] px-3 py-2.5 text-stone-900"}>
      <div className="flex items-center gap-1.5">
        <PortfolioKittySvg stroke={darkMode ? "#ff8a8a" : "#c52222"} fill="transparent" fillOpacity={0} strokeWidth={2.5} className="h-11 w-11 shrink-0" />
        <h1 className="font-serif text-[18px] font-medium leading-none tracking-tight">ekitty purrrtfolio</h1>
      </div>
      {hasPortfolio && (
        <button
          type="button"
          onClick={onOpenPortfolio}
          className="mt-1 flex min-h-11 w-full items-end justify-between gap-3 rounded-lg px-1 py-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8AE37]"
          aria-label={`Open portfolio Group view. Net unrealized ${positive ? "profit" : "loss"} ${formatCurrency(Math.abs(stats.totalUnrealizedPnl))}, ${Math.abs(stats.totalUnrealizedPnlPercent).toFixed(2)} percent.`}
        >
          <span className={darkMode ? "font-mono text-[8px] uppercase tracking-[.18em] text-stone-400" : "font-mono text-[8px] uppercase tracking-[.18em] text-stone-600"}>Portfolio · net P&amp;L</span>
          <span className={`whitespace-nowrap font-mono text-[12px] font-medium tabular-nums ${pnlClass}`}>
            <span aria-hidden="true">{sign}</span>{formatCurrency(Math.abs(stats.totalUnrealizedPnl))} <span className="text-[10px]">({sign}{Math.abs(stats.totalUnrealizedPnlPercent).toFixed(2)}%)</span>
          </span>
        </button>
      )}
    </header>
  );
}
