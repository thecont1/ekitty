/**
 * Inkfield Menagerie: portfolio calculations stay exact, while visual meaning
 * is carried by the kitty field rather than a conventional dashboard.
 */

export type PortfolioLot = {
  id: string;
  company: string;
  buy_qty: number;
  avg_price: number;
  current_price: number;
  prev_close_price?: number;
  dayChange?: number;
  dayChangePercent?: number;
  buy_date?: string;
  isETF?: boolean;
};

export type PortfolioPoint = {
  id: string;
  company: string;
  qty: number;
  avgPrice: number;
  currentPrice: number;
  investedValue: number;
  currentValue: number;
  pnl: number;
  pnlPercent: number;
  previousCloseValue?: number;
  dayChange?: number;
  dayChangePercent?: number;
  lots: PortfolioLot[];
  oldestDate?: string;
  ageDays?: number;
  taxSensitive: boolean;
  isETF: boolean;
};

export type KittyScaleMetric = "invested" | "current" | "quantity" | "pnlMagnitude";

export type PortfolioStats = {
  totalInvestedValue: number;
  totalCurrentValue: number;
  totalUnrealizedPnl: number;
  totalUnrealizedPnlPercent: number;
  lotDeltas: PortfolioPoint[];
  companyDeltas: PortfolioPoint[];
};

const FORMATTED_NUMBER = /^[+-]?(?:₹|Rs\.?\s*)?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/i;

function parseCellNumber(value: string | undefined) {
  const raw = (value ?? "").trim();
  if (!raw || !FORMATTED_NUMBER.test(raw)) return NaN;
  const cleaned = raw.replace(/^(?:₹|Rs\.?\s*)/i, "").replace(/,/g, "");
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : NaN;
}

function parseCsvLine(line: string): { cells: string[]; complete: boolean; malformed: boolean } {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  let malformed = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (!quoted && cell.length > 0) {
        malformed = true;
      } else if (quoted && line[index + 1] !== "," && index + 1 < line.length) {
        malformed = true;
        quoted = false;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += character;
    }
  }
  cells.push(cell.trim());
  return { cells, complete: !quoted, malformed };
}

function stableLotId(row: string[], index: number) {
  const input = `${index}\u0000${row.join("\u0000")}`;
  let result = 2166136261;
  for (let cursor = 0; cursor < input.length; cursor += 1) {
    result ^= input.charCodeAt(cursor);
    result = Math.imul(result, 16777619);
  }
  return `upload-${(result >>> 0).toString(36)}-${index}`;
}

function normaliseHeader(value: string) {
  return value.toLowerCase().trim().replace(/[\s-]+/g, "_");
}

function findColumn(headers: string[], names: string[]) {
  return headers.findIndex((header) => names.includes(header));
}

function normaliseDateValue(value?: string) {
  const raw = value?.trim();
  if (!raw) return undefined;
  const dayFirst = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dayFirst) {
    const [, day, month, year] = dayFirst;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    return date.getFullYear() === Number(year) && date.getMonth() === Number(month) - 1 && date.getDate() === Number(day) ? `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}` : undefined;
  }
  const isoDate = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDate) {
    const [, year, month, day] = isoDate;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    return date.getFullYear() === Number(year) && date.getMonth() === Number(month) - 1 && date.getDate() === Number(day) ? raw : undefined;
  }
  // Numeric-looking dates must match one of the complete forms above; this
  // prevents partial values such as 2025-06- from rolling into another date.
  if (/^[\d\s/.-]+$/.test(raw)) return undefined;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
}

function inferEtf(company: string, instrument?: string) {
  return /\b(etf|bees)\b/i.test(`${company} ${instrument ?? ""}`) || /exchange[\s-]*traded/i.test(instrument ?? "");
}

export function parsePortfolioCsv(text: string): { records: PortfolioLot[]; error?: string } {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return { records: [], error: "The file needs a header and at least one transaction." };

  const parsedHeader = parseCsvLine(lines[0]);
  if (!parsedHeader.complete) return { records: [], error: "The header has an unclosed quoted field." };
  if (parsedHeader.malformed) return { records: [], error: "The header has malformed quote placement." };
  const headers = parsedHeader.cells.map(normaliseHeader);
  const companyColumn = findColumn(headers, ["company", "symbol", "name"]);
  const quantityColumn = findColumn(headers, ["buy_qty", "qty", "quantity", "shares"]);
  const averageColumn = findColumn(headers, ["avg_price", "buy_price", "average_price", "cost_price"]);
  const currentColumn = findColumn(headers, ["current_price", "market_price", "ltp", "price"]);
  const previousCloseColumn = findColumn(headers, ["prev_close_price", "previous_close_price", "prev_close", "previous_close", "close_price"]);
  const dateColumn = findColumn(headers, ["buy_date", "txn_date", "transaction_date", "date", "purchase_date"]);
  const instrumentColumn = findColumn(headers, ["asset_type", "asset_class", "instrument_type", "security_type", "type"]);

  if ([companyColumn, quantityColumn, averageColumn, currentColumn].some((column) => column < 0)) {
    return {
      records: [],
      error: "Expected columns: company, buy_qty, avg_price, current_price, with buy_date or date optional.",
    };
  }

  const records: PortfolioLot[] = [];
  const dataRows = lines.slice(1);
  for (let index = 0; index < dataRows.length; index += 1) {
    const line = dataRows[index];
    const rowNumber = index + 2;
    const parsedRow = parseCsvLine(line);
    if (!parsedRow.complete) return { records: [], error: `Row ${rowNumber} has an unclosed quoted field.` };
    if (parsedRow.malformed) return { records: [], error: `Row ${rowNumber} has malformed quote placement.` };
    const row = parsedRow.cells;
    if (row.length !== headers.length) {
      return { records: [], error: `Row ${rowNumber} has ${row.length} columns; expected ${headers.length}.` };
    }
    const company = row[companyColumn]?.trim();
    const quantity = parseCellNumber(row[quantityColumn]);
    const average = parseCellNumber(row[averageColumn]);
    const current = parseCellNumber(row[currentColumn]);
    const previousClose = previousCloseColumn >= 0 ? parseCellNumber(row[previousCloseColumn]) : NaN;
    const rawDate = dateColumn >= 0 ? row[dateColumn]?.trim() : undefined;
    const validDate = normaliseDateValue(rawDate);
    const instrument = instrumentColumn >= 0 ? row[instrumentColumn] : undefined;

    if (!company) return { records: [], error: `Row ${rowNumber} is missing a company.` };
    if (!Number.isFinite(quantity)) return { records: [], error: `Row ${rowNumber} has an invalid buy quantity.` };
    if (!Number.isFinite(average)) return { records: [], error: `Row ${rowNumber} has an invalid average price.` };
    if (!Number.isFinite(current)) return { records: [], error: `Row ${rowNumber} has an invalid current price.` };
    if (rawDate && !validDate) return { records: [], error: `Row ${rowNumber} has an invalid buy date.` };
    const hasPreviousClose = Number.isFinite(previousClose) && previousClose > 0;
    const dayChange = hasPreviousClose ? current - previousClose : undefined;
    records.push({
      id: stableLotId(row, index),
      company,
      buy_qty: quantity,
      avg_price: average,
      current_price: current,
      prev_close_price: hasPreviousClose ? previousClose : undefined,
      dayChange,
      dayChangePercent: dayChange === undefined ? undefined : (dayChange / previousClose) * 100,
      buy_date: validDate,
      isETF: inferEtf(company, instrument),
    });
  }

  return records.length ? { records } : { records: [], error: "No usable rows were found in this file." };
}

