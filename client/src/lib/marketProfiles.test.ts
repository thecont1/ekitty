import { describe, expect, it } from "vitest";
import {
  DEFAULT_MARKET_PROFILE,
  MARKET_PROFILES,
  formatMarketDate,
  formatMarketMoney,
  formatMarketMonth,
  formatMarketNumber,
  getMarketProfile,
  isTaxReviewLoss,
  taxReviewDescription,
} from "@shared/marketProfiles";
import { asHoldingPoints, parsePortfolioCsv, type PortfolioLot } from "./portfolio";
import { buildMrBunglesDigest } from "./mrBunglesDigest";

const { india, us, singapore, uk } = MARKET_PROFILES;

describe("market profiles", () => {
  it("defaults to India and falls back on unknown ids", () => {
    expect(DEFAULT_MARKET_PROFILE.id).toBe("india");
    expect(getMarketProfile("india").currency).toBe("INR");
    expect(getMarketProfile("lunar-credits").id).toBe("india");
    expect(getMarketProfile(null).id).toBe("india");
  });

  it("formats currency and digit grouping per market", () => {
    expect(formatMarketMoney(1234567.89, india)).toContain("12,34,568");
    expect(formatMarketMoney(1234567.89, india)).toContain("₹");
    expect(formatMarketMoney(1234567.89, us)).toContain("1,234,568");
    expect(formatMarketMoney(1234567.89, us)).toContain("$");
    expect(formatMarketMoney(1234567.89, singapore)).toContain("1,234,568");
    expect(formatMarketNumber(1234567, india)).toBe("12,34,567");
    expect(formatMarketNumber(1234567, us)).toBe("1,234,567");
  });

  it("formats dates per market locale", () => {
    expect(formatMarketDate("2025-06-01", india)).not.toBe(formatMarketDate("2025-06-01", us));
    expect(formatMarketDate("2025-06-01", uk)).toContain("2025");
    expect(formatMarketMonth(2025 * 12 + 5, india)).toContain("25");
  });

  it("scopes the aged-loss flag per market and never invents one", () => {
    expect(isTaxReviewLoss(-100, 340, india)).toBe(true);
    expect(isTaxReviewLoss(-100, 329, india)).toBe(false);
    expect(isTaxReviewLoss(-100, 340, us)).toBe(false);
    expect(isTaxReviewLoss(-100, 366, us)).toBe(true);
    expect(isTaxReviewLoss(-100, 9999, singapore)).toBe(false);
    expect(isTaxReviewLoss(-100, 9999, uk)).toBe(false);
    expect(isTaxReviewLoss(50, 9999, india)).toBe(false);
    expect(taxReviewDescription(singapore)).toContain("No age-based tax flag");
    expect(taxReviewDescription(india)).toContain("330");
  });

  it("re-dresses the tax flag on computed points", () => {
    const lots: PortfolioLot[] = [
      { id: "old-loss", company: "Gamma", buy_qty: 1, avg_price: 100, current_price: 50, buy_date: "2024-01-01" },
    ];
    expect(asHoldingPoints(lots, india)[0].taxSensitive).toBe(true);
    expect(asHoldingPoints(lots, singapore)[0].taxSensitive).toBe(false);
    expect(asHoldingPoints(lots, uk)[0].taxSensitive).toBe(false);
  });

  it("carries the market into the Mr. Bungles digest and its currency words", () => {
    const lots: PortfolioLot[] = [
      { id: "a1", company: "Alpha", buy_qty: 2, avg_price: 100, current_price: 60, buy_date: "2020-01-01" },
    ];
    const digest = buildMrBunglesDigest(asHoldingPoints(lots, us), "holdings", "portfolio-impact", { includesEtfs: true, taxFilter: "all", query: "" }, us);
    expect(digest?.market.id).toBe("us");
    expect(digest?.market.currency).toBe("USD");
    expect(digest?.directives.some(directive => directive.text.includes("$"))).toBe(true);
  });
});

describe("market-neutral CSV parsing", () => {
  const parse = (cell: string) =>
    parsePortfolioCsv(`company,buy_qty,avg_price,current_price\nBeta,${cell},80,90`);

  it("accepts currency-prefixed and lakh-grouped numbers", () => {
    for (const cell of ["1234.5", "$1234.5", '"₹1,234.5"', '"$1,234.5"', '"Rs. 1,300"', '"SGD 1,234.5"', '"1,00,000"', '"1,23,456.78"']) {
      expect(parse(cell).error, cell).toBeUndefined();
    }
    expect(parse('"1,00,000"').records?.[0].buy_qty).toBe(100000);
  });

  it("still rejects numbers that are malformed in every grouping", () => {
    for (const cell of ["12oops", '"12,34"', "not-a-number", '"1,2,3,4"']) {
      expect(parse(cell).error, cell).toBe("Row 2 has an invalid buy quantity.");
    }
  });
});
