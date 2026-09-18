# ekitty Privacy Policy

*Effective 18 September 2026 · applies to every ekitty deployment, including self-hosted copies.*

---

## The short version

ekitty keeps your portfolio to itself. Everything you see is computed inside your own browser, from a spreadsheet you supply. There are no accounts, no brokerage links, no sync. One feature — Mr. Bungles, our resident glass cat — can send a small numerical digest to the AI provider this deployment is configured with, under a key held only by that deployment's server. That happens only when you click him. Nothing else ever leaves this page.

If you stop reading here, you have not missed anything we would rather you not know.

## What we never collect

- Your portfolio, your trades, your balances
- Your name, email, or any identifier
- IP logs beyond the unremarkable bookkeeping of any web server
- Cookies — ekitty sets none

Your portfolio file is parsed locally and stays inside your browser's local storage. Clearing your browser data removes it completely. For the strictest posture, self-host ekitty: the whole application, and even its small relay, can run on a machine you own.

## What Mr. Bungles sends — and only when you ask

Mr. Bungles answers on click, powered by the AI service this deployment is configured with — an OpenAI-compatible endpoint chosen and keyed by whoever runs the deployment.

When you click him — and only then — a digest of about one screen's worth of numbers travels to that service:

- portfolio totals (invested amount, current value, net P&L)
- a handful of holdings by name, with their currency figures and calculated statuses
- which view and lens you are looking at

The digest consists entirely of *numbers ekitty has already computed*. It contains no personal identifiers and no connection to your brokerage. The request is not stored by us — not the digest, not the response, not usage statistics. Mr. Bungles' brief cache lives in the relay's memory and expires in moments.

## The provider key

The AI provider key is configured by whoever runs this ekitty deployment and lives only in the server's environment. It is never shipped to your browser, never written into the client bundle, never logged, and held in memory only for the duration of a request. Rotating or removing it is a deployment configuration change — no key is stored in your browser to delete.

## Third parties

The only third parties ekitty contacts:

1. **Google Fonts**, for two typefaces (your browser shares its IP with fonts.google.com, as with any font request), unless you self-host the fonts.
2. **The deployment's configured AI provider**, only upon clicking Mr. Bungles.
3. **The deployment's analytics endpoint**, only when the deployment has opted in — ekitty ships with analytics off by default; an enabled deployment sends Umami page-view and navigation telemetry to its configured endpoint, never portfolio data.

Any processing of the digest by the AI provider is governed by the deployment's agreement with that provider. Self-hosters choose a provider whose terms suit them; that freedom is the entire point of the bring-your-own-deployment design.

## Children

ekitty is a glorified graph of cats. It does not knowingly collect anything from anyone, of any age, because it does not collect anything at all.

## Changes

If this policy ever changes, the page you are reading is the authoritative copy, versioned openly in the public repository with the date above. No change will ever make data collection opt-out-by-default.

## A note on advice

Mr. Bungles occasionally says "sell that kitty." Remember he is, in the final analysis, a cat. A splendidly confident, well-read, impeccably-behaved cat — but a cat. Nothing in ekitty constitutes financial, tax, or investment advice, in India or anywhere; consult a human professional for decisions that carry money or liability.

## Questions

Write to [ms@thecontrarian.in](mailto:ms@thecontrarian.in). You will receive a human answer.

— Mahesh Shantaram · [thecontrarian.in](https://thecontrarian.in)
