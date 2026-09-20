import { afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { MR_BUNGLES_ERRORS, MR_BUNGLES_PROVIDER_TIMEOUT_MS, type MrBunglesDigest, type MrBunglesErrorCode } from "../../../shared/mrBungles";
import { createMrBunglesRouter } from "../../../server/mrBungles";
import { MrBunglesProviderError, MrBunglesUnavailableError, createMrBunglesProvider, type MrBunglesProvider } from "../../../server/mrBunglesProvider";
import { MR_BUNGLES_SYSTEM_PROMPT, MR_BUNGLES_WIRE_PROMPT } from "../../../server/mr-bungles-prompt";
import { buildMrBunglesDigest, type MrBunglesScope } from "./mrBunglesDigest";
import { asHoldingPoints, type PortfolioLot } from "./portfolio";

const lots: PortfolioLot[] = [
  { id: "a1", company: "Alpha", buy_qty: 2, avg_price: 100, current_price: 120, prev_close_price: 100, buy_date: "2020-01-01" },
  { id: "a2", company: "Alpha", buy_qty: 1, avg_price: 100, current_price: 60, buy_date: "2020-01-01" },
  { id: "b1", company: "Beta", buy_qty: 1, avg_price: 50, current_price: 50, prev_close_price: 50 },
];
const scope: MrBunglesScope = { includesEtfs: true, taxFilter: "all", query: "" };
const digest = () => buildMrBunglesDigest(asHoldingPoints(lots), "holdings", "portfolio-impact", scope)!;
const okProvider: MrBunglesProvider = async d => d.directives[0].text;

const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map(s => new Promise<void>(resolve => { s.close(() => resolve()); s.closeAllConnections(); })));
});

async function start(router: express.Router) {
  const app = express();
  app.use("/api/mr-bungles", router);
  const s = createServer(app);
  servers.push(s);
  await new Promise<void>(resolve => s.listen(0, "127.0.0.1", resolve));
  const { port } = (s.address() as AddressInfo);
  return `http://127.0.0.1:${port}/api/mr-bungles`;
}

const post = (url: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });

