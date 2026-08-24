/**
 * Inkfield Menagerie: field-physics geometry shared by the simulation loop
 * and its tests. Pure functions only — no React, no DOM.
 */

export type FieldNode = { x: number; y: number; vx: number; vy: number };
export type ExclusionZone = { left: number; top: number; right: number; bottom: number };
export type FieldRestState = { elapsedMs: number; quietMs: number; sleeping?: boolean };

/** Stop after 7s even when dense constraints cannot reach mathematical equilibrium. */
export const FIELD_MAX_ACTIVE_MS = 7_000;
/** Require a sustained quiet window before sleeping; one calm frame is insufficient. */
export const FIELD_QUIET_MS = 550;
/** Largest per-frame node displacement (px) still considered visually quiet. */
export const FIELD_QUIET_STEP_PX = 0.04;

export function advanceFieldRest(state: FieldRestState, elapsedMs: number, maximumStepPx: number): FieldRestState {
  const nextElapsedMs = state.elapsedMs + Math.max(0, elapsedMs);
  const nextQuietMs = maximumStepPx <= FIELD_QUIET_STEP_PX ? state.quietMs + Math.max(0, elapsedMs) : 0;
  return {
    elapsedMs: nextElapsedMs,
    quietMs: nextQuietMs,
    sleeping: nextQuietMs >= FIELD_QUIET_MS || nextElapsedMs >= FIELD_MAX_ACTIVE_MS,
  };
}

/** Remove residual kinetic/sub-pixel noise when the active simulation burst ends. */
export function settleFieldNodes(nodes: FieldNode[]) {
  nodes.forEach((node) => {
    node.x = Math.round(node.x);
    node.y = Math.round(node.y);
    node.vx = 0;
    node.vy = 0;
  });
}

/**
 * Collision footprint ratio for the de-tailed glyph.
 *
 * The tail sweep (viewBox x ≈ 147–181) was removed in favour of an
 * ears-plus-body silhouette spanning roughly three quarters of the rendered
 * box, so the hitbox tracks the smaller shape instead of the stale
 * tail-inclusive bounding box.
 */
export const KITTY_HITBOX_WIDTH_RATIO = 0.75;

/** Small constant gap (px) added on top of size-proportional clearance. */
export const SEPARATION_FLOOR_PX = 6;

/** Margin (px) added around measured UI exclusion zones. */
export const ZONE_MARGIN_PX = 12;

/** Collision radius of one kitty for a rendered box edge of `size` px. */
export function kittyCollisionRadius(size: number) {
  return (size * KITTY_HITBOX_WIDTH_RATIO) / 2;
}

/**
 * Breathing room between two kitties, proportional to their combined size.
 * Minimum separation is never a constant: a 400px holding always claims more
 * clearance than a 46px one, and the Field Motion slider stretches the gap.
 */
export function pairwiseClearance(radiusA: number, radiusB: number, spaciousness: number) {
  const combined = radiusA + radiusB;
  return combined * (0.08 + spaciousness * 0.24) + SEPARATION_FLOOR_PX;
}

export function desiredSeparation(radiusA: number, radiusB: number, spaciousness: number) {
  return radiusA + radiusB + pairwiseClearance(radiusA, radiusB, spaciousness);
}

/**
 * Positional overlap resolver. Runs `passes` relaxation sweeps; each sweep
 * pushes every overlapping pair apart by a fraction of its overlap, so dense
 * clusters keep resolving across consecutive sweeps instead of freezing early
 * with residual overlap the way a single velocity impulse per frame did.
 * Mutates the nodes in place.
 */
export function separatePairwise(
  nodes: FieldNode[],
  radii: number[],
  spaciousness: number,
  strength: number,
  passes: number,
) {
  for (let pass = 0; pass < passes; pass += 1) {
    for (let left = 0; left < nodes.length; left += 1) {
      for (let right = left + 1; right < nodes.length; right += 1) {
        const a = nodes[left];
        const b = nodes[right];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distance = Math.hypot(dx, dy);
        const desired = desiredSeparation(radii[left], radii[right], spaciousness);
        if (distance >= desired) continue;
        const normalX = distance > 0.01 ? dx / distance : 0;
        const normalY = distance > 0.01 ? dy / distance : left % 2 === 0 ? 1 : -1;
        const push = ((desired - distance) / 2) * strength;
        a.x -= normalX * push;
        a.y -= normalY * push;
        b.x += normalX * push;
        b.y += normalY * push;
      }
    }
  }
}