export function ageInDays(date?: string) {
  if (!date) return undefined;
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return Math.max(0, Math.floor((Date.now() - parsed.getTime()) / 86_400_000));
}

function pointFromLots(id: string, company: string, lots: PortfolioLot[]): PortfolioPoint {
  const qty = lots.reduce((sum, lot) => sum + lot.buy_qty, 0);
  const investedValue = lots.reduce((sum, lot) => sum + lot.buy_qty * lot.avg_price, 0);
  const currentValue = lots.reduce((sum, lot) => sum + lot.buy_qty * lot.current_price, 0);
  const pnl = currentValue - investedValue;
  const hasCompletePreviousClose = lots.length > 0 && lots.every((lot) => lot.prev_close_price !== undefined && lot.prev_close_price > 0);
  const previousCloseValue = hasCompletePreviousClose
    ? lots.reduce((sum, lot) => sum + lot.buy_qty * lot.prev_close_price!, 0)
    : undefined;
  const dayChange = previousCloseValue === undefined ? undefined : currentValue - previousCloseValue;
  const datedLots = lots.filter((lot) => lot.buy_date).sort((a, b) => new Date(a.buy_date!).getTime() - new Date(b.buy_date!).getTime());
  const oldestDate = datedLots[0]?.buy_date;
  const ageDays = ageInDays(oldestDate);
  const taxSensitive = pnl < 0 && (ageDays ?? 0) >= 330;
  const isETF = lots.every((lot) => lot.isETF);

  return {
    id,
    company,
    qty,
    avgPrice: qty ? investedValue / qty : 0,
    currentPrice: qty ? currentValue / qty : 0,
    investedValue,
    currentValue,
    pnl,
    pnlPercent: investedValue ? (pnl / investedValue) * 100 : 0,
    previousCloseValue,
    dayChange,
    dayChangePercent: dayChange === undefined || !previousCloseValue ? undefined : (dayChange / previousCloseValue) * 100,
    lots,
    oldestDate,
    ageDays,
    taxSensitive,
    isETF,
  };
}

export function asTransactionPoints(lots: PortfolioLot[]) {
  return lots.map((lot) => pointFromLots(lot.id, lot.company, [lot]));
}

export function asHoldingPoints(lots: PortfolioLot[]) {
  const grouped = new Map<string, PortfolioLot[]>();
  lots.forEach((lot) => grouped.set(lot.company, [...(grouped.get(lot.company) ?? []), lot]));
  return Array.from(grouped.entries()).map(([company, companyLots]) => pointFromLots(`holding-${company}`, company, companyLots));
}

export function computePortfolioStats(lots: PortfolioLot[]): PortfolioStats {
  const lotDeltas = asTransactionPoints(lots);
  const companyDeltas = asHoldingPoints(lots);
  const totalInvestedValue = lotDeltas.reduce((sum, point) => sum + point.investedValue, 0);
  const totalCurrentValue = lotDeltas.reduce((sum, point) => sum + point.currentValue, 0);
  const totalUnrealizedPnl = totalCurrentValue - totalInvestedValue;
  return {
    totalInvestedValue,
    totalCurrentValue,
    totalUnrealizedPnl,
    totalUnrealizedPnlPercent: totalInvestedValue ? (totalUnrealizedPnl / totalInvestedValue) * 100 : 0,
    lotDeltas,
    companyDeltas,
  };
}

export function pointScaleValue(point: PortfolioPoint, metric: KittyScaleMetric) {
  if (metric === "current") return Math.max(0, point.currentValue);
  if (metric === "quantity") return Math.max(0, point.qty);
  if (metric === "pnlMagnitude") return Math.abs(point.pnl);
  return Math.max(0, point.investedValue);
}

export function formatCurrency(value: number, compact = false) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 0,
  }).format(value);
}

export function formatPrice(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value);
}
