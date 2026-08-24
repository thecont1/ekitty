import { parsePortfolioCsv, type PortfolioLot } from "./portfolio";

export type ParsedPortfolioResponse = {
  records: PortfolioLot[];
  text: string;
  lastModified: string | null;
};

export async function parsePortfolioResponse(response: Response): Promise<ParsedPortfolioResponse> {
  if (!response.ok) {
    throw new Error(`Portfolio download failed (${response.status}).`);
  }

  const text = await response.text();
  const parsed = parsePortfolioCsv(text);
  if (parsed.error) throw new Error(parsed.error);

  return {
    records: parsed.records,
    text,
    lastModified: response.headers.get("last-modified"),
  };
}
