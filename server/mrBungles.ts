import { createHash } from "node:crypto";
import express from "express";
import { MR_BUNGLES_CACHE_MS, MR_BUNGLES_ERRORS, MR_BUNGLES_MAX_BYTES, mrBunglesDigestSchema, type MrBunglesErrorCode, type MrBunglesReply } from "../shared/mrBungles";
import { MrBunglesProviderError, MrBunglesUnavailableError, createMrBunglesProvider, type MrBunglesProvider } from "./mrBunglesProvider";

const MR_BUNGLES_CACHE_ENTRIES = 64;
const MR_BUNGLES_INFLIGHT_MAX = 4;
const MR_BUNGLES_CALLS_PER_WINDOW = 30;
const MR_BUNGLES_WINDOW_MS = 60_000;

export function createMrBunglesRouter({ provider = createMrBunglesProvider(), now = Date.now }: { provider?: MrBunglesProvider; now?: () => number } = {}): express.Router {
  const cache = new Map<string, { expires: number; reply: MrBunglesReply }>();
  const inflight = new Map<string, Promise<MrBunglesReply>>();
  const callTimestamps: number[] = [];
  const router = express.Router();

  const sendProviderError = (res: express.Response, error: unknown) => {
    const code: MrBunglesErrorCode = error instanceof MrBunglesUnavailableError ? "not_configured" : error instanceof MrBunglesProviderError ? error.code : "provider_unavailable";
    if (code === "provider_rate_limited") res.set("Retry-After", "2");
    const { status, message } = MR_BUNGLES_ERRORS[code];
    res.status(status).json({ code, error: message });
  };

  router.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (req.method !== "POST") {
      res.set("Allow", "POST");
      res.status(405).json({ error: "Only POST is supported." });
      return;
    }
    const origin = req.headers.origin;
    if (origin !== undefined) {
      let originHost: string | null = null;
      try {
        originHost = new URL(origin).host;
      } catch {
        originHost = null;
      }
      if (originHost !== req.headers.host) {
        res.status(403).json({ error: "Cross-origin requests are not allowed." });
        return;
      }
    }
    if (req.headers["sec-fetch-site"] === "cross-site") {
      res.status(403).json({ error: "Cross-origin requests are not allowed." });
      return;
    }
    if (!req.is("application/json")) {
      res.status(415).json({ error: "Content-Type must be application/json." });
      return;
    }
    next();
  });

  router.use(express.json({ limit: MR_BUNGLES_MAX_BYTES, strict: true }));

  router.post("/", async (req, res) => {
    const parsed = mrBunglesDigestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Malformed Mr. Bungles digest." });
      return;
    }
    const digest = parsed.data;
    if (!digest.targets.length || !digest.directives.length) {
      res.status(422).json({ error: "Mr. Bungles digest has no actionable directives." });
      return;
    }
    const key = createHash("sha256").update(JSON.stringify(digest)).digest("hex");
    const nowMs = now();
    cache.forEach((entry, cacheKey) => {
      if (entry.expires <= nowMs) cache.delete(cacheKey);
    });
    const hit = cache.get(key);
    if (hit) {
      res.json(hit.reply);
      return;
    }
    const pending = inflight.get(key);
    if (pending) {
      try {
        res.json(await pending);
      } catch (error) {
        sendProviderError(res, error);
      }
      return;
    }
    if (inflight.size >= MR_BUNGLES_INFLIGHT_MAX) {
      res.set("Retry-After", "1");
      res.status(429).json({ error: "Mr. Bungles is busy." });
      return;
    }
    const cutoff = nowMs - MR_BUNGLES_WINDOW_MS;
    while (callTimestamps.length && callTimestamps[0] <= cutoff) callTimestamps.shift();
    if (callTimestamps.length >= MR_BUNGLES_CALLS_PER_WINDOW) {
      res.set("Retry-After", "60");
      res.status(429).json({ error: "Mr. Bungles rate limit reached." });
      return;
    }
    callTimestamps.push(nowMs);
    const task = (async (): Promise<MrBunglesReply> => {
      const utterance = await provider(digest);
      let targetId: string | undefined;
      for (const directive of digest.directives) {
        if (directive.text === utterance && (targetId === undefined || directive.targetId < targetId)) targetId = directive.targetId;
      }
      if (targetId === undefined) throw new MrBunglesProviderError("ungrounded_reply");
      const reply: MrBunglesReply = { targetId, utterance };
      if (cache.size >= MR_BUNGLES_CACHE_ENTRIES) {
        const oldest = cache.keys().next().value;
        if (oldest !== undefined) cache.delete(oldest);
      }
      cache.set(key, { expires: now() + MR_BUNGLES_CACHE_MS, reply });
      return reply;
    })();
    inflight.set(key, task);
    try {
      res.json(await task);
    } catch (error) {
      sendProviderError(res, error);
    } finally {
      inflight.delete(key);
    }
  });

  router.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = (err as { status?: number })?.status;
    if (status === 413) {
      res.status(413).json({ error: "Request body too large." });
      return;
    }
    if (status === 415) {
      res.status(415).json({ error: "Content-Type must be application/json." });
      return;
    }
    res.status(400).json({ error: "Malformed request body." });
  });

  return router;
}
