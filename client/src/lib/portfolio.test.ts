import { describe, expect, it } from "vitest";
import {
  asHoldingPoints,
  computePortfolioStats,
  parsePortfolioCsv,
  pointScaleValue,
  type PortfolioLot,
  type PortfolioPoint,
} from "./portfolio";

const lots: PortfolioLot[] = [
  {
    id: "alpha-1",
    company: "Alpha",
    buy_qty: 2,
    avg_price: 100,
    current_price: 120,
    prev_close_price: 115,
    dayChange: 5,
    dayChangePercent: (5 / 115) * 100,
  },
  {
    id: "alpha-2",
    company: "Alpha",
    buy_qty: 3,
    avg_price: 80,
    current_price: 70,
    prev_close_price: 75,
    dayChange: -5,
    dayChangePercent: (-5 / 75) * 100,
  },
  {
    id: "beta-1",
    company: "Beta",
    buy_qty: 1,
    avg_price: 50,
    current_price: 50,
  },
];

describe("parsePortfolioCsv", () => {
  it("parses previous close and derives per-share day change", () => {
    const parsed = parsePortfolioCsv(
      "company,buy_qty,avg_price,current_price,prev_close_price\nAlpha,2,100,120,115",
    );

    expect(parsed.error).toBeUndefined();
    expect(parsed.records).toHaveLength(1);
    expect(parsed.records[0]).toMatchObject({
      company: "Alpha",
      prev_close_price: 115,
      dayChange: 5,
    });
    expect(parsed.records[0].dayChangePercent).toBeCloseTo((5 / 115) * 100);
  });

  it("accepts previous-close aliases and leaves day change unavailable when the input is absent or non-positive", () => {
    const withAlias = parsePortfolioCsv(
      "symbol,qty,buy_price,ltp,previous_close\nAlpha,1,90,100,95",
    );
    const withoutPreviousClose = parsePortfolioCsv(
      "symbol,qty,buy_price,ltp\nAlpha,1,90,100",
    );
    const zeroPreviousClose = parsePortfolioCsv(
      "symbol,qty,buy_price,ltp,previous_close\nAlpha,1,90,100,0",
    );

    expect(withAlias.records[0].dayChangePercent).toBeCloseTo((5 / 95) * 100);
    expect(withoutPreviousClose.records[0].dayChange).toBeUndefined();
    expect(zeroPreviousClose.records[0].dayChange).toBeUndefined();
  });

  it("rejects blank required numeric cells instead of coercing them to zero", () => {
    const parsed = parsePortfolioCsv(
      "company,buy_qty,avg_price,current_price\nAlpha,,100,120",
    );

    expect(parsed.records).toEqual([]);
    expect(parsed.error).toBe("No usable rows were found in this file.");
  });

  it("creates stable lot IDs for identical CSV input", () => {
    const csv = "company,buy_qty,avg_price,current_price\nAlpha,2,100,120";

    expect(parsePortfolioCsv(csv).records[0].id).toBe(parsePortfolioCsv(csv).records[0].id);
  });
});

describe("computePortfolioStats", () => {
  it("returns stable zeroes and empty delta lists for an empty portfolio", () => {
    expect(computePortfolioStats([])).toEqual({
      totalInvestedValue: 0,
      totalCurrentValue: 0,
      totalUnrealizedPnl: 0,
      totalUnrealizedPnlPercent: 0,
      lotDeltas: [],
      companyDeltas: [],
    });
  });

  it("computes portfolio, per-lot, and per-company deltas without duplicating drawer math", () => {
    const stats = computePortfolioStats(lots);

    expect(stats.totalInvestedValue).toBe(490);
    expect(stats.totalCurrentValue).toBe(500);
    expect(stats.totalUnrealizedPnl).toBe(10);
    expect(stats.totalUnrealizedPnlPercent).toBeCloseTo((10 / 490) * 100);
    expect(stats.lotDeltas.map(({ id, pnl }) => ({ id, pnl }))).toEqual([
      { id: "alpha-1", pnl: 40 },
      { id: "alpha-2", pnl: -30 },
      { id: "beta-1", pnl: 0 },
    ]);
    expect(stats.companyDeltas).toHaveLength(2);
    expect(stats.companyDeltas[0]).toMatchObject({
      id: "holding-Alpha",
      company: "Alpha",
      investedValue: 440,
      currentValue: 450,
      pnl: 10,
      dayChange: -5,
    });
    expect(stats.companyDeltas[0].dayChangePercent).toBeCloseTo((-5 / 455) * 100);
    expect(stats.companyDeltas[1].dayChange).toBeUndefined();
  });
});

describe("holding aggregation and kitty scale metrics", () => {
  it("aggregates quantity-weighted previous close and day change at company level", () => {
    const alpha = asHoldingPoints(lots).find((point) => point.company === "Alpha");

    expect(alpha?.previousCloseValue).toBe(455);
    expect(alpha?.dayChange).toBe(-5);
    expect(alpha?.dayChangePercent).toBeCloseTo((-5 / 455) * 100);
  });

  it("maps every Kitty Scale option to its intended non-negative visual magnitude", () => {
    const point = {
      investedValue: 900,
      currentValue: 1_000,
      qty: 4,
      pnl: -100,
    } as PortfolioPoint;

    expect(pointScaleValue(point, "invested")).toBe(900);
    expect(pointScaleValue(point, "current")).toBe(1_000);
    expect(pointScaleValue(point, "quantity")).toBe(4);
    expect(pointScaleValue(point, "pnlMagnitude")).toBe(100);
  });
});
