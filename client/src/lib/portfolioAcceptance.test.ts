import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parsePortfolioCsv } from "./portfolio";
import { derivePortfolioModel } from "./portfolioVisuals";

const expected = {
  "OLA Electric Mobility": { pnl: -10_903.15, pct: -25.7 },
  IRFC: { pnl: -9_122.79, pct: -44.4 },
  Infosys: { pnl: -5_585.66, pct: -25.0 },
  "Jupiter Wagons": { pnl: -3_555.6, pct: -15.2 },
} as const;

describe("live portfolio visual-lens acceptance data", () => {
  it("matches the four named holding loss scenarios", () => {
    const csv = readFileSync(resolve(process.cwd(), "client/public/data/portfolio.csv"), "utf8");
    const parsed = parsePortfolioCsv(csv);
    const model = derivePortfolioModel(parsed.records, "portfolio-impact");

    expect(parsed.error).toBeUndefined();
    for (const [company, values] of Object.entries(expected)) {
      const holding = model.holdings.find((candidate) => candidate.company === company);
      expect(holding, company).toBeDefined();
      expect(holding?.pnlAbs, company).toBeCloseTo(values.pnl, 2);
      expect(holding?.pnlPct, company).toBeCloseTo(values.pct, 1);
    }
  });

  it("orders OLA above IRFC by rupee pain and IRFC below OLA by trade quality", () => {
    const csv = readFileSync(resolve(process.cwd(), "client/public/data/portfolio.csv"), "utf8");
    const records = parsePortfolioCsv(csv).records;
    const impact = derivePortfolioModel(records, "portfolio-impact").holdings;
    const quality = derivePortfolioModel(records, "trade-quality").holdings;
    const impactOla = impact.find((holding) => holding.company === "OLA Electric Mobility")!;
    const impactIrfc = impact.find((holding) => holding.company === "IRFC")!;
    const qualityOla = quality.find((holding) => holding.company === "OLA Electric Mobility")!;
    const qualityIrfc = quality.find((holding) => holding.company === "IRFC")!;

    expect(impactOla.visuals.colorNorm).toBeLessThan(impactIrfc.visuals.colorNorm);
    expect(impactOla.visuals.impactNorm).toBeGreaterThan(impactIrfc.visuals.impactNorm);
    expect(qualityIrfc.visuals.colorNorm).toBeLessThan(qualityOla.visuals.colorNorm);
    for (const company of ["OLA Electric Mobility", "IRFC", "Infosys", "Jupiter Wagons"]) {
      expect(quality.find((holding) => holding.company === company)?.eligibleForTaxLoss).toBe(true);
    }
  });
});
