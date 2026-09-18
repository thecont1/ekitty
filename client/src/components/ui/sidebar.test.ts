import { describe, expect, it } from "vitest";
import { readSidebarOpen } from "./sidebar";

const storage = (value: string | null) => ({ getItem: () => value });

describe("sidebar persisted state", () => {
  it("restores the saved state on reload instead of the default", () => {
    expect(readSidebarOpen(storage("false"), true)).toBe(false);
    expect(readSidebarOpen(storage("true"), false)).toBe(true);
  });

  it("falls back to defaultOpen when storage is empty, invalid, or unavailable", () => {
    expect(readSidebarOpen(storage(null), true)).toBe(true);
    expect(readSidebarOpen(storage("garbage"), false)).toBe(false);
    expect(readSidebarOpen(undefined, true)).toBe(true);
    expect(readSidebarOpen({ getItem: () => { throw new Error("blocked"); } }, false)).toBe(false);
  });
});
