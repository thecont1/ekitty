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
    expect(parsed.error).toBe("Row 2 has an invalid buy quantity.");
  });

  it("rejects the entire CSV when a later row is truncated", () => {
    const parsed = parsePortfolioCsv([
      "company,buy_qty,avg_price,current_price,buy_date",
      "Alpha,2,100,120,2025-06-01",
      "Whirlpool,3,1000,900,2025-06-",
    ].join("\n"));

    expect(parsed.records).toEqual([]);
    expect(parsed.error).toBe("Row 3 has an invalid buy date.");
  });

  it("rejects malformed rows instead of silently accepting a valid prefix", () => {
    const invalidRequiredValue = parsePortfolioCsv([
      "company,buy_qty,avg_price,current_price",
      "Alpha,2,100,120",
      "Beta,not-a-number,80,90",
    ].join("\n"));
    const numericPrefixWithJunk = parsePortfolioCsv([
      "company,buy_qty,avg_price,current_price",
      "Alpha,2,100,120",
      "Beta,12oops,80,90",
    ].join("\n"));
    const malformedThousands = parsePortfolioCsv([
      "company,buy_qty,avg_price,current_price",
      "Alpha,2,100,120",
      'Beta,"12,34",80,90',
    ].join("\n"));
    const missingCell = parsePortfolioCsv([
      "company,buy_qty,avg_price,current_price",
      "Alpha,2,100,120",
      "Beta,1,80",
    ].join("\n"));
    const unclosedQuote = parsePortfolioCsv([
      "company,buy_qty,avg_price,current_price",
      "Alpha,2,100,120",
      '"Beta,1,80,90',
    ].join("\n"));
    const strayQuote = parsePortfolioCsv([
      "company,buy_qty,avg_price,current_price",
      "Alpha,2,100,120",
      'Be"ta,1,80,90',
    ].join("\n"));
    const textAfterClosingQuote = parsePortfolioCsv([
      "company,buy_qty,avg_price,current_price",
      "Alpha,2,100,120",
      '"Beta"x,1,80,90',
    ].join("\n"));

    expect(invalidRequiredValue.error).toBe("Row 3 has an invalid buy quantity.");
    expect(numericPrefixWithJunk.error).toBe("Row 3 has an invalid buy quantity.");
    expect(malformedThousands.error).toBe("Row 3 has an invalid buy quantity.");
    expect(missingCell.error).toBe("Row 3 has 3 columns; expected 4.");
    expect(unclosedQuote.error).toBe("Row 3 has an unclosed quoted field.");
    expect(strayQuote.error).toBe("Row 3 has malformed quote placement.");
    expect(textAfterClosingQuote.error).toBe("Row 3 has malformed quote placement.");
  });

  it("accepts a complete final row without a trailing newline", () => {
    const parsed = parsePortfolioCsv(
      "company,buy_qty,avg_price,current_price,buy_date\nAlpha,2,100,120,2025-06-01",
    );

    expect(parsed.error).toBeUndefined();
    expect(parsed.records).toHaveLength(1);
  });

  it("keeps accepting unambiguous human-readable dates", () => {
    const parsed = parsePortfolioCsv(
      'company,buy_qty,avg_price,current_price,buy_date\nAlpha,2,100,120,"Aug 1, 2025"',
    );

    expect(parsed.error).toBeUndefined();
    expect(parsed.records[0].buy_date).toBe("2025-08-01");
  });

  it("keeps accepting signed and correctly grouped formatted numbers", () => {
    const parsed = parsePortfolioCsv(
      'company,buy_qty,avg_price,current_price\nAlpha,+2,"₹1,200.50","Rs. 1,300"',
    );

    expect(parsed.error).toBeUndefined();
    expect(parsed.records[0]).toMatchObject({ buy_qty: 2, avg_price: 1200.5, current_price: 1300 });
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
