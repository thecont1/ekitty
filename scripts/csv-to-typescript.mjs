import fs from "node:fs";

const csvPath = "/home/ubuntu/projects/ekitty-221c7e62/Portfolio Holdings Transactions.csv";
const rows = fs
  .readFileSync(csvPath, "utf8")
  .trim()
  .split(/\r?\n/)
  .slice(1)
  .map((line, index) => {
    const [company, buy_qty, avg_price, current_price, date] = line.split(",");
    return {
      id: `lot-${index + 1}`,
      company,
      buy_qty: Number(buy_qty),
      avg_price: Number(avg_price),
      current_price: Number(current_price),
      buy_date: date || undefined,
    };
  });

console.log(JSON.stringify(rows, null, 2));
