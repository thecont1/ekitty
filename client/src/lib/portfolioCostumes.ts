import type { PortfolioPoint } from "./portfolio";

export type PortfolioView = "holdings" | "transactions";
export type CostumeId = "wounded" | "monopoly" | "firefighter" | "parachute" | "rocket" | "strutting" | "patchwork" | "fledgling" | "veteran" | "tightrope" | "fog" | "basket";
export const COSTUME_ORDER: CostumeId[] = ["wounded", "monopoly", "firefighter", "parachute", "rocket", "strutting", "patchwork", "fledgling", "veteran", "tightrope", "fog", "basket"];
export const COSTUME_LEGEND: Record<CostumeId, { label: string; holdings: string | null; transactions: string | null }> = {
  wounded: { label: "Wounded", holdings: "Bandage · blended loss of at least 25%.", transactions: "Bandage · this purchase has lost at least 25%." },
  monopoly: { label: "Monopoly", holdings: "Top hat + green coat · at least 20% of portfolio current value.", transactions: null },
  firefighter: { label: "Firefighter", holdings: null, transactions: "Fire jacket · this purchase used at least 10% of invested capital." },
  parachute: { label: "Parachute", holdings: "Parachute · holding down at least 2% today; every lot covered.", transactions: "Parachute · purchase down at least 2% today; prior close known." },
  rocket: { label: "Rocket", holdings: "Rocket pack · holding up at least 2% today; every lot covered.", transactions: "Rocket pack · purchase up at least 2% today; prior close known." },
  strutting: { label: "Strutting", holdings: "Brass chain + shades · blended gain of at least 50%.", transactions: "Brass chain + shades · this purchase has gained at least 50%." },
  patchwork: { label: "Patchwork", holdings: "Split coat · winning and losing purchases within one holding.", transactions: null },
  fledgling: { label: "Fledgling", holdings: "Eggshell cap · every purchase is dated and under 30 days old.", transactions: "Eggshell cap · this purchase is under 30 days old." },
  veteran: { label: "Veteran", holdings: "Reading glasses · oldest known purchase is at least 730 days old.", transactions: "Reading glasses · this purchase is at least 730 days old." },
  tightrope: { label: "Tightrope", holdings: "Balance pole · blended return is within 1% of break-even.", transactions: "Balance pole · this purchase is within 1% of break-even." },
  fog: { label: "Fog", holdings: "Dotted veil · day-change unavailable for the complete holding.", transactions: "Dotted veil · day-change unavailable for this purchase." },
  basket: { label: "Basket", holdings: "Woven basket · all contributing lots are classified as ETF.", transactions: "Woven basket · this purchase is classified as ETF." },
};

export function hasCompleteDayChange(point: PortfolioPoint): boolean {
  return point.lots.length > 0 && point.lots.every(lot => Number.isFinite(lot.prev_close_price) && lot.prev_close_price! > 0)
    && Number.isFinite(point.previousCloseValue) && point.previousCloseValue! > 0
    && Number.isFinite(point.dayChange) && Number.isFinite(point.dayChangePercent);
}

export function portfolioShare(point: PortfolioPoint, points: readonly PortfolioPoint[], metric: "currentValue" | "investedValue"): number | undefined {
  if (!points.length || !points.every(p => Number.isFinite(p[metric]) && p[metric] >= 0) || !Number.isFinite(point[metric]) || point[metric] < 0) return undefined;
  const total = points.reduce((sum, p) => sum + p[metric], 0);
  return Number.isFinite(total) && total > 0 ? point[metric] / total * 100 : undefined;
}

export function deriveCostumeStates(point: PortfolioPoint, view: PortfolioView, portfolioPoints: readonly PortfolioPoint[]): { eligible: CostumeId[]; layers: CostumeId[] } {
  const states = new Set<CostumeId>();
  const validReturn = Number.isFinite(point.pnlPercent) && Number.isFinite(point.investedValue) && point.investedValue > 0;
  if (validReturn && point.pnlPercent <= -25) states.add("wounded");
  if (validReturn && point.pnlPercent >= 50) states.add("strutting");
  if (validReturn && Math.abs(point.pnlPercent) <= 1) states.add("tightrope");
  const dayKnown = hasCompleteDayChange(point);
  if (!dayKnown) states.add("fog");
  if (dayKnown && point.dayChangePercent! <= -2) states.add("parachute");
  if (dayKnown && point.dayChangePercent! >= 2) states.add("rocket");
  const validAge = Number.isFinite(point.ageDays) && point.ageDays! >= 0;
  if (validAge && point.ageDays! >= 730) states.add("veteran");
  if (view === "holdings") {
    if ((portfolioShare(point, portfolioPoints, "currentValue") ?? -1) >= 20) states.add("monopoly");
    const lotReturns = point.lots.map(lot => lot.buy_qty * (lot.current_price - lot.avg_price));
    if (lotReturns.some(pnl => pnl > 0) && lotReturns.some(pnl => pnl < 0)) states.add("patchwork");
    if (validAge && point.ageDays! < 30 && point.lots.length > 0 && point.lots.every(lot => !!lot.buy_date && Number.isFinite(Date.parse(lot.buy_date)))) states.add("fledgling");
  } else {
    if ((portfolioShare(point, portfolioPoints, "investedValue") ?? -1) >= 10) states.add("firefighter");
    if (validAge && point.ageDays! < 30 && point.lots.length === 1 && !!point.lots[0].buy_date && Number.isFinite(Date.parse(point.lots[0].buy_date))) states.add("fledgling");
  }
  if (point.isETF) states.add("basket");
  const eligible = COSTUME_ORDER.filter(state => states.has(state));
  const story = eligible.find(state => state !== "basket");
  return { eligible, layers: [...(story ? [story] : []), ...(states.has("basket") ? ["basket" as const] : [])] };
}
