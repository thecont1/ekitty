export type MarketProfileId = "india" | "us" | "singapore" | "uk";

export type MarketProfile = {
  id: MarketProfileId;
  label: string;
  locale: string;
  currency: string;
  taxReviewAgeDays: number | null;
};

export const MARKET_PROFILES: Record<MarketProfileId, MarketProfile> = {
  india: { id: "india", label: "India · INR", locale: "en-IN", currency: "INR", taxReviewAgeDays: 330 },
  us: { id: "us", label: "United States · USD", locale: "en-US", currency: "USD", taxReviewAgeDays: 365 },
  singapore: { id: "singapore", label: "Singapore · SGD", locale: "en-SG", currency: "SGD", taxReviewAgeDays: null },
  uk: { id: "uk", label: "United Kingdom · GBP", locale: "en-GB", currency: "GBP", taxReviewAgeDays: null },
};

export const MARKET_PROFILE_ORDER: MarketProfileId[] = ["india", "us", "singapore", "uk"];
export const DEFAULT_MARKET_PROFILE = MARKET_PROFILES.india;

export function getMarketProfile(id: string | null | undefined): MarketProfile {
  return id && id in MARKET_PROFILES ? MARKET_PROFILES[id as MarketProfileId] : DEFAULT_MARKET_PROFILE;
}

export function isTaxReviewLoss(pnl: number, ageDays: number | undefined, profile: MarketProfile): boolean {
  return profile.taxReviewAgeDays !== null && pnl < 0 && ageDays !== undefined && ageDays >= profile.taxReviewAgeDays;
}

export function formatMarketMoney(value: number, profile: MarketProfile, options: { compact?: boolean; price?: boolean } = {}) {
  return new Intl.NumberFormat(profile.locale, {
    style: "currency",
    currency: profile.currency,
    notation: options.compact ? "compact" : "standard",
    maximumFractionDigits: options.price ? 2 : options.compact ? 1 : 0,
  }).format(value);
}

export function formatMarketNumber(value: number, profile: MarketProfile, maximumFractionDigits = 4) {
  return new Intl.NumberFormat(profile.locale, { maximumFractionDigits }).format(value);
}

export function formatMarketPercent(value: number, profile: MarketProfile, maximumFractionDigits = 2) {
  return `${new Intl.NumberFormat(profile.locale, { maximumFractionDigits }).format(value)}%`;
}

export function formatMarketDate(value: string | Date, profile: MarketProfile) {
  const calendarDay = typeof value === "string" ? value.match(/^(\d{4})-(\d{2})-(\d{2})$/) : null;
  const date = calendarDay ? new Date(Number(calendarDay[1]), Number(calendarDay[2]) - 1, Number(calendarDay[3])) : new Date(value);
  return new Intl.DateTimeFormat(profile.locale, { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

export function formatMarketMonth(serial: number, profile: MarketProfile) {
  return new Intl.DateTimeFormat(profile.locale, { month: "short", year: "2-digit" }).format(new Date(Math.floor(serial / 12), serial % 12, 1));
}

export function taxReviewDescription(profile: MarketProfile) {
  return profile.taxReviewAgeDays === null
    ? "No age-based tax flag for this market profile"
    : `${profile.taxReviewAgeDays}+ day loss · review flag`;
}
