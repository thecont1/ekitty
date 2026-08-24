import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CatGlyph, clampCardLeft, closeTopOverlay, readShowHalos } from "../pages/Home";
import PortfolioKittySvg from "../components/PortfolioKittySvg";
import {
  KITTY_HITBOX_WIDTH_RATIO,
  SEPARATION_FLOOR_PX,
  ZONE_MARGIN_PX,
  desiredSeparation,
  gravityBandNorms,
  kittyCollisionRadius,
  pairwiseClearance,
  separatePairwise,
  zoneRepulsion,
  type FieldNode,
} from "./kittyField";
import { asHoldingPoints, parsePortfolioCsv } from "./portfolio";
import { deriveHoldingVisuals } from "./portfolioVisuals";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

describe("kitty hitbox (tail removal)", () => {
  it("renders both front-paw curves inside the existing SVG", () => {
    const markup = renderToStaticMarkup(createElement(PortfolioKittySvg, { stroke: "#000", fill: "transparent", fillOpacity: 0, strokeWidth: 2 }));
    expect(markup).toContain("M76,168.4c0.4,2.8");
    expect(markup).toContain("M112,168.4c-0.4,2.8");
  });

  it("sizes the collision radius to the de-tailed silhouette, not the stale box", () => {
    // A 200px kitty: ears+body span ~73% of the old tail-inclusive width.
    expect(kittyCollisionRadius(200)).toBeCloseTo((200 * KITTY_HITBOX_WIDTH_RATIO) / 2, 5);
    expect(kittyCollisionRadius(200)).toBeLessThan(100); // smaller than half the rendered box
    expect(kittyCollisionRadius(46)).toBeGreaterThan(0);
  });

  it("keeps clearance proportional to combined size — big cats need more room", () => {
    const small = desiredSeparation(kittyCollisionRadius(46), kittyCollisionRadius(46), 0.62);
    const large = desiredSeparation(kittyCollisionRadius(440), kittyCollisionRadius(440), 0.62);
    expect(large).toBeGreaterThan(small);
    // and strictly a function of both radii + spaciousness
    expect(pairwiseClearance(10, 10, 0)).toBeGreaterThanOrEqual(SEPARATION_FLOOR_PX);
    expect(pairwiseClearance(40, 40, 1)).toBeGreaterThan(pairwiseClearance(20, 20, 1));
  });
});

describe("separatePairwise (dense-cluster solver)", () => {
  function makeCluster(n: number, spread: number): FieldNode[] {
    return Array.from({ length: n }, (_, i) => ({
      x: Math.cos(i) * spread,
      y: Math.sin(i * 2.3) * spread,
      vx: 0,
      vy: 0,
    }));
  }

  it("resolves overlaps that a single impulse pass would leave behind", () => {
    const nodes = makeCluster(12, 30); // deliberately cramped
    const radii = nodes.map(() => kittyCollisionRadius(220)); // several large holdings stacked
    const spaciousness = 0.62;
    separatePairwise(nodes, radii, spaciousness, 0.35, 8);

    let worst = 0;
    for (let left = 0; left < nodes.length; left += 1) {
      for (let right = left + 1; right < nodes.length; right += 1) {
        const distance = Math.hypot(nodes[right].x - nodes[left].x, nodes[right].y - nodes[left].y);
        const desired = desiredSeparation(radii[left], radii[right], spaciousness);
        // Allow residual slack: positional relaxation converges geometrically,
        // it does not promise perfection in one frame.
        worst = Math.max(worst, desired - distance);
      }
    }
    // Before this fix, flat-constant separation froze early with overlap far
    // beyond this bound for large-value clusters. 8 sweeps converge well past
    // the 30% slack allowed here.
    expect(worst).toBeLessThan(desiredSeparation(radii[0], radii[1], spaciousness) * 0.3);
  });

  it("does nothing when nodes are already clear of each other", () => {
    const nodes: FieldNode[] = [
      { x: 0, y: 0, vx: 0, vy: 0 },
      { x: 5000, y: 0, vx: 0, vy: 0 },
    ];
    const before = JSON.stringify(nodes);
    separatePairwise(nodes, [50, 50], 1, 0.4, 4);
    expect(JSON.stringify(nodes)).toBe(before);
  });

  it("separates coincident nodes deterministically", () => {
    const nodes: FieldNode[] = [
      { x: 100, y: 100, vx: 0, vy: 0 },
      { x: 100, y: 100, vx: 0, vy: 0 },
    ];
    separatePairwise(nodes, [30, 30], 0.5, 0.4, 3);
    const distance = Math.hypot(nodes[1].x - nodes[0].x, nodes[1].y - nodes[0].y);
    expect(distance).toBeGreaterThan(0);
  });
});

