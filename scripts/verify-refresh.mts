import fs from "node:fs";
import { asTransactionPoints, parsePortfolioCsv } from "../client/src/lib/portfolio.ts";

const csv = fs.readFileSync("/home/ubuntu/projects/ekitty-221c7e62/Portfolio Holdings Transactions.csv", "utf8");
const parsed = parsePortfolioCsv(csv);
const points = asTransactionPoints(parsed.records);
const summary = {
  error: parsed.error ?? null,
  rows: parsed.records.length,
  datedRows: parsed.records.filter((record) => record.buy_date).length,
  etfRows: parsed.records.filter((record) => record.isETF).length,
  etfNames: Array.from(new Set(points.filter((point) => point.isETF).map((point) => point.company))),
  yearBadgeRows: points.filter((point) => (point.ageDays ?? 0) >= 365).length,
};

console.log(JSON.stringify(summary, null, 2));
