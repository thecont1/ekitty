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

export const defaultPortfolio: PortfolioLot[] = [
  { id: "lot-1", company: "Zen Technologies", buy_qty: 7, avg_price: 1482.1, current_price: 1932.6, buy_date: "2025-04-11" },
  { id: "lot-2", company: "Yes Bank", buy_qty: 150, avg_price: 24.03, current_price: 22.74, buy_date: "2025-07-10" },
  { id: "lot-3", company: "Yes Bank", buy_qty: 200, avg_price: 23.07, current_price: 22.74, buy_date: "2024-08-12" },
  { id: "lot-4", company: "Yes Bank", buy_qty: 250, avg_price: 21.15, current_price: 22.74, buy_date: "2025-05-18" },
  { id: "lot-5", company: "Whirlpool", buy_qty: 2, avg_price: 1356.85, current_price: 753.45, buy_date: "2024-05-28" },
  { id: "lot-6", company: "Whirlpool", buy_qty: 2, avg_price: 1338.98, current_price: 753.45, buy_date: "2024-09-14" },
  { id: "lot-7", company: "Whirlpool", buy_qty: 4, avg_price: 1816.55, current_price: 753.45, buy_date: "2025-02-21" },
  { id: "lot-8", company: "Walchandnagar Industries", buy_qty: 24, avg_price: 233.68, current_price: 221.86, buy_date: "2025-10-02" },
  { id: "lot-9", company: "Walchandnagar Industries", buy_qty: 23, avg_price: 201.12, current_price: 221.86, buy_date: "2025-01-20" },
  { id: "lot-10", company: "Vodafone Idea", buy_qty: 240, avg_price: 6.68, current_price: 14.07, buy_date: "2025-03-14" },
  { id: "lot-11", company: "Vodafone Idea", buy_qty: 87, avg_price: 8.15, current_price: 14.07, buy_date: "2025-06-08" },
  { id: "lot-12", company: "Vikram Solar", buy_qty: 18, avg_price: 164.52, current_price: 170.84, buy_date: "2025-10-17" },
  { id: "lot-13", company: "Vikram Solar", buy_qty: 20, avg_price: 184.65, current_price: 170.84, buy_date: "2025-12-11" },
  { id: "lot-14", company: "Varun Beverages", buy_qty: 15, avg_price: 476.75, current_price: 431.85, buy_date: "2025-02-27" },
  { id: "lot-15", company: "Varun Beverages", buy_qty: 12, avg_price: 462.68, current_price: 431.85, buy_date: "2024-07-20" },
  { id: "lot-16", company: "Ultratech Cement", buy_qty: 1, avg_price: 11510.71, current_price: 11450, buy_date: "2024-06-18" },
  { id: "lot-17", company: "Ultratech Cement", buy_qty: 1, avg_price: 12724.96, current_price: 11450, buy_date: "2025-11-29" },
  { id: "lot-18", company: "Tube Invest Of India", buy_qty: 2, avg_price: 2628.64, current_price: 2961, buy_date: "2025-02-18" },
  { id: "lot-19", company: "Tube Invest Of India", buy_qty: 3, avg_price: 2919.88, current_price: 2961, buy_date: "2025-07-09" },
  { id: "lot-20", company: "Titagarh Wagons", buy_qty: 13, avg_price: 779.91, current_price: 831.75, buy_date: "2025-01-03" },
  { id: "lot-21", company: "Titagarh Wagons", buy_qty: 11, avg_price: 795.79, current_price: 831.75, buy_date: "2025-04-12" },
  { id: "lot-22", company: "Texmaco Rail & Engineering", buy_qty: 25, avg_price: 107.37, current_price: 102.65, buy_date: "2024-05-05" },
  { id: "lot-23", company: "Texmaco Rail & Engineering", buy_qty: 40, avg_price: 140.37, current_price: 102.65, buy_date: "2025-01-31" },
  { id: "lot-24", company: "Teamlease Services", buy_qty: 5, avg_price: 1382.71, current_price: 1235.2, buy_date: "2024-06-02" },
  { id: "lot-25", company: "Tata Motors Commercial Vehicles", buy_qty: 25, avg_price: 406.73, current_price: 478.3, buy_date: "2025-09-15" },
  { id: "lot-26", company: "Tata Consultancy Services", buy_qty: 2, avg_price: 2175.65, current_price: 2289, buy_date: "2025-01-22" },
  { id: "lot-27", company: "Tata Consultancy Services", buy_qty: 2, avg_price: 3133.04, current_price: 2289, buy_date: "2025-04-02" },
  { id: "lot-28", company: "Tata Consultancy Services", buy_qty: 3, avg_price: 3725.08, current_price: 2289, buy_date: "2024-06-03" },
  { id: "lot-29", company: "Swiggy Limited", buy_qty: 10, avg_price: 356.15, current_price: 272.4, buy_date: "2024-06-11" },
  { id: "lot-30", company: "Swiggy Limited", buy_qty: 20, avg_price: 504, current_price: 272.4, buy_date: "2025-08-29" },
  { id: "lot-31", company: "Sun Pharmaceutical", buy_qty: 5, avg_price: 1617.5, current_price: 1900, buy_date: "2025-01-21" },
  { id: "lot-32", company: "Sun Pharmaceutical", buy_qty: 3, avg_price: 1753.49, current_price: 1900, buy_date: "2025-06-20" },
  { id: "lot-33", company: "Sumitomo Chemical", buy_qty: 20, avg_price: 426.33, current_price: 554.2, buy_date: "2025-02-08" },
  { id: "lot-34", company: "Saraswati Saree Depot Ltd", buy_qty: 50, avg_price: 66.56, current_price: 59.76, buy_date: "2024-07-04" },
  { id: "lot-35", company: "Saraswati Saree Depot Ltd", buy_qty: 14, avg_price: 100.36, current_price: 59.76, buy_date: "2025-03-19" },
  { id: "lot-36", company: "Reliance Industries", buy_qty: 8, avg_price: 1316.49, current_price: 1311, buy_date: "2025-07-01" },
  { id: "lot-37", company: "Reliance Industries", buy_qty: 7, avg_price: 1447.27, current_price: 1311, buy_date: "2024-05-13" },
  { id: "lot-38", company: "NTPC", buy_qty: 30, avg_price: 337.5, current_price: 399.75, buy_date: "2025-03-01" },
  { id: "lot-39", company: "IRCTC", buy_qty: 12, avg_price: 876.3, current_price: 743.2, buy_date: "2024-06-28" },
  { id: "lot-40", company: "Bharat Electronics", buy_qty: 35, avg_price: 248.5, current_price: 365.9, buy_date: "2025-01-29" },
  { id: "lot-41", company: "Indian Energy Exchange", buy_qty: 65, avg_price: 149.7, current_price: 130.45, buy_date: "2024-07-17" },
  { id: "lot-42", company: "HDFC Bank", buy_qty: 8, avg_price: 1712, current_price: 1655, buy_date: "2025-09-13" },
  { id: "lot-43", company: "ICICI Bank", buy_qty: 10, avg_price: 1088, current_price: 1387, buy_date: "2025-02-14" },
  { id: "lot-44", company: "Zomato", buy_qty: 40, avg_price: 218.5, current_price: 261.2, buy_date: "2025-05-26" },
  { id: "lot-45", company: "Larsen & Toubro", buy_qty: 3, avg_price: 3440, current_price: 3612, buy_date: "2025-04-08" },
  { id: "lot-46", company: "Suzlon Energy", buy_qty: 120, avg_price: 52.2, current_price: 66.8, buy_date: "2025-08-30" },
];