describe("Mr. Bungles endpoint", () => {
  it("returns the grounded reply for a valid digest and caches it for 60 seconds", async () => {
    let now = 1_000_000;
    const provider = vi.fn(okProvider);
    const url = await start(createMrBunglesRouter({ provider, now: () => now }));
    const body = JSON.stringify(digest());
    const first = await post(url, body);
    expect(first.status).toBe(200);
    expect(first.headers.get("cache-control")).toBe("no-store");
    const expected = digest().directives[0];
    expect(await first.json()).toEqual({ targetId: expected.targetId, utterance: expected.text });
    const second = await post(url, body);
    expect(second.status).toBe(200);
    expect(provider).toHaveBeenCalledTimes(1);
    now += 60_001;
    const third = await post(url, body);
    expect(third.status).toBe(200);
    expect(provider).toHaveBeenCalledTimes(2);
  });

  it("rejects non-POST methods with 405 and Allow: POST", async () => {
    const url = await start(createMrBunglesRouter({ provider: vi.fn(okProvider) }));
    for (const method of ["GET", "PUT", "DELETE", "OPTIONS"]) {
      const res = await fetch(url, { method });
      expect(res.status).toBe(405);
      expect(res.headers.get("allow")).toBe("POST");
    }
  });

  it("requires an application/json content type", async () => {
    const url = await start(createMrBunglesRouter({ provider: vi.fn(okProvider) }));
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "text/plain" }, body: "{}" });
    expect(res.status).toBe(415);
    const missing = await fetch(url, { method: "POST", body: "{}" });
    expect(missing.status).toBe(415);
  });

  it("rejects foreign origins and cross-site fetch metadata with 403 and no CORS headers", async () => {
    const url = await start(createMrBunglesRouter({ provider: vi.fn(okProvider) }));
    const foreign = await post(url, digest(), { Origin: "https://evil.example" });
    expect(foreign.status).toBe(403);
    expect(foreign.headers.get("access-control-allow-origin")).toBeNull();
    const crossSite = await post(url, digest(), { "Sec-Fetch-Site": "cross-site" });
    expect(crossSite.status).toBe(403);
    const sameOrigin = await post(url, digest(), { Origin: new URL(url).origin });
    expect(sameOrigin.status).toBe(200);
  });

  it("returns 400 for malformed JSON and schema-invalid bodies, 413 for oversized", async () => {
    const provider = vi.fn(okProvider);
    const url = await start(createMrBunglesRouter({ provider }));
    expect((await post(url, "{not json")).status).toBe(400);
    expect((await post(url, { version: 2 })).status).toBe(400);
    expect((await post(url, { ...digest(), smuggled: true })).status).toBe(400);
    const oversized = JSON.stringify(Array.from({ length: 40_000 }, () => "x"));
    expect((await post(url, oversized)).status).toBe(413);
    expect(provider).not.toHaveBeenCalled();
  });

  it("returns 422 for a schema-valid digest with no targets or directives", async () => {
    const url = await start(createMrBunglesRouter({ provider: vi.fn(okProvider) }));
    const empty = buildMrBunglesDigest([], "holdings", "portfolio-impact", scope)!;
    expect((await post(url, empty)).status).toBe(422);
  });

  it("returns 502 with a safe message for ungrounded provider utterances", async () => {
    const d = digest();
    const cases = [
      "Regard Beta. Completely invented wording.",
      "Buy more of Alpha right now.",
      d.directives[0].text.replace(/\d+/, "999"),
    ];
    for (const utterance of cases) {
      const url = await start(createMrBunglesRouter({ provider: async () => utterance }));
      const res = await post(url, d);
      expect(res.status).toBe(502);
      const body = await res.json();
      expect(body).toEqual({ code: "ungrounded_reply", error: MR_BUNGLES_ERRORS.ungrounded_reply.message });
      expect(JSON.stringify(body)).not.toContain(utterance);
    }
  });

  it("maps every typed provider error to its allowlisted status, code, and fixed message", async () => {
    for (const [code, expected] of Object.entries(MR_BUNGLES_ERRORS)) {
      const url = await start(createMrBunglesRouter({ provider: async () => { throw new MrBunglesProviderError(code as MrBunglesErrorCode); } }));
      const res = await post(url, digest());
      expect(res.status).toBe(expected.status);
      const body = await res.json();
      expect(body).toEqual({ code, error: expected.message });
      expect(JSON.stringify(body)).not.toContain("Bearer");
      expect(JSON.stringify(body)).not.toContain("k-test");
      if (code === "provider_rate_limited") expect(res.headers.get("retry-after")).toBe("2");
    }
  });

  it("returns 503 with a safe message when the provider is not configured", async () => {
    const url = await start(createMrBunglesRouter({ provider: createMrBunglesProvider({}) }));
    const res = await post(url, digest());
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ code: "not_configured", error: MR_BUNGLES_ERRORS.not_configured.message });
  });

  it("collapses unexpected provider failures to provider_unavailable without leaking internals", async () => {
    const url = await start(createMrBunglesRouter({ provider: async () => { throw new Error("upstream dumped secret-token-xyz"); } }));
    const res = await post(url, digest());
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body).toEqual({ code: "provider_unavailable", error: MR_BUNGLES_ERRORS.provider_unavailable.message });
    expect(JSON.stringify(body)).not.toContain("secret-token-xyz");
  });

  it("deduplicates concurrent identical payloads into one provider call", async () => {
    const pending: { digest: MrBunglesDigest; resolve: (text: string) => void }[] = [];
    const provider = vi.fn((d: MrBunglesDigest) => new Promise<string>(resolve => pending.push({ digest: d, resolve })));
    const url = await start(createMrBunglesRouter({ provider }));
    const body = JSON.stringify(digest());
    const requests = Promise.all([0, 1, 2].map(() => post(url, body)));
    await vi.waitFor(() => expect(provider).toHaveBeenCalledTimes(1));
    pending.forEach(p => p.resolve(p.digest.directives[0].text));
    const responses = await requests;
    for (const res of responses) {
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ targetId: digest().directives[0].targetId, utterance: digest().directives[0].text });
    }
    expect(provider).toHaveBeenCalledTimes(1);
  });

  it("rejects a fifth distinct in-flight request with 429 and Retry-After: 1", async () => {
    const pending: { digest: MrBunglesDigest; resolve: (text: string) => void }[] = [];
    const provider = vi.fn((d: MrBunglesDigest) => new Promise<string>(resolve => pending.push({ digest: d, resolve })));
    const url = await start(createMrBunglesRouter({ provider }));
    const variants: MrBunglesDigest[] = [
      digest(),
      buildMrBunglesDigest(asHoldingPoints(lots), "holdings", "trade-quality", scope)!,
      buildMrBunglesDigest(asHoldingPoints(lots), "holdings", "capital-at-risk", scope)!,
      buildMrBunglesDigest(asHoldingPoints(lots), "holdings", "portfolio-impact", { ...scope, query: "Alpha" })!,
      buildMrBunglesDigest(asHoldingPoints(lots), "holdings", "portfolio-impact", { ...scope, query: "Beta" })!,
    ];
    const first4 = variants.slice(0, 4).map(d => post(url, d));
    await vi.waitFor(() => expect(provider).toHaveBeenCalledTimes(4));
    const fifth = await post(url, variants[4]);
    expect(fifth.status).toBe(429);
    expect(fifth.headers.get("retry-after")).toBe("1");
    pending.forEach(p => p.resolve(p.digest.directives[0].text));
    for (const res of await Promise.all(first4)) expect(res.status).toBe(200);
  });

  it("allows at most 30 fresh provider calls per rolling 60 seconds", async () => {
    let now = 5_000_000;
    const provider = vi.fn(okProvider);
    const url = await start(createMrBunglesRouter({ provider, now: () => now }));
    const many: PortfolioLot[] = Array.from({ length: 32 }, (_, i) => ({ id: `c${i}`, company: `Co${String(i).padStart(2, "0")}`, buy_qty: 1, avg_price: 100, current_price: 110 }));
    const points = asHoldingPoints(many);
    for (let i = 0; i < 30; i++) {
      const d = buildMrBunglesDigest(points, "holdings", "portfolio-impact", { ...scope, query: `co${String(i).padStart(2, "0")}` })!;
      expect((await post(url, d)).status).toBe(200);
    }
    const extra = buildMrBunglesDigest(points, "holdings", "portfolio-impact", { ...scope, query: "co30" })!;
    const res = await post(url, extra);
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("60");
    expect(provider).toHaveBeenCalledTimes(30);
    now += 61_000;
    expect((await post(url, extra)).status).toBe(200);
  });
});

