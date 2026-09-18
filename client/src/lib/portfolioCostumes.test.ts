import { describe, expect, it } from "vitest";
import { asHoldingPoints, asTransactionPoints, type PortfolioLot, type PortfolioPoint } from "./portfolio";
import { COSTUME_ORDER, COSTUME_LEGEND, deriveCostumeStates, portfolioShare, hasCompleteDayChange, type PortfolioView } from "./portfolioCostumes";

const lot: PortfolioLot = { id: "one", company: "One", buy_qty: 1, avg_price: 100, current_price: 105, prev_close_price: 105 };
const point = (patch: Partial<PortfolioPoint> = {}) => ({ ...asTransactionPoints([lot])[0], ...patch });
const derive = (p: PortfolioPoint, view: PortfolioView = "holdings") => deriveCostumeStates(p, view, [p, point({ id: "other", currentValue: 10000, investedValue: 10000 })]);

describe("costume facts", () => {
  it("defines twelve one-word labels and explicit scopes", () => {
    expect(COSTUME_ORDER).toHaveLength(12);
    for (const id of COSTUME_ORDER) expect(COSTUME_LEGEND[id].label).toMatch(/^\w+$/);
    expect(COSTUME_LEGEND.monopoly.transactions).toBeNull();
    expect(COSTUME_LEGEND.firefighter.holdings).toBeNull();
    expect(COSTUME_LEGEND.patchwork.transactions).toBeNull();
  });

  for (const view of ["holdings", "transactions"] as const) {
    it(`${view}: inclusive financial boundaries`, () => {
      for (const [value, id] of [[-25, "wounded"], [50, "strutting"], [-1, "tightrope"], [1, "tightrope"]] as const) expect(derive(point({ pnlPercent: value }), view).eligible).toContain(id);
      for (const [value, id] of [[-24.999, "wounded"], [49.999, "strutting"], [1.001, "tightrope"]] as const) expect(derive(point({ pnlPercent: value }), view).eligible).not.toContain(id);
      expect(derive(point({ dayChangePercent: 2 }), view).eligible).toContain("rocket");
      expect(derive(point({ dayChangePercent: -2 }), view).eligible).toContain("parachute");
      expect(derive(point({ dayChangePercent: 1.999 }), view).eligible).not.toContain("rocket");
    });

    it(`${view}: missing data is never a fabricated fact`, () => {
      const p = point({ lots: [{ ...lot, prev_close_price: undefined }], ageDays: undefined, dayChangePercent: 99 });
      expect(hasCompleteDayChange(p)).toBe(false);
      expect(derive(p, view).eligible).toContain("fog");
      for (const id of ["rocket", "fledgling", "veteran"]) expect(derive(p, view).eligible).not.toContain(id);
      expect(hasCompleteDayChange(point({ lots: [{ ...lot, prev_close_price: Infinity }] }))).toBe(false);
      expect(derive(point({ investedValue: 0, pnlPercent: -40 }), view).eligible).not.toContain("wounded");
    });

    it(`${view}: age, priority, stacking and purity`, () => {
      const p = point({ pnlPercent: -40, ageDays: 900, isETF: true });
      const before = structuredClone(p);
      expect(derive(p, view).layers).toEqual(["wounded", "basket"]);
      expect(p).toEqual(before);
      expect(derive(point({ ageDays: 730 }), view).eligible).toContain("veteran");
      expect(derive(point({ ageDays: 729 }), view).eligible).not.toContain("veteran");
      expect(derive(point({ ageDays: 29, lots: [{ ...lot, buy_date: "2026-09-01" }] }), view).eligible).toContain("fledgling");
      expect(derive(point({ ageDays: 30, lots: [{ ...lot, buy_date: "2026-09-01" }] }), view).eligible).not.toContain("fledgling");
    });
  }

  it("separates concentration from purchase size", () => {
    const p = point({ currentValue: 20, investedValue: 10 });
    const peers = [p, point({ currentValue: 80, investedValue: 90 })];
    expect(deriveCostumeStates(p, "holdings", peers).eligible).toContain("monopoly");
    expect(deriveCostumeStates(p, "holdings", peers).eligible).not.toContain("firefighter");
    expect(deriveCostumeStates(p, "transactions", peers).eligible).toContain("firefighter");
    expect(deriveCostumeStates(p, "transactions", peers).eligible).not.toContain("monopoly");
    expect(portfolioShare(p, [p, point({ currentValue: -1 })], "currentValue")).toBeUndefined();
    expect(portfolioShare(p, [], "currentValue")).toBeUndefined();
  });

  it("holding mixture and partial coverage differ from purchases", () => {
    const lots = [{ ...lot, current_price: 150 }, { ...lot, id: "two", current_price: 60, prev_close_price: undefined }];
    const h = asHoldingPoints(lots)[0];
    const tx = asTransactionPoints(lots);
    expect(derive(h).eligible).toContain("patchwork");
    expect(hasCompleteDayChange(h)).toBe(false);
    for (const p of tx) expect(derive(p, "transactions").eligible).not.toContain("patchwork");
    expect(hasCompleteDayChange(tx[0])).toBe(true);
    expect(hasCompleteDayChange(tx[1])).toBe(false);
    expect(derive(point({ ageDays: 5, lots: [{ ...lot, buy_date: "2026-09-01" }, lot] })).eligible).not.toContain("fledgling");
  });
});