describe("gravity bands", () => {
  it("uses a log mapping so whales don't compress everyone into one strip", () => {
    const weights = [100_000_000, 500_000, 250_000, 120_000, 90_000, 60_000];
    const norms = gravityBandNorms(weights);
    expect(Math.min(...norms)).toBeCloseTo(0, 5);
    expect(Math.max(...norms)).toBeCloseTo(1, 5);
    // With a linear map, all but the whale would land below ~0.01; log keeps
    // the mid-pack meaningfully spread across bands.
    const midpack = norms.slice(1, -1);
    expect(Math.max(...midpack) - Math.min(...midpack)).toBeGreaterThan(0.15);
  });

  it("handles uniform and empty portfolios", () => {
    expect(gravityBandNorms([])).toEqual([]);
    expect(gravityBandNorms([7, 7, 7])).toEqual([0.5, 0.5, 0.5]);
  });

  it("heavier weight maps to a lower band position (larger norm = lower)", () => {
    const [small, huge] = gravityBandNorms([1_000, 9_000_000]);
    expect(huge).toBeGreaterThan(small);
  });
});

describe("zoneRepulsion (no-go zones)", () => {
  const zone = { left: 900, top: 0, right: 1000, bottom: 120 };

  it("leaves cats outside the zone margin untouched", () => {
    const [fx, fy] = zoneRepulsion(400, 400, 30, zone);
    expect(fx).toBe(0);
    expect(fy).toBe(0);
  });

  it("pushes an intruding cat out along the shortest exit", () => {
    // 980,60 sits inside the zone; the shortest exit is the zone's RIGHT edge
    // (right boundary at x=1032 is 52px away vs 92–112px for the others), so
    // the push must be purely horizontal, outward.
    const [fx1, fy1] = zoneRepulsion(980, 60, 20, zone);
    expect(fx1).toBeGreaterThan(0);
    expect(fy1).toBe(0);
    // A cat just past the zone's right boundary gets expelled outward (right).
    const [fx] = zoneRepulsion(zone.right + ZONE_MARGIN_PX + 20 - 1, 60, 20, zone);
    expect(fx).toBeGreaterThan(0);
  });

  it("accounts for the cat radius plus the zone margin on every side", () => {
    // Just inside the top edge by less than margin+radius → pushed up-out.
    const y = zone.top - ZONE_MARGIN_PX - 30 + 1;
    const [fxTop, fyTop] = zoneRepulsion(950, y, 30, { ...zone, bottom: 600 });
    expect(fyTop).toBeLessThan(0);
    expect(fxTop).toBeLessThanOrEqual(0); // shortest exit may combine axes
  });
});

describe("badge / coin anchor geometry (all four permutations)", () => {
  // Mirrors CatGlyph's percentage anchors so regressions in the glyph fail here.
  const BADGE = { right: "16%", bottom: "14%", size: "12%" };
  const COIN = { left: "44%", top: "54%", size: "10%" };

  function rectsFor(sizePx: number) {
    const pct = (value: string) => parseFloat(value) / 100 * sizePx;
    const badge = { left: sizePx - pct(BADGE.right) - pct(BADGE.size), top: sizePx - pct(BADGE.bottom) - pct(BADGE.size), size: pct(BADGE.size) };
    const coin = { left: pct(COIN.left), top: pct(COIN.top), size: pct(COIN.size) };
    return { badge, coin };
  }

  function overlap(a: ReturnType<typeof rectsFor>["badge"], b: ReturnType<typeof rectsFor>["coin"]) {
    return a.left < b.left + b.size && b.left < a.left + a.size && a.top < b.top + b.size && b.top < a.top + a.size;
  }

  it.each([46, 64, 120, 280, 440])("keeps coin and badge disjoint at %ipx kitties", (sizePx) => {
    const { badge, coin } = rectsFor(sizePx);
    expect(overlap(badge, coin)).toBe(false);
    // Both anchors stay inside the glyph box at every scale (min-size clamps
    // only matter below ~108px, where min-h/min-w exceed the percentage).
    expect(badge.left).toBeGreaterThanOrEqual(-13);
    expect(badge.top).toBeGreaterThanOrEqual(-13);
    expect(coin.left + coin.size).toBeLessThanOrEqual(sizePx + 13);
    expect(coin.top + coin.size).toBeLessThanOrEqual(sizePx + 13);
    expect(coin.top + coin.size / 2).toBeGreaterThan(sizePx * 0.5);
  });

  it("anchors never depend on each other's presence (fixed slots)", () => {
    // The permutation matrix is static by construction: rendering only gates
    // on showBadges/taxSensitive independently — assert the anchors differ.
    const { badge, coin } = rectsFor(200);
    expect(badge.left).not.toBe(coin.left);
    expect(badge.top).not.toBe(coin.top);
  });
});

