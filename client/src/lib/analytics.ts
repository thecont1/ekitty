type AnalyticsEnv = {
  VITE_ANALYTICS_ENDPOINT?: string;
  VITE_ANALYTICS_WEBSITE_ID?: string;
};

export function analyticsScriptConfig(env: AnalyticsEnv): { src: string; websiteId: string } | null {
  const endpoint = env.VITE_ANALYTICS_ENDPOINT?.trim();
  const websiteId = env.VITE_ANALYTICS_WEBSITE_ID?.trim();
  if (!endpoint || !websiteId || /[\s\x00-\x1f\x7f]/.test(websiteId)) return null;
  try {
    const url = new URL(endpoint);
    const loopbackHttp = url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if ((url.protocol !== "https:" && !loopbackHttp) || url.username || url.password || url.search || url.hash) return null;
    url.pathname = `${url.pathname.replace(/\/+$/, "")}/umami`;
    return { src: url.href, websiteId };
  } catch {
    return null;
  }
}

export function installAnalytics(env: AnalyticsEnv = import.meta.env as AnalyticsEnv, doc: Document = document) {
  const config = analyticsScriptConfig(env);
  if (!config || doc.head.querySelector("script[data-ekitty-analytics]")) return;
  const script = doc.createElement("script");
  script.defer = true;
  script.dataset.ekittyAnalytics = "true";
  script.src = config.src;
  script.dataset.websiteId = config.websiteId;
  doc.head.appendChild(script);
}
