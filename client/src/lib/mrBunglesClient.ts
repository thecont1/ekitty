import { MR_BUNGLES_CACHE_MS, MR_BUNGLES_ERRORS, validateMrBunglesReply, type MrBunglesDigest, type MrBunglesErrorCode, type MrBunglesReply } from "@shared/mrBungles";

export class MrBunglesClientError extends Error {}

export function createMrBunglesClient(fetcher: typeof fetch = fetch, now = Date.now) {
  const cache = new Map<string, { expires: number; reply: MrBunglesReply }>();
  return async (digest: MrBunglesDigest, signal: AbortSignal): Promise<MrBunglesReply> => {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    const key = JSON.stringify(digest);
    const time = now();
    cache.forEach((entry, entryKey) => { if (entry.expires <= time) cache.delete(entryKey); });
    const hit = cache.get(key);
    if (hit) return hit.reply;
    const response = await fetcher("/api/mr-bungles", { method: "POST", headers: { "Content-Type": "application/json" }, body: key, signal });
    if (!response.ok) {
      let message: string | undefined;
      try {
        const body: unknown = await response.json();
        const code = typeof body === "object" && body !== null ? (body as { code?: unknown }).code : undefined;
        if (typeof code === "string" && Object.prototype.hasOwnProperty.call(MR_BUNGLES_ERRORS, code)) message = MR_BUNGLES_ERRORS[code as MrBunglesErrorCode].message;
      } catch {}
      if (!message) {
        message = response.status === 503 ? MR_BUNGLES_ERRORS.not_configured.message
          : response.status === 429 ? "Mr. Bungles is occupied. Try again shortly."
          : response.status === 504 ? MR_BUNGLES_ERRORS.provider_timeout.message
          : response.status === 400 || response.status === 413 ? "This portfolio's digest was rejected by the server. Try a narrower search."
          : response.status === 422 ? "No visible kitty to point to."
          : response.status === 404 || response.status === 405 ? "The Mr. Bungles API is missing on this server. The site owner needs to check the deployment."
          : "The Mr. Bungles server could not complete the request. Try again shortly.";
      }
      throw new MrBunglesClientError(message);
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new MrBunglesClientError(MR_BUNGLES_ERRORS.provider_invalid_response.message);
    }
    const reply = validateMrBunglesReply(body, digest);
    if (!reply) throw new MrBunglesClientError("Mr. Bungles refused an ungrounded response.");
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    if (cache.size >= 8) {
      const first = cache.keys().next().value;
      if (first !== undefined) cache.delete(first);
    }
    cache.set(key, { reply, expires: now() + MR_BUNGLES_CACHE_MS });
    return reply;
  };
}

export const requestMrBungles = createMrBunglesClient();
