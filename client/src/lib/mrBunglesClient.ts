import { MR_BUNGLES_CACHE_MS, validateMrBunglesReply, type MrBunglesDigest, type MrBunglesReply } from "@shared/mrBungles";

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
    if (!response.ok) throw new MrBunglesClientError(response.status === 503 ? "Mr. Bungles is not configured on this server." : response.status === 429 ? "Mr. Bungles is occupied. Try again shortly." : "Mr. Bungles could not point safely. Try again.");
    const reply = validateMrBunglesReply(await response.json(), digest);
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
