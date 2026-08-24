import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parsePortfolioCsv } from "./portfolio";
import {
  derivePortfolioModel,
  getKittyEmphasis,
  getKittyPigment,
  getKittyRadius,
  normalizeLinear,
  normalizeLog,
  normalizeSigned,
  normalizeSqrt,
  type PortfolioLot,
} from "./portfolioVisuals";

const lots: PortfolioLot[] = [
  { id: "ola-1", company: "OLA", buy_qty: 100, avg_price: 100, current_price: 70, buy_date: "2024-01-01" },
  { id: "ola-2", company: "OLA", buy_qty: 50, avg_price: 80, current_price: 70, buy_date: "2025-01-01" },
  { id: "irfc-1", company: "IRFC", buy_qty: 100, avg_price: 50, current_price: 25, buy_date: "2024-01-01" },
  { id: "gain-1", company: "Gain", buy_qty: 10, avg_price: 100, current_price: 150, buy_date: "2026-01-01" },
];

describe("normalization helpers", () => {
  it("clamps linear and square-root normalization and handles collapsed ranges", () => {
    expect(normalizeLinear(5, 0, 10)).toBe(0.5);
    expect(normalizeLinear(-1, 0, 10)).toBe(0);
    expect(normalizeLinear(12, 0, 10)).toBe(1);
    expect(normalizeLinear(5, 5, 5)).toBe(0.5);
    expect(normalizeSqrt(25, 0, 100)).toBe(0.5);
  });

  it("log normalization spreads the mid-pack and clamps extremes", () => {
    expect(normalizeLog(100_000_000, 1, 100_000_000)).toBeCloseTo(1, 5);
    expect(normalizeLog(1, 1, 100_000_000)).toBeCloseTo(0, 5);
    expect(normalizeLog(0, 1, 100_000_000)).toBe(0);
    expect(normalizeLog(Number.NaN, 1, 100)).toBe(0);
    expect(normalizeLog(5, 5, 5)).toBe(0.5);

    const norms = [1_000, 5_000, 25_000, 125_000, 625_000].map((value) => normalizeLog(value, 1_000, 100_000_000));
    expect(Math.max(...norms) - Math.min(...norms)).toBeGreaterThan(0.4);
  });

  it("normalizes signed values around zero with asymmetric extremes", () => {
    expect(normalizeSigned(-50, -100, 200)).toBe(-0.5);
    expect(normalizeSigned(100, -100, 200)).toBe(0.5);
    expect(normalizeSigned(-500, -100, 200)).toBe(-1);
    expect(normalizeSigned(500, -100, 200)).toBe(1);
  });
});

describe("derived portfolio visual model", () => {
  it("groups lots and computes canonical holding and portfolio metrics", () => {
    const model = derivePortfolioModel(lots, "portfolio-impact");
    const ola = model.holdings.find((holding) => holding.company === "OLA");

    expect(model.portfolioInvestedValue).toBe(20_000);
    expect(model.portfolioCurrentValue).toBe(14_500);
    expect(model.portfolioPnlAbs).toBe(-5_500);
    expect(model.portfolioPnlPct).toBeCloseTo(-27.5);
    expect(ola).toMatchObject({
      company: "OLA",
      totalQty: 150,
      investedValue: 14_000,
      currentValue: 10_500,
      pnlAbs: -3_500,
      pnlPct: -25,
      oldestTxnDate: "2024-01-01",
    });
    expect(ola?.lots).toHaveLength(2);
  });

  it("assigns each visual channel according to the active lens", () => {
    const impact = derivePortfolioModel(lots, "portfolio-impact").holdings;
    const quality = derivePortfolioModel(lots, "trade-quality").holdings;
    const risk = derivePortfolioModel(lots, "capital-at-risk").holdings;
    const impactOla = impact.find((holding) => holding.company === "OLA")!;
    const qualityOla = quality.find((holding) => holding.company === "OLA")!;
    const riskOla = risk.find((holding) => holding.company === "OLA")!;

    expect(impactOla.visuals).toMatchObject({ sizeRaw: 14_000, colorRaw: -3_500, impactRaw: 3_500 });
    expect(qualityOla.visuals).toMatchObject({ sizeRaw: 14_000, colorRaw: -25, impactRaw: 3_500 });
    expect(riskOla.visuals).toMatchObject({ sizeRaw: 3_500, colorRaw: -25, impactRaw: 14_000 });
    for (const metric of Object.values(impactOla.visuals)) expect(Number.isFinite(metric)).toBe(true);
  });

  it("uses log size normalization for the real portfolio while retaining square-root impact", () => {
    const csvPath = join(dirname(fileURLToPath(import.meta.url)), "../../public/data/portfolio.csv");
    const records = parsePortfolioCsv(readFileSync(csvPath, "utf8")).records;
    const holdings = derivePortfolioModel(records, "portfolio-impact").holdings;
    const sortedByInvested = [...holdings].sort((left, right) => left.visuals.sizeRaw - right.visuals.sizeRaw);

    expect(sortedByInvested[0].visuals.sizeNorm).toBeCloseTo(0, 5);
    expect(sortedByInvested[sortedByInvested.length - 1].visuals.sizeNorm).toBeCloseTo(1, 5);
    expect(sortedByInvested[Math.floor(sortedByInvested.length / 2)].visuals.sizeNorm).toBeGreaterThan(0.3);

    const impactValues = holdings.map((holding) => holding.visuals.impactRaw);
    const impactMin = Math.min(...impactValues, 0);
    const impactMax = Math.max(...impactValues, 0);
    for (const holding of holdings) {
      expect(holding.visuals.impactNorm).toBeCloseTo(normalizeSqrt(holding.visuals.impactRaw, impactMin, impactMax), 10);
    }
  });

  it("makes larger rupee loss stronger in portfolio-impact and steeper percentage loss stronger in trade-quality", () => {
    const impact = derivePortfolioModel(lots, "portfolio-impact").holdings;
    const quality = derivePortfolioModel(lots, "trade-quality").holdings;
    const impactOla = impact.find((holding) => holding.company === "OLA")!;
    const impactIrfc = impact.find((holding) => holding.company === "IRFC")!;
    const qualityOla = quality.find((holding) => holding.company === "OLA")!;
    const qualityIrfc = quality.find((holding) => holding.company === "IRFC")!;

    expect(impactOla.visuals.colorNorm).toBeLessThan(impactIrfc.visuals.colorNorm);
    expect(qualityIrfc.visuals.colorNorm).toBeLessThan(qualityOla.visuals.colorNorm);
    expect(impactOla.visuals.impactNorm).toBeGreaterThan(impactIrfc.visuals.impactNorm);
  });
});

describe("kitty visual mappings", () => {
  it("maps normalized channels into bounded prepared rendering values", () => {
    expect(getKittyRadius(0, 40, 200)).toBe(40);
    expect(getKittyRadius(1, 40, 200)).toBe(200);
    expect(getKittyPigment(-1, false).direction).toBe("loss");
    expect(getKittyPigment(1, true).direction).toBe("profit");
    expect(getKittyPigment(0, false).direction).toBe("neutral");
    expect(getKittyEmphasis(1, -100).symbol).toBe("−");
    expect(getKittyEmphasis(1, 100).symbol).toBe("+");
    expect(getKittyEmphasis(0, 0).symbol).toBe("·");
    expect(getKittyEmphasis(1, -100).haloWidth).toBeGreaterThan(getKittyEmphasis(0, -100).haloWidth);
  });
});
