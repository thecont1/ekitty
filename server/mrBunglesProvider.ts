import { z } from "zod";
import { MR_BUNGLES_SYSTEM_PROMPT, MR_BUNGLES_WIRE_PROMPT } from "./mr-bungles-prompt";
import type { MrBunglesDigest } from "../shared/mrBungles";

export type MrBunglesProvider = (digest: MrBunglesDigest) => Promise<string>;
export class MrBunglesUnavailableError extends Error {}

const completionSchema = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string().min(1).max(800) }).passthrough() }).passthrough()).min(1).max(16),
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
    const send = () => fetcher(`${base.href.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(20000),
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, messages: [{ role: "system", content: MR_BUNGLES_SYSTEM_PROMPT }, { role: "system", content: MR_BUNGLES_WIRE_PROMPT }, { role: "user", content: JSON.stringify(digest) }], max_completion_tokens: 800 }),
    });
    let response = await send();
    if (response.status === 429) {
      try { await response.body?.cancel(); } catch { /* body may already be consumed */ }
      await new Promise(resolve => setTimeout(resolve, 2000));
      response = await send();
    }
    if (!response.ok || !response.body) throw new Error("Mr. Bungles provider request failed.");
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
          throw new Error("Mr. Bungles provider response too large.");
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const payload: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const parsed = completionSchema.safeParse(payload);
    if (!parsed.success) throw new Error("Mr. Bungles provider response malformed.");
    return parsed.data.choices[0].message.content;
  };
}