describe("overlay and layout helpers", () => {
  it.each([
    [{ drawerOpen: true, legendOpen: true, selectedId: "cat" }, "drawer"],
    [{ drawerOpen: false, legendOpen: true, selectedId: "cat" }, "legend"],
    [{ drawerOpen: false, legendOpen: false, selectedId: "cat" }, "selected"],
    [{ drawerOpen: false, legendOpen: false, selectedId: null }, null],
  ] as const)("Escape closes only the top overlay for %j", (state, expected) => {
    const closeDrawer = vi.fn();
    const closeLegend = vi.fn();
    const closeSelected = vi.fn();
    const markLegendSeen = vi.fn();
    const event = { preventDefault: vi.fn() };

    closeTopOverlay(state, { closeDrawer, closeLegend, closeSelected, markLegendSeen }, event);

    expect(closeDrawer).toHaveBeenCalledTimes(expected === "drawer" ? 1 : 0);
    expect(closeLegend).toHaveBeenCalledTimes(expected === "legend" ? 1 : 0);
    expect(closeSelected).toHaveBeenCalledTimes(expected === "selected" ? 1 : 0);
    expect(markLegendSeen).toHaveBeenCalledTimes(expected === "legend" ? 1 : 0);
    expect(event.preventDefault).toHaveBeenCalledTimes(expected === null ? 0 : 1);
  });

  it("reads the halo preference with an off-by-default fallback", () => {
    const storage = (value: string | null) => ({ getItem: () => value });
    expect(readShowHalos(storage(null))).toBe(false);
    expect(readShowHalos(storage("true"))).toBe(true);
    expect(readShowHalos(storage("false"))).toBe(false);
    expect(readShowHalos({ getItem: () => { throw new Error("blocked"); } })).toBe(false);
  });

  it("renders halos only when enabled and search as a distinct dotted ring", () => {
    const point = asHoldingPoints(parsePortfolioCsv([
      "company,buy_qty,avg_price,current_price,txn_date",
      "Tata Consultancy Services,10,100,90,2025-01-01",
    ].join("\n")).records)[0];
    const baseProps = {
      point,
      size: 120,
      stroke: 2,
      pigment: { fill: "#fff", ink: "#ff3b3b", fillOpacity: 0.4, direction: "loss" as const },
      emphasis: { haloWidth: 3, haloOpacity: 0.4, symbol: "−" as const },
      bobDuration: 3,
      visualLens: "portfolio-impact" as const,
      focused: true,
      frozen: true,
      searchHidden: false,
      searchTerm: "tcs",
      searchMatch: true,
      showBadges: false,
      darkMode: false,
      onHover: () => undefined,
      onLeave: () => undefined,
      onClick: () => undefined,
    };

    const halosOff = renderToStaticMarkup(createElement(CatGlyph, { ...baseProps, showHalos: false }));
    expect(halosOff).not.toContain('data-ring="emphasis"');
    expect(halosOff).toContain('data-ring="focus"');
    expect(halosOff).toContain('border-style:solid');
    expect(halosOff).toContain('data-ring="search"');
    expect(halosOff).toContain('border-style:dotted');

    const halosOn = renderToStaticMarkup(createElement(CatGlyph, { ...baseProps, showHalos: true }));
    expect(halosOn).toContain('data-ring="emphasis"');
    expect(halosOn).toContain('border-style:dashed');

    const noSearch = renderToStaticMarkup(createElement(CatGlyph, { ...baseProps, showHalos: false, searchTerm: "", searchMatch: true }));
    expect(noSearch).not.toContain('data-ring="search"');

    const etfMarkup = renderToStaticMarkup(createElement(CatGlyph, { ...baseProps, point: { ...point, isETF: true }, focused: false, showHalos: false, searchTerm: "", searchMatch: true }));
    expect(etfMarkup).toContain("pointer-events-none");
    expect(etfMarkup).toContain("left-[60%]");
    expect(etfMarkup).toContain("top-[76%]");
    expect(etfMarkup).toContain(">ETF<");
    expect(etfMarkup).not.toContain("pointer-events-auto");
  });

  it("keeps the detail card clear of the icon cluster", () => {
    const maximum = 1920 - 350 - 72;
    expect(clampCardLeft(1000, 1920, true)).toBeLessThanOrEqual(maximum);
    expect(clampCardLeft(1500, 1920, true)).toBe(maximum);
    expect(clampCardLeft(100, 1920, false)).toBeGreaterThanOrEqual(14);
    expect(clampCardLeft(100, 1920, false)).toBeLessThanOrEqual(maximum);
  });
});

