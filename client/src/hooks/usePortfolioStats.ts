import { computePortfolioStats, type PortfolioLot } from "@/lib/portfolio";
import { useMemo } from "react";

export function usePortfolioStats(lots: PortfolioLot[]) {
  return useMemo(() => computePortfolioStats(lots), [lots]);
}
