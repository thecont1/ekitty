# ekitty 🐈

**Your stock portfolio, drawn as a field of living ink cats.**

ekitty takes a simple spreadsheet of your share purchases and turns it into a calm, playful picture: every holding becomes a hand-drawn cat drifting around a white canvas. Bigger position → bigger cat. Profit → green cat. Loss → red cat. Old enough to be tax-loss harvesting material → a little gold medal.

No dashboards, no tickers, no logins. Just cats that mean something.

---

## What you'll see

- **A field of kitties** — each company you own is one cat, floating gently on the canvas. Cats nudge away from each other so nothing overlaps, and they bob in time with how much that stock moves.
- **Colour tells you profit or loss** — soft green for gains, red for losses, with the intensity matching how big the gain or loss is.
- **Size tells you money** — the bigger the cat, the more you have invested in it (or switch what "size" means using the visual lenses).
- **Gold collars** mark lots old enough to care about for tax-loss harvesting.
- **Hover a cat** for exact figures. **Click one** to bring it into focus. Nothing else clutters the screen until you ask for it.

## Two ways to look at your portfolio

1. **Field view** — the default constellation of all your holdings.
2. **Transactions view** — every purchase becomes its own kitty, lined up under the month you bought it. Drag sideways to travel through time, and watch your past decisions scatter across a 24-month window.

## Bring your own data

ekitty reads a plain CSV file — the kind you can export from your broker or make in any spreadsheet app. Five columns:

```
company,buy_qty,avg_price,current_price,txn_date
Zen Technologies,7,1482.10,1932.60,2025-09-10
Yes Bank,150,24.03,22.74,2026-06-16
```

Two ways to load it:

- **Drop it on the page** — drag your `portfolio.csv` anywhere onto the screen (or click the upload spot).
- Or just replace `client/public/data/portfolio.csv` before building, and it loads automatically.

Your file never leaves your computer. There's no account, no server database, no sync. The app remembers your last imported file in your own browser only.

## Things you can tweak

Open the drawer (the litter-box icon, top right):

- Switch between Field and Transactions views
- Turn ETFs on/off
- Toggle the Freeze button (stops all movement)
- Change what drives each cat's size and colour (the "lenses")
- Import a different CSV anytime

There's also a light/dark mode switch, a search box to find a specific company, a reset button, and full keyboard access — every cat is reachable with Tab and announces its numbers to screen readers. If your system asks for reduced motion, the cats politely hold still.

## Running it yourself

You need [Node.js](https://nodejs.org) (v20+) and [pnpm](https://pnpm.io).

```bash
pnpm install      # install dependencies
pnpm dev          # open http://localhost:3000
```

To run it as a real website:

```bash
pnpm build        # builds the app and a small web server
pnpm start        # serves it on http://localhost:3000
```

That's it. The whole thing is one static page plus a tiny server that just hands out files.

---

## Privacy

Everything runs in your browser. Your CSV is parsed locally, stored in your browser's local storage if you import it, and sent nowhere. The only optional network calls are Google Fonts (for the typefaces) and a self-hosted analytics beacon you can disable — see `.env.example`.

## Credits & license

Built by [Mahesh Shantaram](https://thecontrarian.in). MIT licensed — see [LICENSE](LICENSE) if present in your copy, otherwise treat it as MIT per `package.json`.

Curious how it works under the hood? See [TECH-SPEC.md](TECH-SPEC.md).
