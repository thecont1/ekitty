import { describe, expect, it, vi } from "vitest";
import { analyticsScriptConfig, installAnalytics } from "./analytics";

describe("analytics opt-in", () => {
  it("loads nothing without both explicit env values", () => {
    expect(analyticsScriptConfig({})).toBeNull();
    expect(analyticsScriptConfig({ VITE_ANALYTICS_ENDPOINT: "https://umami.example.com" })).toBeNull();
    expect(analyticsScriptConfig({ VITE_ANALYTICS_WEBSITE_ID: "id" })).toBeNull();
    expect(analyticsScriptConfig({ VITE_ANALYTICS_ENDPOINT: "https://umami.example.com", VITE_ANALYTICS_WEBSITE_ID: "00000000-0000-0000-0000-000000000000" })).not.toBeNull();
  });

  it("rejects insecure or credentialed endpoints", () => {
    const id = "site-1";
    expect(analyticsScriptConfig({ VITE_ANALYTICS_ENDPOINT: "http://umami.example.com", VITE_ANALYTICS_WEBSITE_ID: id })).toBeNull();
    expect(analyticsScriptConfig({ VITE_ANALYTICS_ENDPOINT: "https://user:pw@umami.example.com", VITE_ANALYTICS_WEBSITE_ID: id })).toBeNull();
    expect(analyticsScriptConfig({ VITE_ANALYTICS_ENDPOINT: "https://umami.example.com/?x=1", VITE_ANALYTICS_WEBSITE_ID: id })).toBeNull();
    expect(analyticsScriptConfig({ VITE_ANALYTICS_ENDPOINT: "not a url", VITE_ANALYTICS_WEBSITE_ID: id })).toBeNull();
    expect(analyticsScriptConfig({ VITE_ANALYTICS_ENDPOINT: "http://localhost:3000", VITE_ANALYTICS_WEBSITE_ID: id })?.src).toBe("http://localhost:3000/umami");
  });

  it("installs at most one script element", () => {
    const appended: { dataset: Record<string, string> }[] = [];
    const doc = {
      head: {
        querySelector: vi.fn(() => appended.find(node => node.dataset.ekittyAnalytics) ?? null),
        appendChild: vi.fn((node: { dataset: Record<string, string> }) => { appended.push(node); }),
      },
      createElement: vi.fn(() => ({ dataset: {} as Record<string, string> })),
    };
    const env = { VITE_ANALYTICS_ENDPOINT: "https://umami.example.com", VITE_ANALYTICS_WEBSITE_ID: "site-1" };
    installAnalytics(env, doc as unknown as Document);
    installAnalytics(env, doc as unknown as Document);
    expect(doc.head.appendChild).toHaveBeenCalledTimes(1);
    expect(appended[0]).toMatchObject({ src: "https://umami.example.com/umami", defer: true });
  });
});
