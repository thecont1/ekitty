import { describe, expect, it } from "vitest";
import { clampTimelinePan, legendShouldAutoOpen, readLegendSeen, writeLegendSeen } from "./uiState";

describe("timeline pan", () => {
  it("moves toward earlier months and clamps at the world origin", () => {
    expect(clampTimelinePan(-500, "earlier", 300, -900)).toBe(-200);
    expect(clampTimelinePan(-100, "earlier", 300, -900)).toBe(0);
  });

  it("moves toward later months and clamps at the latest boundary", () => {
    expect(clampTimelinePan(-200, "later", 300, -900)).toBe(-500);
    expect(clampTimelinePan(-800, "later", 300, -900)).toBe(-900);
  });
});

describe("legend persistence", () => {
  it("auto-opens until the versioned seen flag is explicitly written", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    };

    expect(readLegendSeen(storage)).toBe(false);
    expect(legendShouldAutoOpen(storage)).toBe(true);
    writeLegendSeen(storage);
    expect(readLegendSeen(storage)).toBe(true);
    expect(legendShouldAutoOpen(storage)).toBe(false);
  });

  it("fails open when storage access is blocked", () => {
    const storage = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
    };

    expect(legendShouldAutoOpen(storage)).toBe(true);
    expect(() => writeLegendSeen(storage)).not.toThrow();
  });
});