describe("Mr. Bungles provider transport", () => {
  const okResponse = (text: string) => new Response(JSON.stringify({ choices: [{ message: { content: text } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
  const env = { LLM_PROVIDER: "incumbent", MR_BUNGLES_API_KEY: "k-test", MR_BUNGLES_MODEL: "m-test", MR_BUNGLES_BASE_URL: "https://api.openai.com/v1" };

  it("defaults to Morph on morph-kimik3 with low reasoning effort and a 1600 token cap", async () => {
    const fetcher = vi.fn(async () => okResponse("grounded text"));
    const provider = createMrBunglesProvider({ MORPH_API_KEY: "k-morph" }, fetcher as unknown as typeof fetch);
    await expect(provider(digest())).resolves.toBe("grounded text");
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.morphllm.com/v1/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer k-morph");
    const payload = JSON.parse(init.body as string);
    expect(payload.model).toBe("morph-kimik3");
    expect(payload.reasoning_effort).toBe("low");
    expect(payload.max_completion_tokens).toBe(1600);
  });

  it("keeps the 800 token cap and no reasoning effort for other models", async () => {
    const fetcher = vi.fn(async () => okResponse("grounded text"));
    for (const providerEnv of [env, { MORPH_API_KEY: "k-morph", MORPH_MODEL: "morph-other" }]) {
      fetcher.mockClear();
      await expect(createMrBunglesProvider(providerEnv, fetcher as unknown as typeof fetch)(digest())).resolves.toBe("grounded text");
      const payload = JSON.parse((fetcher.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
      expect(payload.max_completion_tokens).toBe(800);
      expect(payload).not.toHaveProperty("reasoning_effort");
    }
  });

  it("posts the digest with bearer auth and both system prompts verbatim", async () => {
    const fetcher = vi.fn(async () => okResponse("grounded text"));
    const provider = createMrBunglesProvider(env, fetcher as unknown as typeof fetch);
    const d = digest();
    await expect(provider(d)).resolves.toBe("grounded text");
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect(init.method).toBe("POST");
    expect(init.redirect).toBe("error");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer k-test");
    expect(headers["Content-Type"]).toBe("application/json");
    const payload = JSON.parse(init.body as string);
    expect(payload.model).toBe("m-test");
    expect(payload.max_completion_tokens).toBe(800);
    expect(payload.messages).toEqual([
      { role: "system", content: MR_BUNGLES_SYSTEM_PROMPT },
      { role: "system", content: MR_BUNGLES_WIRE_PROMPT },
      { role: "user", content: JSON.stringify(d) },
    ]);
  });

  it("rejects missing configuration without calling fetch", async () => {
    const fetcher = vi.fn(async () => okResponse("x"));
    for (const broken of [{}, { MR_BUNGLES_API_KEY: "k" }, { MR_BUNGLES_MODEL: "m" }]) {
      await expect(createMrBunglesProvider(broken, fetcher as unknown as typeof fetch)(digest())).rejects.toBeInstanceOf(MrBunglesUnavailableError);
    }
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("rejects unsafe or unparseable base URLs as unconfigured", async () => {
    const fetcher = vi.fn(async () => okResponse("x"));
    for (const base of ["not a url", "http://api.openai.com/v1", "https://user:secret@api.openai.com/v1", "https://api.openai.com/v1?key=1"]) {
      await expect(createMrBunglesProvider({ ...env, MR_BUNGLES_BASE_URL: base }, fetcher as unknown as typeof fetch)(digest())).rejects.toBeInstanceOf(MrBunglesUnavailableError);
    }
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("classifies non-2xx statuses into typed provider errors", async () => {
    const cases: [number, MrBunglesErrorCode][] = [
      [401, "provider_auth"],
      [403, "provider_auth"],
      [400, "provider_request"],
      [404, "provider_request"],
      [500, "provider_unavailable"],
      [503, "provider_unavailable"],
    ];
    for (const [status, code] of cases) {
      const fetcher = vi.fn(async () => new Response(`upstream-${status}-secret`, { status }));
      await expect(createMrBunglesProvider(env, fetcher as unknown as typeof fetch)(digest())).rejects.toMatchObject({ name: "MrBunglesProviderError", code, message: MR_BUNGLES_ERRORS[code].message });
    }
  });

  it("retries a 429 once on the same signal, cancels the first body, then reports rate limiting", async () => {
    const first = new Response("rate limited", { status: 429 });
    const cancel = vi.spyOn(first.body!, "cancel");
    const fetcher = vi.fn()
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce(new Response("still limited", { status: 429 }));
    await expect(createMrBunglesProvider(env, fetcher as unknown as typeof fetch)(digest())).rejects.toMatchObject({ name: "MrBunglesProviderError", code: "provider_rate_limited" });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(cancel).toHaveBeenCalledTimes(1);
    const signal0 = (fetcher.mock.calls[0] as unknown as [string, RequestInit])[1].signal;
    const signal1 = (fetcher.mock.calls[1] as unknown as [string, RequestInit])[1].signal;
    expect(signal0).toBe(signal1);
    expect(signal0).toBeInstanceOf(AbortSignal);
  });

  it("honours the shared provider deadline while backing off after a 429", async () => {
    const controller = new AbortController();
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
    try {
      const first = new Response("rate limited", { status: 429 });
      const cancel = vi.spyOn(first.body!, "cancel");
      const fetcher = vi.fn(async () => first);
      const pending = createMrBunglesProvider(env, fetcher as unknown as typeof fetch)(digest());
      const assertion = expect(pending).rejects.toMatchObject({ name: "MrBunglesProviderError", code: "provider_timeout" });
      await vi.waitFor(() => expect(cancel).toHaveBeenCalledTimes(1));
      controller.abort(new DOMException("timeout", "TimeoutError"));
      await assertion;
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(timeoutSpy).toHaveBeenCalledWith(MR_BUNGLES_PROVIDER_TIMEOUT_MS);
    } finally {
      timeoutSpy.mockRestore();
    }
  });

  it("maps transport timeouts and unreachable hosts to typed errors", async () => {
    const timeout = vi.fn(async () => { throw new DOMException("The operation timed out.", "TimeoutError"); });
    await expect(createMrBunglesProvider(env, timeout as unknown as typeof fetch)(digest())).rejects.toMatchObject({ name: "MrBunglesProviderError", code: "provider_timeout" });
    const unreachable = vi.fn(async () => { throw new TypeError("fetch failed"); });
    await expect(createMrBunglesProvider(env, unreachable as unknown as typeof fetch)(digest())).rejects.toMatchObject({ name: "MrBunglesProviderError", code: "provider_unavailable" });
  });

  it("rejects a truncated completion even when the message content is null", async () => {
    const truncated = vi.fn(async () => new Response(JSON.stringify({ choices: [{ finish_reason: "length", message: { content: null } }] }), { status: 200 }));
    await expect(createMrBunglesProvider(env, truncated as unknown as typeof fetch)(digest())).rejects.toMatchObject({ name: "MrBunglesProviderError", code: "provider_truncated" });
  });

  it("rejects non-2xx responses, malformed payloads, and oversized bodies", async () => {
    const failing = vi.fn(async () => new Response("upstream down", { status: 500 }));
    await expect(createMrBunglesProvider(env, failing as unknown as typeof fetch)(digest())).rejects.toThrow();
    const emptyChoices = vi.fn(async () => new Response(JSON.stringify({ choices: [] })));
    await expect(createMrBunglesProvider(env, emptyChoices as unknown as typeof fetch)(digest())).rejects.toThrow();
    const wrongShape = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: 42 } }] })));
    await expect(createMrBunglesProvider(env, wrongShape as unknown as typeof fetch)(digest())).rejects.toThrow();
    const tooLong = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: "x".repeat(801) } }] })));
    await expect(createMrBunglesProvider(env, tooLong as unknown as typeof fetch)(digest())).rejects.toThrow();
    const oversized = vi.fn(async () => new Response("x".repeat(70_000)));
    await expect(createMrBunglesProvider(env, oversized as unknown as typeof fetch)(digest())).rejects.toThrow();
    const notJson = vi.fn(async () => new Response("this is not json"));
    await expect(createMrBunglesProvider(env, notJson as unknown as typeof fetch)(digest())).rejects.toThrow();
  });
});