/**
 * Log-scaled 0..1 magnitudes for gravity band placement. The log scale keeps
 * a few huge holdings from compressing everyone else into a thin strip the
 * way a linear mapping would.
 */
export function gravityBandNorms(weights: number[]) {
  if (!weights.length) return [];
  const logs = weights.map((weight) => Math.log(Math.max(weight, 1)));
  const min = Math.min(...logs);
  const max = Math.max(...logs);
  if (max === min) return weights.map(() => 0.5);
  return logs.map((value) => Math.max(0, Math.min(1, (value - min) / (max - min))));
}

/**
 * Gentle outward push for a node near or inside an exclusion zone — the same
 * soft-force mechanism used for canvas-edge avoidance, so kitties are pushed
 * away rather than clipped or hidden. Returns the force to add to velocity.
 */
export function zoneRepulsion(
  x: number,
  y: number,
  radius: number,
  zone: ExclusionZone,
  gain = 0.008,
): [number, number] {
  const left = zone.left - ZONE_MARGIN_PX - radius;
  const right = zone.right + ZONE_MARGIN_PX + radius;
  const top = zone.top - ZONE_MARGIN_PX - radius;
  const bottom = zone.bottom + ZONE_MARGIN_PX + radius;
  if (x <= left || x >= right || y <= top || y >= bottom) return [0, 0];
  const exits: [number, number, number][] = [
    [x - left, -1, 0],
    [right - x, 1, 0],
    [y - top, 0, -1],
    [bottom - y, 0, 1],
  ];
  const [depth, normalX, normalY] = exits.reduce((nearest, entry) => (entry[0] < nearest[0] ? entry : nearest));
  return [normalX * depth * gain, normalY * depth * gain];
}

/**
 * Hard projection: if a node's center rests inside an expanded exclusion
 * zone rect, move it to the nearest point on that rect's boundary. Soft
 * repulsion alone can lose to peer pressure in dense clusters; this guarantees
 * no kitty ever rests inside a no-go zone while keeping motion organic (peers
 * shove it back out as soon as pressure eases). Returns the corrected point.
 */
export function projectOutsideZones(
  x: number,
  y: number,
  radius: number,
  zones: ExclusionZone[],
): [number, number] {
  let px = x;
  let py = y;
  for (const zone of zones) {
    const left = zone.left - ZONE_MARGIN_PX - radius;
    const right = zone.right + ZONE_MARGIN_PX + radius;
    const top = zone.top - ZONE_MARGIN_PX - radius;
    const bottom = zone.bottom + ZONE_MARGIN_PX + radius;
    if (px > left && px < right && py > top && py < bottom) {
      const exits: [number, number, number][] = [
        [px - left, left, 0],
        [right - px, right, 0],
        [py - top, top, 1],
        [bottom - py, bottom, 1],
      ];
      const [depth, edge, axis] = exits.reduce((nearest, entry) => (entry[0] < nearest[0] ? entry : nearest));
      if (axis === 0) px = edge;
      else py = edge;
    }
  }
  return [px, py];
}

/**
 * Clamp an anchor point out of every exclusion zone (expanded by the kitty's
 * radius plus margin). Anchors must never sit inside a no-go zone, otherwise
 * the anchor pull fights the zone repulsion forever and the cat settles with
 * residual intrusion. Returns the nearest allowed point; if both zones
 * compete, the header wins (it is smaller and sits over content).
 */
export function anchorOutsideZones(
  x: number,
  y: number,
  radius: number,
  zones: ExclusionZone[],
): [number, number] {
  let px = x;
  let py = y;
  for (const zone of zones) {
    const left = zone.left - ZONE_MARGIN_PX - radius;
    const right = zone.right + ZONE_MARGIN_PX + radius;
    const top = zone.top - ZONE_MARGIN_PX - radius;
    const bottom = zone.bottom + ZONE_MARGIN_PX + radius;
    if (px <= left || px >= right || py <= top || py >= bottom) continue;
    // Push along the shortest exit from this expanded rect.
    const exits: [number, number, number][] = [
      [px - left, left, py],
      [right - px, right, py],
      [py - top, px, top],
      [bottom - py, px, bottom],
    ];
    const [, nx, ny] = exits.reduce((nearest, entry) => (entry[0] < nearest[0] ? entry : nearest));
    px = nx;
    py = ny;
  }
  return [px, py];
}
