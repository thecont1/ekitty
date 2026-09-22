import { clamp } from "@/lib/portfolioVisuals";

export type OverlayState = { drawerOpen: boolean; legendOpen: boolean; selectedId: string | null };
type OverlayClosers = { closeDrawer: () => void; closeLegend: () => void; closeSelected: () => void; markLegendSeen: () => void };
type PreventableEvent = { preventDefault: () => void };
type ReadonlyStorage = { getItem: (key: string) => string | null };
type WritableStorage = { setItem: (key: string, value: string) => void };

const HALOS_STORAGE_KEY = "ekitty-show-halos-v1";

export function clampCardLeft(focusX: number, sceneWidth: number, onRight: boolean) {
  return clamp(onRight ? focusX + 76 : focusX - 412, 14, sceneWidth - 350 - 72);
}

export function closeTopOverlay(state: OverlayState, closers: OverlayClosers, event: PreventableEvent) {
  if (state.drawerOpen) {
    closers.closeDrawer();
    event.preventDefault();
    return;
  }
  if (state.legendOpen) {
    closers.closeLegend();
    closers.markLegendSeen();
    event.preventDefault();
    return;
  }
  if (state.selectedId) {
    closers.closeSelected();
    event.preventDefault();
  }
}

export function readShowHalos(storage: ReadonlyStorage) {
  try {
    return storage.getItem(HALOS_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

// Symmetric with readShowHalos: both own HALOS_STORAGE_KEY and its "true"/"false"
// serialization in one place, so the write path can never drift from the read
// path. Storage-blocked (private mode, quota) is swallowed — the toggle still
// works for the session, it just won't persist.
export function writeShowHalos(storage: WritableStorage, value: boolean) {
  try {
    storage.setItem(HALOS_STORAGE_KEY, String(value));
  } catch {
    /* storage blocked */
  }
}
