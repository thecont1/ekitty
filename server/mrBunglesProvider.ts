import { setTimeout as delay } from "node:timers/promises";
import { z } from "zod";
import { MR_BUNGLES_SYSTEM_PROMPT, MR_BUNGLES_WIRE_PROMPT } from "./mr-bungles-prompt";
import { MR_BUNGLES_ERRORS, MR_BUNGLES_PROVIDER_TIMEOUT_MS, type MrBunglesDigest, type MrBunglesErrorCode } from "../shared/mrBungles";

export type MrBunglesProvider = (digest: MrBunglesDigest) => Promise<string>;
export class MrBunglesUnavailableError extends Error {}
export class MrBunglesProviderError extends Error {
  constructor(public readonly code: MrBunglesErrorCode) {
    super(MR_BUNGLES_ERRORS[code].message);
    this.name = "MrBunglesProviderError";
  }
}

const completionSchema = z.object({
  choices: z.array(z.object({ finish_reason: z.string().optional(), message: z.object({ content: z.string().min(1).max(800) }).passthrough() }).passthrough()).min(1).max(16),
}).passthrough();

export function createMrBunglesProvider(env: NodeJS.ProcessEnv = process.env, fetcher: typeof fetch = fetch): MrBunglesProvider {
  return async digest => {
    const morph = (env.LLM_PROVIDER ?? "morph") === "morph";
    const key = morph ? env.MORPH_API_KEY : env.MR_BUNGLES_API_KEY;
    const model = morph ? env.MORPH_MODEL || "morph-kimik3" : env.MR_BUNGLES_MODEL;
    if (!key || !model) throw new MrBunglesUnavailableError("Mr. Bungles provider is not configured.");
    let base: URL;
    try {
      base = new URL((morph ? env.MORPH_BASE_URL : env.MR_BUNGLES_BASE_URL) || (morph ? "https://api.morphllm.com/v1" : "https://api.openai.com/v1"));
    } catch {
      throw new MrBunglesUnavailableError("Mr. Bungles provider URL is invalid.");
    }
    if (base.username || base.password || base.search || base.hash || (base.protocol !== "https:" && !(base.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)))) throw new MrBunglesUnavailableError("Mr. Bungles provider URL is invalid.");
    const signal = AbortSignal.timeout(MR_BUNGLES_PROVIDER_TIMEOUT_MS);
    const send = () => fetcher(`${base.href.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      redirect: "error",
      signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, messages: [{ role: "system", content: MR_BUNGLES_SYSTEM_PROMPT }, { role: "system", content: MR_BUNGLES_WIRE_PROMPT }, { role: "user", content: JSON.stringify(digest) }], ...(morph && model === "morph-kimik3" ? { reasoning_effort: "low", max_completion_tokens: 1600 } : { max_completion_tokens: 800 }) }),
    });
    try {
      let response = await send();
      if (response.status === 429) {
        try { await response.body?.cancel(); } catch { /* body may already be consumed */ }
        await delay(2000, undefined, { signal });
        response = await send();
      }
      if (!response.ok) {
        try { await response.body?.cancel(); } catch {}
        const status = response.status;
        if (status === 401 || status === 403) throw new MrBunglesProviderError("provider_auth");
        if (status === 429) throw new MrBunglesProviderError("provider_rate_limited");
        if (status === 400 || status === 404 || status === 405 || status === 422) throw new MrBunglesProviderError("provider_request");
        throw new MrBunglesProviderError(status >= 400 && status < 500 ? "provider_request" : "provider_unavailable");
      }
      if (!response.body) throw new MrBunglesProviderError("provider_invalid_response");
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let bytes = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value.byteLength;
          if (bytes > 65536) {
            await reader.cancel();
            throw new MrBunglesProviderError("provider_invalid_response");
          }
          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }
      let payload: unknown;
      try {
        payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      } catch {
        throw new MrBunglesProviderError("provider_invalid_response");
      }
      const finish = z.object({ choices: z.array(z.object({ finish_reason: z.string().optional() })).min(1) }).safeParse(payload);
      if (finish.success && finish.data.choices[0].finish_reason === "length") throw new MrBunglesProviderError("provider_truncated");
      const parsed = completionSchema.safeParse(payload);
      if (!parsed.success) throw new MrBunglesProviderError("provider_invalid_response");
      return parsed.data.choices[0].message.content;
    } catch (error) {
      if (error instanceof MrBunglesProviderError) throw error;
      if (signal.aborted || (error instanceof DOMException && error.name === "TimeoutError")) throw new MrBunglesProviderError("provider_timeout");
      throw new MrBunglesProviderError("provider_unavailable");
    }
  };
}
