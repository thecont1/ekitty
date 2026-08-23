export const LEGEND_SEEN_KEY = "ekitty-legend-seen-v1";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function clampTimelinePan(currentX: number, direction: "earlier" | "later", distance: number, minimumX: number) {
  const delta = direction === "earlier" ? distance : -distance;
  return Math.max(minimumX, Math.min(0, currentX + delta));
}

export function readLegendSeen(storage: StorageLike) {
  try {
    return storage.getItem(LEGEND_SEEN_KEY) === "true";
  } catch {
    return false;
  }
}

export function legendShouldAutoOpen(storage: StorageLike) {
  return !readLegendSeen(storage);
}

export function writeLegendSeen(storage: StorageLike) {
  try {
    storage.setItem(LEGEND_SEEN_KEY, "true");
  } catch {
    // The legend remains available when storage is blocked.
  }
}
