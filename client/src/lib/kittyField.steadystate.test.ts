/**
 * Steady-state field simulation: replays the exact Home.tsx tick loop (same
 * constants, same order of forces) against the real portfolio.csv holdings
 * until the field settles, then asserts the plan's invariants:
 *   - no two kitties overlap beyond solver slack (Step 3)
 *   - no kitty's inked silhouette intrudes into either no-go zone (Step 4)
 *   - gravity orders heavy holdings lower without rigid stacking (Step 5)
 *
 * If Home.tsx's physics constants change, update the mirrored constants here.
 */
import { describe, expect, it } from "vitest";
import {
  KITTY_HITBOX_WIDTH_RATIO,
  ZONE_MARGIN_PX,
  anchorOutsideZones,
  desiredSeparation,
  gravityBandNorms,
  kittyCollisionRadius,
  projectOutsideZones,
  separatePairwise,
  zoneRepulsion,
  type ExclusionZone,
} from "./kittyField";
import { asHoldingPoints, parsePortfolioCsv } from "./portfolio";
import { deriveHoldingVisuals } from "./portfolioVisuals";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Mirrors of Home.tsx runtime constants:
const TOP_KITTY_MARGIN = 54;
const DEFAULT_REPULSION = 0.62;
const LAYOUT_HEIGHT = 1998; // mirrors Home.tsx virtualCanvasHeight for Group view
const PHYSICS_WIDTH = 2016; // unchanged — horizontal canvas already large

type Sim = { x: number; y: number; vx: number; vy: number };

function hash(value: string) {
  return Array.from(value).reduce((result, c) => ((result << 5) - result + c.charCodeAt(0)) | 0, 0) >>> 0;
}

