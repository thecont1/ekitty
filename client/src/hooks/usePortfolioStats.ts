import { computePortfolioStats, type PortfolioLot } from "@/lib/portfolio";
import { DEFAULT_MARKET_PROFILE, type MarketProfile } from "@shared/marketProfiles";
import { useMemo } from "react";

export function usePortfolioStats(lots: PortfolioLot[], marketProfile: MarketProfile = DEFAULT_MARKET_PROFILE) {
  return useMemo(() => computePortfolioStats(lots, marketProfile), [lots, marketProfile]);
}
