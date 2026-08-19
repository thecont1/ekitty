import fs from "node:fs";
import { asTransactionPoints, parsePortfolioCsv } from "../client/src/lib/portfolio.ts";

const csv = fs.readFileSync("/home/ubuntu/projects/ekitty-221c7e62/Portfolio Holdings Transactions.csv", "utf8");
const points = asTransactionPoints(parsePortfolioCsv(csv).records);
const serial = (date: string) => {
  const parsed = new Date(date);
  return parsed.getFullYear() * 12 + parsed.getMonth();
};
const dated = points.filter((point) => point.oldestDate);
const start = Math.min(...dated.map((point) => serial(point.oldestDate!)));
const end = Math.max(...dated.map((point) => serial(point.oldestDate!)), 2026 * 12 + 7);
const rows = points.filter((point) => point.company === "Vikram Solar" || point.company === "Bikaji Foods International").map((point) => ({
  company: point.company,
  date: point.oldestDate,
  monthIndex: serial(point.oldestDate!) - start,
  finalMonthIndex: end - start,
}));

console.log(JSON.stringify({ start, end, rows }, null, 2));