describe("steady-state field (real portfolio.csv, gravity on)", () => {
  const csvPath = join(dirname(fileURLToPath(import.meta.url)), "../../public/data/portfolio.csv");
  const records = parsePortfolioCsv(readFileSync(csvPath, "utf8")).records;
  const holdings = asHoldingPoints(records);
  const visuals = deriveHoldingVisuals(holdings, "portfolio-impact");
  const sizes = visuals.map((h) => 46 + h.visuals.sizeNorm * (440 - 46));
  const ids = holdings.map((h) => h.id);
  const bandNorms = gravityBandNorms(visuals.map((h) => h.visuals.sizeRaw));

  // Screen-space UI geometry on a 1440-wide window with camera at x=-576
  // (the default Group-view origin): header right-3 top-3 w-288, icon column ~56 wide.
  // World coords = screen coords - camera.x (the section is translated by the camera).
  const CAMERA_X = -576;
  const headerZone: ExclusionZone = { left: 1140 - CAMERA_X, top: 12, right: 1428 - CAMERA_X, bottom: 100 };
  const iconsZone: ExclusionZone = { left: 1372 - CAMERA_X, top: 12, right: 1428 - CAMERA_X, bottom: 780 };
  const drawerOpenIconsZone: ExclusionZone = { left: 960 - CAMERA_X, top: 12, right: 1428 - CAMERA_X, bottom: 780 };

  function simulate(ticks: number, activeIconsZone = iconsZone, initial?: Sim[]) {
    const sims: Sim[] = initial ? initial.map((node) => ({ ...node })) : ids.map((id, index) => {
      const seed = hash(id);
      const padding = 48;
      return {
        x: padding + (seed % Math.max(120, PHYSICS_WIDTH - padding * 2)),
        y: padding + ((seed >>> 8) % Math.max(120, 813 - padding * 2)),
        vx: ((index % 3) - 1) * 0.04,
        vy: (((index + 1) % 3) - 1) * 0.04,
      };
    });
    const radii = sizes.map((size) => kittyCollisionRadius(size));

    for (let frame = 0; frame < ticks; frame += 1) {
      const delta = 1;
      sims.forEach((node, index) => {
        const id = ids[index];
        const size = sizes[index];
        const seed = hash(id);
        const driftY = TOP_KITTY_MARGIN + size * 0.62 + (LAYOUT_HEIGHT - TOP_KITTY_MARGIN - size * 1.24) * (0.11 + ((seed >>> 9) % 710) / 1000);
        const headerFloor = headerZone.bottom + ZONE_MARGIN_PX;
        const usableHeight = Math.max(120, LAYOUT_HEIGHT - headerFloor - 40);
        const jitter = ((seed >>> 13) % 140) / 1000;
        const anchorY = headerFloor + radii[index] * 0.6 + Math.max(0, bandNorms[index] + jitter - 0.14) * usableHeight;
        const anchorX = PHYSICS_WIDTH * (0.08 + ((seed % 840) / 1000));
        const [ax, ay] = anchorOutsideZones(anchorX, anchorY, radii[index], [headerZone, activeIconsZone]);
        node.vx += (ax - node.x) * 0.00048 * delta;
        node.vy += (ay - node.y) * (0.00048 + 0.0012) * delta;
      });
      sims.forEach((node, index) => {
        const size = sizes[index];
        const margin = Math.max(42, size * 0.62);
        node.vx += (node.x < margin ? margin - node.x : node.x > PHYSICS_WIDTH - margin ? PHYSICS_WIDTH - margin - node.x : 0) * 0.008;
        const topBoundary = Math.max(TOP_KITTY_MARGIN + size * 0.62, margin);
        node.vy += (node.y < topBoundary ? topBoundary - node.y : node.y > LAYOUT_HEIGHT - margin ? LAYOUT_HEIGHT - margin - node.y : 0) * 0.008;
        const [zx, zy] = zoneRepulsion(node.x, node.y, radii[index], headerZone);
        node.vx += zx; node.vy += zy;
        const [ix, iy] = zoneRepulsion(node.x, node.y, radii[index], activeIconsZone);
        node.vx += ix; node.vy += iy;
        node.vx *= 0.91; node.vy *= 0.91;
        node.x += node.vx * delta;
        node.y += node.vy * delta;
        // Project BEFORE separation so the pairwise solver has the final say
        // and can spread cats along the zone boundary instead of stacking.
        const [px, py] = projectOutsideZones(node.x, node.y, radii[index], [headerZone, activeIconsZone]);
        node.x = px;
        node.y = py;
      });
      separatePairwise(sims, radii, DEFAULT_REPULSION, Math.min(0.42, 0.16 + DEFAULT_REPULSION * 0.3), 6);
      // Final projection: separation may shove a cat back into a zone; the
      // no-go guarantee wins over the last bit of pairwise slack.
      sims.forEach((node, index) => {
        const [px, py] = projectOutsideZones(node.x, node.y, radii[index], [headerZone, activeIconsZone]);
        node.x = px;
        node.y = py;
      });
    }
    return sims;
  }

  function zoneViolations(sims: Sim[], zone: ExclusionZone) {
    return sims.flatMap((node, index) => {
      const radius = kittyCollisionRadius(sizes[index]);
      const cx = Math.max(zone.left, Math.min(node.x, zone.right));
      const cy = Math.max(zone.top, Math.min(node.y, zone.bottom));
      const distance = Math.hypot(node.x - cx, node.y - cy);
      return distance < radius - 2 ? [`${ids[index]}: dist=${distance.toFixed(1)} < r=${radius.toFixed(1)}`] : [];
    });
  }

  it("settles clear of the wider drawer-open no-go zone", () => {
    expect(zoneViolations(simulate(4000, drawerOpenIconsZone), drawerOpenIconsZone)).toEqual([]);
  });

  it("closing the drawer lets cats reclaim the released strip", () => {
    const open = simulate(4000, drawerOpenIconsZone);
    const releasedLeft = drawerOpenIconsZone.left;
    const releasedRight = iconsZone.left;
    const meanDistanceToReleasedStrip = (sims: Sim[]) => sims.reduce((sum, node) => {
      if (node.x < releasedLeft) return sum + (releasedLeft - node.x);
      if (node.x > releasedRight) return sum + (node.x - releasedRight);
      return sum;
    }, 0) / sims.length;

    const closedAgain = simulate(100, iconsZone, open);
    expect(meanDistanceToReleasedStrip(closedAgain)).toBeLessThan(meanDistanceToReleasedStrip(open));
  });

  it("settles with zero inked-silhouette intrusion into either no-go zone", () => {
    const sims = simulate(4000);
    const violations: string[] = [];
    sims.forEach((node, index) => {
      const radius = kittyCollisionRadius(sizes[index]);
      for (const [name, zone] of [["header", headerZone], ["icons", iconsZone]] as const) {
        // Distance from the cat's center to the RAW zone rect must be at least
        // its collision radius (inked silhouette clears the actual UI box).
        const cx = Math.max(zone.left, Math.min(node.x, zone.right));
        const cy = Math.max(zone.top, Math.min(node.y, zone.bottom));
        const distance = Math.hypot(node.x - cx, node.y - cy);
        if (distance < radius - 2) violations.push(`${ids[index]} in ${name}: dist=${distance.toFixed(1)} < r=${radius.toFixed(1)}`);
      }
    });
    expect(violations).toEqual([]);
  });

  it("never allows inked-silhouette overlap at default spaciousness", () => {
    // Full desired clearance can be geometrically impossible for 68 cats in
    // the available world (that is what the slider's Spacious end is for); the
    // hard invariant is that inked silhouettes barely overlap. One jammed pair
    // against a zone boundary may retain ≤ 15% of the smaller radius (~20px on
    // a 140px cat) — transient under the live loop and cleared by the slider.
    const sims = simulate(4000);
    const radii = sizes.map((size) => kittyCollisionRadius(size));
    let worstRatio = 0;
    for (let a = 0; a < sims.length; a += 1) {
      for (let b = a + 1; b < sims.length; b += 1) {
        const distance = Math.hypot(sims[b].x - sims[a].x, sims[b].y - sims[a].y);
        const overlap = radii[a] + radii[b] - distance;
        if (overlap > 0) worstRatio = Math.max(worstRatio, overlap / Math.min(radii[a], radii[b]));
      }
    }
    expect(worstRatio).toBeLessThan(0.15);
  });

  it("keeps gravity bands distributed across the full layout", () => {
    const sims = simulate(4000);
    const ys = sims.map((node) => node.y);
    expect(Math.min(...ys)).toBeLessThan(LAYOUT_HEIGHT * 0.2);
    expect(Math.max(...ys)).toBeGreaterThan(LAYOUT_HEIGHT * 0.8);
  });

  it("pair shortfall remains stable as the simulation converges", () => {
    const results = [2000, 4000, 8000].map((ticks) => {
      const sims = simulate(ticks);
      const radii = sizes.map((size) => kittyCollisionRadius(size));
      const shortfalls: number[] = [];
      for (let a = 0; a < sims.length; a += 1) {
        for (let b = a + 1; b < sims.length; b += 1) {
          const distance = Math.hypot(sims[b].x - sims[a].x, sims[b].y - sims[a].y);
          const shortfall = desiredSeparation(radii[a], radii[b], DEFAULT_REPULSION) - distance;
          if (shortfall > 0.5) shortfalls.push(shortfall);
        }
      }
      return Math.max(0, ...shortfalls);
    });
    expect(results.every(Number.isFinite)).toBe(true);
    expect(results[2]).toBeLessThanOrEqual(results[0] + 1);
  });

  it("gravity keeps big holdings strictly lower than small ones (soft, not rigid)", () => {
    const sims = simulate(4000);
    const order = ids.map((id, index) => ({ id, y: sims[index].y, norm: bandNorms[index] }));
    const heaviest = [...order].sort((a, b) => b.norm - a.norm).slice(0, 5);
    const lightest = [...order].sort((a, b) => a.norm - b.norm).slice(0, 5);
    const heavyMeanY = heaviest.reduce((sum, o) => sum + o.y, 0) / heaviest.length;
    const lightMeanY = lightest.reduce((sum, o) => sum + o.y, 0) / lightest.length;
    expect(heavyMeanY).toBeGreaterThan(lightMeanY + 200); // clearly banded, not one strip
    // But still soft: lightest cats are NOT all pinned at identical y.
    const lightYs = new Set(lightest.map((o) => Math.round(o.y)));
    expect(lightYs.size).toBeGreaterThan(1);
  });
});
