import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import PortfolioLegend from "./PortfolioLegend";

describe("PortfolioLegend halo copy", () => {
  it("states that the dashed loss ring depends on the emphasis-halo toggle", () => {
    const markup = renderToStaticMarkup(createElement(PortfolioLegend, {
      darkMode: false,
      onClose: () => undefined,
      visualLens: "portfolio-impact",
    }));

    expect(markup).toContain("Dashed ring on loss cats");
    expect(markup).toContain("shown when emphasis halos are on");
  });
});
