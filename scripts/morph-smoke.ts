import { existsSync } from "node:fs";
import { asHoldingPoints, type PortfolioLot } from "../client/src/lib/portfolio";
import { buildMrBunglesDigest } from "../client/src/lib/mrBunglesDigest";
import { createMrBunglesProvider } from "../server/mrBunglesProvider";
import { validateMrBunglesReply } from "../shared/mrBungles";

async function main() {
  if (existsSync(".env")) process.loadEnvFile(".env");

  const lots: PortfolioLot[] = [
    { id: "a1", company: "Alpha", buy_qty: 2, avg_price: 100, current_price: 120, prev_close_price: 100, buy_date: "2020-01-01" },
    { id: "a2", company: "Alpha", buy_qty: 1, avg_price: 100, current_price: 60, buy_date: "2020-01-01" },
    { id: "b1", company: "Beta", buy_qty: 1, avg_price: 50, current_price: 50, prev_close_price: 50 },
  ];

  const digest = buildMrBunglesDigest(asHoldingPoints(lots), "holdings", "portfolio-impact", { includesEtfs: true, taxFilter: "all", query: "" });
  if (!digest) throw new Error("digest build failed");

  const raw = await fetch("https://api.morphllm.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.MORPH_API_KEY}` },
    body: JSON.stringify({ model: "morph-kimik3", messages: [{ role: "user", content: "Reply with the single word: ready" }], max_completion_tokens: 16 }),
  });
  console.log("PROBE STATUS:", raw.status);
  console.log("PROBE BODY:", (await raw.text()).slice(0, 600));

  const provider = createMrBunglesProvider();
  const utterance = await provider(digest);
  const reply = validateMrBunglesReply({ targetId: digest.targets[0].id, utterance }, digest)
    ?? digest.directives.find(d => d.text === utterance);

  console.log("UTTERANCE:", JSON.stringify(utterance));
  console.log("GROUNDED:", reply ? "yes" : "no");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
