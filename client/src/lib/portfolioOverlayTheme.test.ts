import { describe, expect, it } from "vitest";
import { getPortfolioOverlayTheme } from "./portfolioOverlayTheme";

describe("portfolio overlay theme", () => {
  it("uses the dark field palette and readable foregrounds in dark mode", () => {
    const theme = getPortfolioOverlayTheme(true);

    expect(theme.panel).toContain("bg-[#142022]/98");
    expect(theme.panel).toContain("border-[#30464c]");
    expect(theme.panel).toContain("text-stone-100");
    expect(theme.title).toContain("text-stone-100");
    expect(theme.value).toContain("text-stone-200");
    expect(theme.lotText).toContain("text-stone-300");
    expect(theme.divider).toContain("border-[#25383d]");
    expect(theme.closeButton).toContain("hover:bg-[#203035]");
    expect(theme.taxNotice).toContain("bg-amber-950/45");
    expect(theme.profit).toContain("text-[#4ade80]");
    expect(theme.loss).toContain("text-[#ff6b6b]");

    expect(Object.values(theme).join(" ")).not.toContain("bg-white");
    expect(theme.title).not.toContain("text-stone-900");
  });

  it("preserves the existing light overlay palette", () => {
    const theme = getPortfolioOverlayTheme(false);

    expect(theme.panel).toContain("bg-white/98");
    expect(theme.panel).toContain("border-stone-200");
    expect(theme.title).toContain("text-stone-900");
    expect(theme.value).toContain("text-stone-800");
    expect(theme.lotText).toContain("text-stone-700");
    expect(theme.divider).toContain("border-stone-100");
    expect(theme.closeButton).toContain("hover:bg-stone-100");
    expect(theme.taxNotice).toContain("bg-amber-50");
    expect(theme.profit).toContain("text-emerald-700");
    expect(theme.loss).toContain("text-[#ff3b3b]");
  });
});
