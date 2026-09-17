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
- **Twelve costumes** add one true story per kitty: a bandage for a deep loss, brass shades-and-chain for a runaway gain, a top hat for a concentrated holding. One main costume wins; an ETF basket may join it. Switch costumes off in the drawer; gold tax collars stay independent.
- **Hover a cat** for exact figures. **Click one** to bring it into focus. Nothing else clutters the screen until you ask for it.

## Two ways to look at your portfolio

1. **Field view** — the default constellation of all your holdings.
2. **Transactions view** — every purchase becomes its own kitty, lined up under the month you bought it. Drag sideways to travel through time, and watch your past decisions scatter across a 24-month window.

## Mr. Bungles

Mr. Bungles, the Glass Kitty, points rather than chats. Click his quiet perch for one blunt, digest-grounded directive; **Show me** focuses that exact holding or purchase. He follows the active view and filters, speaks only supplied facts, and never accepts replies. Only a click sends a small portfolio digest to your configured AI provider; there is no raw CSV upload. His label dismisses with Escape, a click outside, or its close button, and cached replies last one minute.

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

Your CSV stays in your browser. There is no account, server database, or sync. The app remembers imports locally; only an explicit Mr. Bungles click sends the limited digest described above.

## Things you can tweak

Open the drawer (the litter-box icon, top right):

- Switch between Field and Transactions views
- Turn ETFs on/off
- Turn costumes on/off (on by default)
- Toggle the Freeze button (stops all movement)
- Change what drives each cat's size and colour (the "lenses")
- Import a different CSV anytime

There's also a light/dark mode switch, a search box to find a specific company, a reset button, and full keyboard access — every cat is reachable with Tab and announces its numbers to screen readers. If your system asks for reduced motion, the cats politely hold still.

## Running it yourself

You need [Node.js](https://nodejs.org) 20.19+ or 22.12+ and [pnpm](https://pnpm.io).

```bash
pnpm install      # install dependencies
pnpm dev          # open http://localhost:3000
```

To run it as a real website:

```bash
pnpm build        # builds the app and a small web server
pnpm start        # serves it on http://localhost:3000
```

That's it. The app remains a static page, with one optional server endpoint for Mr. Bungles.

To enable Mr. Bungles, copy `.env.example` to `.env` and set `MR_BUNGLES_API_KEY` and `MR_BUNGLES_MODEL` to your provider credentials and actual model identifier; `MR_BUNGLES_BASE_URL` selects an OpenAI-compatible `/v1` endpoint. These are server-only settings, never `VITE_` variables. Both `pnpm dev` and the built Express server provide `/api/mr-bungles`; a static-only host or `pnpm preview` cannot supply the AI endpoint. Without configuration the field still works and Mr. Bungles reports that he is unavailable. Use `pnpm start` for a production preview of the AI endpoint.

---

## Privacy

Portfolio parsing, calculations, costumes, and storage run locally. Clicking Mr. Bungles sends company labels, selected holding/purchase facts, totals, view/lens and scope flags to the app server and configured model provider; the raw CSV and lot arrays are not sent. The server keeps a bounded, in-memory reply cache for one minute and does not log digests. Provider retention is governed by that provider. Font requests and optional self-hosted analytics remain separate — see `.env.example`.

## Credits & license

Built by [Mahesh Shantaram](https://thecontrarian.in).

Free for individuals to use, study, and modify for personal, non-commercial purposes. Businesses that want to offer ekitty commercially need a paid license — see [LICENSE.md](LICENSE.md) or get in touch.

Curious how it works under the hood? See [TECH-SPEC.md](TECH-SPEC.md).
