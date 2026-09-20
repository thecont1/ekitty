import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import MrBungles from "./MrBungles";
import { buildMrBunglesDigest, type MrBunglesScope } from "@/lib/mrBunglesDigest";
import { asHoldingPoints, asTransactionPoints, type PortfolioLot } from "@/lib/portfolio";
import type { PortfolioView } from "@/lib/portfolioCostumes";

const lots: PortfolioLot[] = [
  { id: "a1", company: "Alpha", buy_qty: 2, avg_price: 100, current_price: 120, prev_close_price: 100, buy_date: "2020-01-01" },
  { id: "a2", company: "Alpha", buy_qty: 1, avg_price: 100, current_price: 60, buy_date: "2020-01-01" },
  { id: "b1", company: "Beta", buy_qty: 1, avg_price: 50, current_price: 50, prev_close_price: 50 },
];
const scope: MrBunglesScope = { includesEtfs: true, taxFilter: "all", query: "" };

const render = (viewMode: PortfolioView = "holdings", empty = false) => {
  const points = empty ? [] : viewMode === "holdings" ? asHoldingPoints(lots) : asTransactionPoints(lots);
  return renderToStaticMarkup(createElement(MrBungles, {
    digest: buildMrBunglesDigest(points, viewMode, "portfolio-impact", scope),
    viewMode,
    darkMode: false,
    frozen: false,
    onShowMe: () => undefined,
    onSpeak: () => undefined,
  }));
};

describe("Mr. Bungles trigger", () => {
  it("renders a real button with the full transmission-notice aria label per view", () => {
    const holdings = render("holdings");
    expect(holdings).toContain("<button");
    expect(holdings).toContain('type="button"');
    expect(holdings).toContain("Mr. Bungles, the Glass Kitty. Point to one holding. Sends a small portfolio digest to the configured AI provider.");
    expect(render("transactions")).toContain("Point to one purchase.");
    expect(holdings).not.toContain(" disabled");
    expect(holdings).toContain('aria-controls="mr-bungles-utterance"');
    expect(holdings).toContain('aria-expanded="false"');
  });

  it("stays findable and operable when there is nothing to point to", () => {
    const markup = render("holdings", true);
    expect(markup).toContain('aria-disabled="false"');
    expect(markup).toContain("<button");
    expect(markup).toContain('data-empty="true"');
  });

  it("keeps the glass kitty on the real 192x192 silhouette with its own material", () => {
    const markup = render();
    expect(markup).toContain('viewBox="0 0 192 192"');
    expect(markup).toContain("M121.48,93.28");
    expect(markup).toContain("mr-bungles-glass");
    expect(markup).toContain("linearGradient");
    expect(markup).toContain("#c78ca1");
  });

  it("scales the trigger to 96x128 with an 88x104 glass figure, halo, and pink horns", () => {
    const markup = render();
    expect(markup).toContain("h-32 w-24");
    expect(markup).toContain("h-[104px] w-[88px]");
    expect(markup).toContain("text-[10px]");
    expect(markup).toContain('data-ornament="glass-halo"');
    expect(markup).toContain('data-ornament="pink-horns"');
    expect(markup).toContain("#ff1493");
    expect(markup).not.toContain('fill="#D8AE37"');
  });

  it("backs the mirrored glass kitty with a shiny blue mirror and keeps the flip off the text", () => {
    const markup = render();
    expect(markup).toContain('data-ornament="blue-mirror"');
    expect(markup).toContain('data-art-mirrored="true"');
    expect(markup.match(/scaleX\(-1\)/g)).toHaveLength(1);
    expect(markup).toContain('id="mr-bungles-mirror-');
    expect(markup).toContain('fill="url(#mr-bungles-mirror-');
    expect(markup).toContain('-rim"');
    expect(markup).toContain('data-ornament="glass-halo"');
    expect(markup).toContain('data-ornament="pink-horns"');
    expect(markup).not.toContain('fill="#D8AE37"');
    expect(markup).not.toContain('stopColor="#D8AE37"');
    const label = markup.slice(markup.lastIndexOf("Mr. Bungles</span>") - 220);
    expect(label).not.toContain("scaleX");
  });

  it("mounts exactly one polite live region outside the hidden utterance panel", () => {
    const markup = render();
    expect(markup.match(/role="status"/g)).toHaveLength(1);
    expect(markup).toContain('class="sr-only" role="status" aria-live="polite" aria-atomic="true"');
    const aside = markup.slice(markup.indexOf("<aside"), markup.indexOf("</aside>") + "</aside>".length);
    expect(aside).not.toContain('role="status"');
    expect(markup).not.toContain("<input");
    expect(markup).not.toContain("<textarea");
    expect(markup).not.toContain('role="textbox"');
    expect(markup).not.toContain("contenteditable");
  });

  it("shows the digest disclosure beside the trigger until first use", () => {
    const markup = render();
    expect(markup).toContain("One click sends a small portfolio digest to the configured AI provider.");
    expect(markup).toContain('href="/privacy"');
  });

  it("speaks no disclaimer or retired signature in the utterance region", () => {
    const markup = render();
    expect(markup).not.toContain("points; you decide");
    expect(markup).not.toContain("not personal financial advice");
    expect(markup).not.toContain("not financial advice");
  });
});
