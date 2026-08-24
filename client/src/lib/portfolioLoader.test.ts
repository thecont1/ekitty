import { describe, expect, it } from "vitest";
import { parsePortfolioResponse } from "./portfolioLoader";

const validCsv = "company,buy_qty,avg_price,current_price,buy_date\nAlpha,2,100,120,2025-06-01";

describe("parsePortfolioResponse", () => {
  it("accepts a complete successful CSV response", async () => {
    const result = await parsePortfolioResponse(new Response(validCsv, {
      status: 200,
      headers: { "last-modified": "Sun, 24 Aug 2026 10:00:00 GMT" },
    }));

    expect(result.records).toHaveLength(1);
    expect(result.lastModified).toBe("Sun, 24 Aug 2026 10:00:00 GMT");
    expect(result.text).toBe(validCsv);
  });

  it("rejects a non-success response before parsing its body as portfolio data", async () => {
    await expect(parsePortfolioResponse(new Response(validCsv, { status: 503 })))
      .rejects.toThrow("Portfolio download failed (503)");
  });

  it("rejects a successful response containing a truncated row", async () => {
    const truncated = [
      "company,buy_qty,avg_price,current_price,buy_date",
      "Alpha,2,100,120,2025-06-01",
      "Whirlpool,3,1000,900,2025-06-",
    ].join("\n");

    await expect(parsePortfolioResponse(new Response(truncated, { status: 200 })))
      .rejects.toThrow("Row 3 has an invalid buy date");
  });
});