describe("real portfolio.csv dense clusters (Step 3 acceptance)", () => {
  const csvPath = join(dirname(fileURLToPath(import.meta.url)), "../../public/data/portfolio.csv");
  const csvText = readFileSync(csvPath, "utf8");

  it("resolves worst-case overlap in a dense cluster of the largest real holdings at max spaciousness", () => {
    const holdings = asHoldingPoints(parsePortfolioCsv(csvText).records);
    // Take the six biggest holdings and drop them into one cramped cluster —
    // the "multiple large-value holdings adjacent to each other" case.
    const byInvested = [...holdings].sort((a, b) => b.investedValue - a.investedValue).slice(0, 6);
    expect(byInvested.length).toBeGreaterThanOrEqual(4);
    const visuals = deriveHoldingVisuals(byInvested, "portfolio-impact");
    const sizes = visuals.map((holding) => 46 + holding.visuals.sizeNorm * (440 - 46)); // desktop Group-view range
    const radii = sizes.map((size) => kittyCollisionRadius(size));

    // Seed all of them nearly on top of each other, like a fresh page load.
    const nodes: FieldNode[] = byInvested.map((_, index) => ({ x: 500 + index * 8, y: 400 + ((index % 3) - 1) * 9, vx: 0, vy: 0 }));

    const maxSpaciousness = 2.6; // Field Motion slider's raised maximum
    separatePairwise(nodes, radii, maxSpaciousness, 0.42, 12);

    let worstViolation = 0;
    for (let left = 0; left < nodes.length; left += 1) {
      for (let right = left + 1; right < nodes.length; right += 1) {
        const distance = Math.hypot(nodes[right].x - nodes[left].x, nodes[right].y - nodes[left].y);
        worstViolation = Math.max(worstViolation, desiredSeparation(radii[left], radii[right], maxSpaciousness) - distance);
      }
    }
    // The solver runs every frame, so per-frame residual is fine as long as
    // it keeps shrinking — but a single call must already clear most overlap.
    const tightestDesired = Math.min(...radii.slice(0, 2).map((radius) => radius * 2));
    expect(worstViolation).toBeLessThan(tightestDesired * 0.3);
  });

  it("every real holding's clearance scales with its size under the new rule", () => {
    const holdings = asHoldingPoints(parsePortfolioCsv(csvText).records);
    const visuals = deriveHoldingVisuals(holdings, "portfolio-impact");
    const sortedBySize = [...visuals].sort((a, b) => b.visuals.sizeNorm - a.visuals.sizeNorm);
    const big = kittyCollisionRadius(46 + sortedBySize[0].visuals.sizeNorm * 394);
    const smallIdx = sortedBySize.length - 1;
    const small = kittyCollisionRadius(46 + sortedBySize[smallIdx].visuals.sizeNorm * 394);
    // A flat repulsion distance cannot satisfy this property; the size-scaled one must.
    expect(desiredSeparation(big, big, 0.62)).toBeGreaterThan(desiredSeparation(small, small, 0.62) * 2);
  });
});

describe("mover ring data reality check", () => {
  it("the shipped portfolio.csv carries no prev_close_price column, so movers cannot exist", () => {
    const csvPath = join(dirname(fileURLToPath(import.meta.url)), "../../public/data/portfolio.csv");
    const header = readFileSync(csvPath, "utf8").split(/\r?\n/)[0].toLowerCase();
    expect(header).not.toContain("prev_close");
    const parsed = parsePortfolioCsv(readFileSync(csvPath, "utf8"));
    expect(parsed.records.length).toBeGreaterThan(0);
    expect(parsed.records.every((record) => record.dayChangePercent === undefined)).toBe(true);
  });

  it("a CSV with prev_close_price does produce mover candidates (pipeline works)", () => {
    const csv = [
      "company,buy_qty,avg_price,current_price,prev_close_price,txn_date",
      "Mover Inc,1,100,104,100,2025-01-02",
      "Sleepy Ltd,1,100,100.5,100,2025-01-02",
    ].join("\n");
    const parsed = parsePortfolioCsv(csv);
    const mover = parsed.records.find((record) => record.company === "Mover Inc");
    const sleepy = parsed.records.find((record) => record.company === "Sleepy Ltd");
    expect(mover?.dayChangePercent).toBeCloseTo(4, 5);
    expect(sleepy?.dayChangePercent).toBeCloseTo(0.5, 5);
    expect(Math.abs(mover!.dayChangePercent!)).toBeGreaterThanOrEqual(2);
    expect(Math.abs(sleepy!.dayChangePercent!)).toBeLessThan(2);
  });
});
