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
  lots: PortfolioLot[];
  oldestDate?: string;
  ageDays?: number;
  taxSensitive: boolean;
  isETF: boolean;
};

const CLEAN_NUMBER = /[^0-9.-]/g;

function parseCellNumber(value: string | undefined) {
  const number = Number((value ?? "").replace(CLEAN_NUMBER, ""));
  return Number.isFinite(number) ? number : NaN;
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        cell += '"';
        index += 1;
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
  return cells;
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
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString().slice(0, 10);
}

function inferEtf(company: string, instrument?: string) {
  return /\b(etf|bees)\b/i.test(`${company} ${instrument ?? ""}`) || /exchange[\s-]*traded/i.test(instrument ?? "");
}

export function parsePortfolioCsv(text: string): { records: PortfolioLot[]; error?: string } {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return { records: [], error: "The file needs a header and at least one transaction." };

  const headers = parseCsvLine(lines[0]).map(normaliseHeader);
  const companyColumn = findColumn(headers, ["company", "symbol", "name"]);
  const quantityColumn = findColumn(headers, ["buy_qty", "qty", "quantity", "shares"]);
  const averageColumn = findColumn(headers, ["avg_price", "buy_price", "average_price", "cost_price"]);
  const currentColumn = findColumn(headers, ["current_price", "market_price", "ltp", "price"]);
  const dateColumn = findColumn(headers, ["buy_date", "txn_date", "transaction_date", "date", "purchase_date"]);
  const instrumentColumn = findColumn(headers, ["asset_type", "asset_class", "instrument_type", "security_type", "type"]);

  if ([companyColumn, quantityColumn, averageColumn, currentColumn].some((column) => column < 0)) {
    return {
      records: [],
      error: "Expected columns: company, buy_qty, avg_price, current_price, with buy_date or date optional.",
    };
  }

  const records = lines.slice(1).flatMap((line, index) => {
    const row = parseCsvLine(line);
    const company = row[companyColumn]?.trim();
    const quantity = parseCellNumber(row[quantityColumn]);
    const average = parseCellNumber(row[averageColumn]);
    const current = parseCellNumber(row[currentColumn]);
    const validDate = normaliseDateValue(dateColumn >= 0 ? row[dateColumn] : undefined);
    const instrument = instrumentColumn >= 0 ? row[instrumentColumn] : undefined;

    if (!company || !Number.isFinite(quantity) || !Number.isFinite(average) || !Number.isFinite(current)) return [];
    return [{ id: `upload-${Date.now()}-${index}`, company, buy_qty: quantity, avg_price: average, current_price: current, buy_date: validDate, isETF: inferEtf(company, instrument) }];
  });

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


