export type PortfolioOverlayTheme = {
  panel: string;
  title: string;
  muted: string;
  value: string;
  lotText: string;
  divider: string;
  closeButton: string;
  taxNotice: string;
  profit: string;
  loss: string;
};

const DARK_OVERLAY_THEME: PortfolioOverlayTheme = {
  panel: "border-[#30464c] bg-[#142022]/98 text-stone-100 shadow-[0_22px_62px_-24px_rgba(0,0,0,.82)]",
  title: "text-stone-100",
  muted: "text-stone-400",
  value: "text-stone-200",
  lotText: "text-stone-300",
  divider: "border-[#25383d]",
  closeButton: "text-stone-400 hover:bg-[#203035] hover:text-stone-100",
  taxNotice: "border-amber-800/60 bg-amber-950/45 text-amber-200",
  profit: "text-[#4ade80]",
  loss: "text-[#ff6b6b]",
};

const LIGHT_OVERLAY_THEME: PortfolioOverlayTheme = {
  panel: "border-stone-200 bg-white/98 text-stone-900 shadow-[0_22px_62px_-24px_rgba(41,37,36,.5)]",
  title: "text-stone-900",
  muted: "text-stone-400",
  value: "text-stone-800",
  lotText: "text-stone-700",
  divider: "border-stone-100",
  closeButton: "text-stone-500 hover:bg-stone-100 hover:text-stone-900",
  taxNotice: "border-amber-100 bg-amber-50 text-amber-800",
  profit: "text-emerald-700",
  loss: "text-[#ff3b3b]",
};

export function getPortfolioOverlayTheme(darkMode: boolean): PortfolioOverlayTheme {
  return darkMode ? DARK_OVERLAY_THEME : LIGHT_OVERLAY_THEME;
}
