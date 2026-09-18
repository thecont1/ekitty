import { mrBunglesDigestSchema, buildMrBunglesDirectives, MR_BUNGLES_MAX_BYTES, type MrBunglesDigest, type MrBunglesFacts, type MrBunglesTarget } from "@shared/mrBungles";
import { DEFAULT_MARKET_PROFILE, type MarketProfile } from "@shared/marketProfiles";
import type { PortfolioPoint } from "./portfolio";
import { hasCompleteDayChange, portfolioShare, type PortfolioView } from "./portfolioCostumes";
import type { VisualLens } from "./portfolioVisuals";

export type MrBunglesScope = { includesEtfs: boolean; taxFilter: "all" | "highlight" | "isolate"; query: string };

export function buildMrBunglesDigest(points: readonly PortfolioPoint[], view: PortfolioView, lens: VisualLens, scope: MrBunglesScope, marketProfile: MarketProfile = DEFAULT_MARKET_PROFILE): MrBunglesDigest | null {
  const population = scope.includesEtfs ? [...points] : points.filter(point => !point.isETF);
  const query = scope.query.trim().toLocaleLowerCase();
  const visible = population.filter(point => (scope.taxFilter !== "isolate" || point.taxSensitive) && (!query || point.company.toLocaleLowerCase().includes(query)));
  const byId = (a: PortfolioPoint, b: PortfolioPoint) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  const top = (entries: readonly PortfolioPoint[], score: (point: PortfolioPoint) => number) => [...entries].sort((a, b) => score(b) - score(a) || byId(a, b)).slice(0, 3);
  const metric = view === "holdings" ? "currentValue" : "investedValue";
  const concentration = top(visible.filter(point => portfolioShare(point, population, metric) !== undefined), point => point[metric]);
  const worstLosers = top(visible.filter(point => point.pnl < 0), point => -point.pnl);
  const bestGainers = top(visible.filter(point => point.pnl > 0), point => point.pnl);
  const dayMovers = top(visible.filter(point => hasCompleteDayChange(point) && Math.abs(point.dayChangePercent!) >= 2), point => Math.abs(point.dayChangePercent!));
  const curiosity = [...visible].sort((a, b) => Math.abs(a.pnlPercent) - Math.abs(b.pnlPercent) || byId(a, b)).slice(0, 1);
  const nominees = Array.from(new Map([...concentration, ...worstLosers, ...bestGainers, ...dayMovers, ...curiosity].map(point => [point.id, point])).values()).sort(byId);
  const targets: MrBunglesTarget[] = nominees.map(point => {
    const target: MrBunglesTarget = {
      id: point.id,
      company: point.company,
      invested: point.investedValue,
      current: point.currentValue,
      pnl: point.pnl,
      lotCount: point.lots.length,
      taxFlag: point.taxSensitive,
      etf: point.isETF,
    };
    if (point.investedValue > 0) target.pnlPercent = point.pnlPercent;
    if (point.ageDays !== undefined) target.ageDays = point.ageDays;
    if (view === "holdings") {
      const share = portfolioShare(point, population, "currentValue");
      if (share !== undefined) target.sharePercent = share;
    } else {
      const share = portfolioShare(point, population, "investedValue");
      if (share !== undefined) target.investedSharePercent = share;
      if (point.oldestDate) target.purchaseDate = point.oldestDate;
    }
    if (hasCompleteDayChange(point)) target.day = { change: point.dayChange!, percent: point.dayChangePercent!, coveredLots: point.lots.length, lotCount: point.lots.length };
    return target;
  });
  const invested = population.reduce((sum, point) => sum + point.investedValue, 0);
  const current = population.reduce((sum, point) => sum + point.currentValue, 0);
  const pnl = current - invested;
  const totals: MrBunglesFacts["totals"] = { invested, current, pnl };
  if (invested > 0) totals.pnlPercent = pnl / invested * 100;
  if (population.length && population.every(hasCompleteDayChange)) {
    const previous = population.reduce((sum, point) => sum + point.previousCloseValue!, 0);
    const lotCount = population.reduce((sum, point) => sum + point.lots.length, 0);
    if (previous > 0) totals.day = { change: current - previous, percent: (current - previous) / previous * 100, coveredLots: lotCount, lotCount };
  }
  const facts: MrBunglesFacts = {
    version: 1,
    view,
    lens,
    market: marketProfile,
    scope: { includesEtfs: scope.includesEtfs, taxFilter: scope.taxFilter, searchFiltered: !!query },
    population: population.length,
    visibleCount: visible.length,
    totals,
    targets,
    leaders: { concentration: concentration.map(point => point.id), worstLosers: worstLosers.map(point => point.id), bestGainers: bestGainers.map(point => point.id), dayMovers: dayMovers.map(point => point.id) },
  };
  if (curiosity.length && visible.every(point => point.investedValue > 0 && Number.isFinite(point.pnlPercent) && Math.abs(point.pnlPercent) <= 5 && !point.taxSensitive && (!hasCompleteDayChange(point) || Math.abs(point.dayChangePercent!) < 2) && (portfolioShare(point, population, metric) ?? Infinity) < (view === "holdings" ? 20 : 10))) facts.quietTargetId = curiosity[0].id;
  const result = mrBunglesDigestSchema.safeParse({ ...facts, directives: buildMrBunglesDirectives(facts) });
  if (!result.success || new TextEncoder().encode(JSON.stringify(result.data)).byteLength > MR_BUNGLES_MAX_BYTES) return null;
  return result.data;
}
