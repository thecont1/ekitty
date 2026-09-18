import { describe, expect, it, vi } from "vitest";
import type { MrBunglesReply } from "../../../shared/mrBungles";
import { createMrBunglesClient, MrBunglesClientError } from "./mrBunglesClient";
import { buildMrBunglesDigest, type MrBunglesScope } from "./mrBunglesDigest";
import { asHoldingPoints, type PortfolioLot } from "./portfolio";

const lots: PortfolioLot[] = [
  { id: "a1", company: "Alpha", buy_qty: 2, avg_price: 100, current_price: 120, prev_close_price: 100, buy_date: "2020-01-01" },
  { id: "a2", company: "Alpha", buy_qty: 1, avg_price: 100, current_price: 60, buy_date: "2020-01-01" },
  { id: "b1", company: "Beta", buy_qty: 1, avg_price: 50, current_price: 50, prev_close_price: 50 },
];
const scope: MrBunglesScope = { includesEtfs: true, taxFilter: "all", query: "" };
const digest = () => buildMrBunglesDigest(asHoldingPoints(lots), "holdings", "portfolio-impact", scope)!;
const replyFor = (d = digest()): MrBunglesReply => ({ targetId: d.directives[0].targetId, utterance: d.directives[0].text });
const okJson = (reply: MrBunglesReply) => new Response(JSON.stringify(reply), { status: 200, headers: { "Content-Type": "application/json" } });
const idle = () => new AbortController().signal;

describe("Mr. Bungles client", () => {
  it("performs no fetch until the returned function is invoked", async () => {
    const fetcher = vi.fn(async () => okJson(replyFor()));
    const request = createMrBunglesClient(fetcher as unknown as typeof fetch);
    expect(fetcher).not.toHaveBeenCalled();
    await request(digest(), idle());
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("posts the exact serialized digest to /api/mr-bungles with the caller's signal", async () => {
    const fetcher = vi.fn(async () => okJson(replyFor()));
    const request = createMrBunglesClient(fetcher as unknown as typeof fetch);
    const d = digest();
    const controller = new AbortController();
    await request(d, controller.signal);
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/mr-bungles");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    expect(init.body).toBe(JSON.stringify(d));
    expect(init.signal).toBe(controller.signal);
  });

  it("serves repeat requests from memory for 60 seconds and refetches after expiry", async () => {
    let now = 1_000_000;
    const fetcher = vi.fn(async () => okJson(replyFor()));
    const request = createMrBunglesClient(fetcher as unknown as typeof fetch, () => now);
    const d = digest();
    expect(await request(d, idle())).toEqual(replyFor());
    expect(await request(d, idle())).toEqual(replyFor());
    expect(fetcher).toHaveBeenCalledTimes(1);
    now += 60_001;
    await request(d, idle());
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("treats scope and lens changes as distinct digests", async () => {
    const fetcher = vi.fn(async () => okJson(replyFor()));
    const request = createMrBunglesClient(fetcher as unknown as typeof fetch);
    await request(digest(), idle());
    const filtered = buildMrBunglesDigest(asHoldingPoints(lots), "holdings", "portfolio-impact", { ...scope, query: "Alpha" })!;
    await request(filtered, idle());
    const otherLens = buildMrBunglesDigest(asHoldingPoints(lots), "holdings", "trade-quality", scope)!;
    await request(otherLens, idle());
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("rejects replies with changed numbers or wrong target ids", async () => {
    const d = digest();
    const tampered = { targetId: d.directives[0].targetId, utterance: d.directives[0].text.replace(/\d+/, "999") };
    const fetcher = vi.fn(async () => okJson(tampered));
    await expect(createMrBunglesClient(fetcher as unknown as typeof fetch)(d, idle())).rejects.toBeInstanceOf(MrBunglesClientError);
    const wrongId = { targetId: d.targets[1].id, utterance: d.directives[0].text };
    const fetcher2 = vi.fn(async () => okJson(wrongId));
    await expect(createMrBunglesClient(fetcher2 as unknown as typeof fetch)(d, idle())).rejects.toBeInstanceOf(MrBunglesClientError);
  });

  it("maps status codes to fixed safe errors and never caches failures", async () => {
    const fetcher = vi.fn()
      .mockImplementationOnce(async () => new Response("{}", { status: 503 }))
      .mockImplementationOnce(async () => new Response("{}", { status: 429 }))
      .mockImplementationOnce(async () => new Response("{}", { status: 500 }))
      .mockImplementation(async () => okJson(replyFor()));
    const request = createMrBunglesClient(fetcher as unknown as typeof fetch);
    const d = digest();
    await expect(request(d, idle())).rejects.toThrow("Mr. Bungles is not configured on this server.");
    await expect(request(d, idle())).rejects.toThrow("Mr. Bungles is occupied. Try again shortly.");
    await expect(request(d, idle())).rejects.toThrow("Mr. Bungles could not point safely. Try again.");
    await expect(request(d, idle())).resolves.toEqual(replyFor());
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it("discards replies that arrive after the caller aborted", async () => {
    const d = digest();
    const controller = new AbortController();
    const fetcher = vi.fn(async () => {
      controller.abort();
      return okJson(replyFor(d));
    });
    const request = createMrBunglesClient(fetcher as unknown as typeof fetch);
    await expect(request(d, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    await expect(request(d, idle())).resolves.toEqual(replyFor());
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("rejects an already-aborted signal without touching the cache or fetch", async () => {
    const fetcher = vi.fn(async () => okJson(replyFor()));
    const request = createMrBunglesClient(fetcher as unknown as typeof fetch);
    const d = digest();
    await request(d, idle());
    expect(fetcher).toHaveBeenCalledTimes(1);
    const aborted = new AbortController();
    aborted.abort();
    await expect(request(d, aborted.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
