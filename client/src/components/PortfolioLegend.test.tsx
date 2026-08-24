import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import PortfolioLegend from "./PortfolioLegend";

describe("PortfolioLegend copy", () => {
  const renderLegend = (moverRingEnabled: boolean) => renderToStaticMarkup(createElement(PortfolioLegend, {
    darkMode: false,
    onClose: () => undefined,
    visualLens: "portfolio-impact",
    moverRingEnabled,
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
});
