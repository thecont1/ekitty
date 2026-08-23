import { asHoldingPoints, type PortfolioLot, type PortfolioPoint } from "./portfolio";
export type { PortfolioLot } from "./portfolio";

export type VisualLens = "portfolio-impact" | "trade-quality" | "capital-at-risk";

export type HoldingVisuals = {
  sizeRaw: number;
  colorRaw: number;
  impactRaw: number;
  sizeNorm: number;
  colorNorm: number;
  impactNorm: number;
};

export type DerivedHolding = PortfolioPoint & {
  totalQty: number;
  pnlAbs: number;
  pnlPct: number;
  eligibleForTaxLoss: boolean;
  oldestTxnDate?: string;
  visuals: HoldingVisuals;
};

export type DerivedPortfolioModel = {
  holdings: DerivedHolding[];
  portfolioInvestedValue: number;
  portfolioCurrentValue: number;
  portfolioPnlAbs: number;
  portfolioPnlPct: number;
};

export type PigmentStyle = {
  fill: string;
  ink: string;
  fillOpacity: number;
  direction: "profit" | "loss" | "neutral";
};

export type EmphasisStyle = {
  haloWidth: number;
  haloOpacity: number;
  symbol: "+" | "−" | "·";
};

const LOSS_RED = "#ff3b3b";
const LOSS_RED_DARK = "#ff6b6b";
const GAIN_GREEN = "#17885b";
const GAIN_GREEN_DARK = "#4ade80";

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function normalizeLinear(value: number, min: number, max: number) {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max)) return 0;
  if (max === min) return 0.5;
  return clamp((value - min) / (max - min), 0, 1);
}

export function normalizeSqrt(value: number, min: number, max: number) {
  return Math.sqrt(normalizeLinear(value, min, max));
}

export function normalizeSigned(value: number, negativeExtreme: number, positiveExtreme: number) {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return negativeExtreme < 0 ? -clamp(value / negativeExtreme, 0, 1) : 0;
  if (value > 0) return positiveExtreme > 0 ? clamp(value / positiveExtreme, 0, 1) : 0;
  return 0;
}

function rawVisuals(point: PortfolioPoint, lens: VisualLens) {
  if (lens === "trade-quality") return { sizeRaw: point.investedValue, colorRaw: point.pnlPercent, impactRaw: Math.abs(point.pnl) };
  if (lens === "capital-at-risk") return { sizeRaw: Math.abs(point.pnl), colorRaw: point.pnlPercent, impactRaw: point.investedValue };
  return { sizeRaw: point.investedValue, colorRaw: point.pnl, impactRaw: Math.abs(point.pnl) };
}

export function deriveHoldingVisuals(points: PortfolioPoint[], lens: VisualLens): DerivedHolding[] {
  const raw = points.map((point) => ({ point, ...rawVisuals(point, lens) }));
  const sizeValues = raw.map(({ sizeRaw }) => sizeRaw);
  const impactValues = raw.map(({ impactRaw }) => impactRaw);
  const negativeExtreme = Math.min(0, ...raw.map(({ colorRaw }) => colorRaw));
  const positiveExtreme = Math.max(0, ...raw.map(({ colorRaw }) => colorRaw));
  const sizeMin = Math.min(...sizeValues, 0);
  const sizeMax = Math.max(...sizeValues, 0);
  const impactMin = Math.min(...impactValues, 0);
  const impactMax = Math.max(...impactValues, 0);

  return raw.map(({ point, sizeRaw, colorRaw, impactRaw }) => ({
    ...point,
    totalQty: point.qty,
    pnlAbs: point.pnl,
    pnlPct: point.pnlPercent,
    eligibleForTaxLoss: point.taxSensitive,
    oldestTxnDate: point.oldestDate,
    visuals: {
      sizeRaw,
      colorRaw,
      impactRaw,
      sizeNorm: normalizeSqrt(sizeRaw, sizeMin, sizeMax),
      colorNorm: normalizeSigned(colorRaw, negativeExtreme, positiveExtreme),
      impactNorm: normalizeSqrt(impactRaw, impactMin, impactMax),
    },
  }));
}

