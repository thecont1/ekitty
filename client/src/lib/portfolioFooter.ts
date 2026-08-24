const FOOTER_LAYOUT = "fixed bottom-4 left-1/2 z-40 flex w-[calc(100vw-24px)] -translate-x-1/2 flex-wrap items-center justify-center gap-x-2 gap-y-0.5 whitespace-normal text-center font-mono text-[9px] leading-tight tracking-[.08em] sm:w-auto sm:flex-nowrap sm:whitespace-nowrap";

export const PORTFOLIO_FOOTER_SEPARATOR_CLASS = "hidden sm:inline";

export function getPortfolioFooterClassName(darkMode: boolean): string {
  return `${FOOTER_LAYOUT} ${darkMode ? "text-stone-500" : "text-stone-400"}`;
}
