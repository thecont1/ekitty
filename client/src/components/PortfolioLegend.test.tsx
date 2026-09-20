import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import PortfolioLegend from "./PortfolioLegend";
import type { PortfolioView } from "@/lib/portfolioCostumes";

describe("PortfolioLegend copy", () => {
  const renderLegend = (moverRingEnabled: boolean, viewMode: PortfolioView = "holdings", showCostumes = true) => renderToStaticMarkup(createElement(PortfolioLegend, {
    darkMode: false,
    onClose: () => undefined,
    visualLens: "portfolio-impact",
    moverRingEnabled,
    viewMode,
    showCostumes,
    onShowCostumesChange: () => undefined,
  }));

  it("states that the dashed loss ring depends on the emphasis-halo toggle", () => {
    const markup = renderLegend(false);

    expect(markup).toContain("Dashed ring on loss cats");
    expect(markup).toContain("shown when emphasis halos are on");
  });

  it("hides the mover-ring row while its feature gate is disabled", () => {
    expect(renderLegend(false)).not.toContain("mover ring · daily movement of at least 2%");
  });

  it("keeps the mover-ring description when its feature gate is enabled", () => {
    expect(renderLegend(true)).toContain("mover ring · daily movement of at least 2%");
  });

  it("separates the costume-library disclosure from its costume switch", () => {
    const markup = renderLegend(false);
    expect(markup).toContain('aria-controls="portfolio-costume-library"');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain("Costume library");
    expect(markup).toContain('role="switch"');
    expect(markup).toContain('aria-checked="true"');
    expect(markup).toContain('aria-labelledby="costume-library-title"');
    expect(markup).toContain("M16 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0");
    expect(markup).toContain("One main costume, in this priority order; the ETF basket may join it. Gold collars remain tax flags.");
  });

  it("renders the supplied left-knob artwork while costumes are off", () => {
    const markup = renderLegend(false, "holdings", false);
    expect(markup).toContain('aria-checked="false"');
    expect(markup).toContain("M8 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0");
    expect(markup).not.toContain("Costume library · off");
  });

  it("Group view lists only holdings-scoped costumes — no Firefighter", () => {
    const markup = renderLegend(false, "holdings");
    expect(markup).toContain("Wounded");
    expect(markup).toContain("Monopoly");
    expect(markup).toContain("Patchwork");
    expect(markup).toContain("Top hat + green coat · at least 20% of portfolio current value.");
    expect(markup).not.toContain("Firefighter");
  });

  it("carries the Mr. Bungles disclosure and advice disclaimer", () => {
    const markup = renderLegend(false);
    expect(markup).toContain("Click Mr. Bungles to send a small portfolio digest to your connected AI provider. No conversation is opened.");
    expect(markup).toContain("AI commentary is not personal financial advice; verify decisions with a qualified adviser.");
    expect(markup).toContain('href="/privacy"');
  });

  it("Transactions view lists only purchase-scoped costumes — no Monopoly or Patchwork", () => {
    const markup = renderLegend(false, "transactions");
    expect(markup).toContain("Firefighter");
    expect(markup).toContain("Fire jacket · this purchase used at least 10% of invested capital.");
    expect(markup).not.toContain("Monopoly");
    expect(markup).not.toContain("Patchwork");
  });

  it("shares the header overlay column and carries the enlarged readable scale", () => {
    const holdings = renderLegend(false, "holdings");
    const transactions = renderLegend(false, "transactions");
    for (const markup of [holdings, transactions]) {
      expect(markup).toContain("portfolio-overlay-column");
      expect(markup).toContain("text-xl");
      expect(markup).toContain("text-[13px]");
      expect(markup).toContain("portfolio-costume-row");
      expect(markup).toContain("h-[72px] w-[72px]");
      expect(markup).toContain("text-[14px]");
    }
  });
});