export function derivePortfolioModel(lots: PortfolioLot[], lens: VisualLens): DerivedPortfolioModel {
  const holdings = deriveHoldingVisuals(asHoldingPoints(lots), lens);
  const portfolioInvestedValue = holdings.reduce((sum, holding) => sum + holding.investedValue, 0);
  const portfolioCurrentValue = holdings.reduce((sum, holding) => sum + holding.currentValue, 0);
  const portfolioPnlAbs = portfolioCurrentValue - portfolioInvestedValue;
  return {
    holdings,
    portfolioInvestedValue,
    portfolioCurrentValue,
    portfolioPnlAbs,
    portfolioPnlPct: portfolioInvestedValue ? (portfolioPnlAbs / portfolioInvestedValue) * 100 : 0,
  };
}

function mixHex(start: string, end: string, amount: number) {
  const from = start.slice(1);
  const to = end.slice(1);
  const mixed = [0, 2, 4].map((offset) => Math.round(parseInt(from.slice(offset, offset + 2), 16) + (parseInt(to.slice(offset, offset + 2), 16) - parseInt(from.slice(offset, offset + 2), 16)) * amount).toString(16).padStart(2, "0"));
  return `#${mixed.join("")}`;
}

export function getKittyRadius(sizeNorm: number, minSize: number, maxSize: number) {
  return minSize + clamp(sizeNorm, 0, 1) * (maxSize - minSize);
}

export function getKittyPigment(colorNorm: number, darkMode: boolean): PigmentStyle {
  const magnitude = Math.abs(clamp(colorNorm, -1, 1));
  if (magnitude < 0.02) return { fill: "transparent", ink: darkMode ? "#a6b5ba" : "#8da0a9", fillOpacity: 0, direction: "neutral" };
  const direction = colorNorm < 0 ? "loss" : "profit";
  const target = direction === "loss" ? (darkMode ? LOSS_RED_DARK : LOSS_RED) : (darkMode ? GAIN_GREEN_DARK : GAIN_GREEN);
  const pale = direction === "loss" ? (darkMode ? "#381f23" : "#fff1f1") : (darkMode ? "#153329" : "#effaf4");
  return {
    fill: mixHex(pale, target, 0.16 + magnitude * 0.84),
    ink: mixHex(darkMode ? "#9db0b6" : "#87969b", target, 0.42 + magnitude * 0.58),
    fillOpacity: 0.22 + magnitude * 0.68,
    direction,
  };
}

export function getKittyEmphasis(impactNorm: number, pnlAbs: number): EmphasisStyle {
  const magnitude = clamp(impactNorm, 0, 1);
  return {
    haloWidth: 1 + magnitude * 4,
    haloOpacity: magnitude ? 0.16 + magnitude * 0.3 : 0,
    symbol: pnlAbs > 0 ? "+" : pnlAbs < 0 ? "−" : "·",
  };
}

export const VISUAL_LENS_COPY: Record<VisualLens, { label: string; size: string; color: string; emphasis: string }> = {
  "portfolio-impact": {
    label: "Portfolio impact",
    size: "Bigger kitty = more money invested.",
    color: "Redder or greener kitty = larger rupee loss or gain.",
    emphasis: "Heavier halo = larger rupee impact on your wealth.",
  },
  "trade-quality": {
    label: "Trade quality",
    size: "Bigger kitty = more money invested.",
    color: "Redder or greener kitty = worse or better percentage return.",
    emphasis: "Heavier halo = larger rupee impact on your wealth.",
  },
  "capital-at-risk": {
    label: "Capital at risk",
    size: "Bigger kitty = larger absolute rupee gain or loss.",
    color: "Redder or greener kitty = worse or better percentage return.",
    emphasis: "Heavier halo = more money invested.",
  },
};
