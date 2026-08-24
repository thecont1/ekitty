import { describe, expect, it } from "vitest";
import { getPortfolioFooterClassName } from "./portfolioFooter";

describe("portfolio footer layout", () => {
  it("wraps within a narrow viewport while preserving the desktop row", () => {
    const light = getPortfolioFooterClassName(false);
    expect(light).toContain("w-[calc(100vw-24px)]");
    expect(light).toContain("flex-wrap");
    expect(light).toContain("justify-center");
    expect(light).toContain("text-center");
    expect(light).toContain("sm:w-auto");
    expect(light).toContain("sm:flex-nowrap");
    expect(light).toContain("sm:whitespace-nowrap");
    expect(light).toContain("text-stone-400");
  });

  it("keeps the dark-mode footer colour", () => {
    expect(getPortfolioFooterClassName(true)).toContain("text-stone-500");
  });
});
