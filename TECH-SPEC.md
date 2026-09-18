# ekitty — Technical Spec

Architecture, tech stack, and the reasoning behind the non-obvious decisions. For the friendly overview, read [README.md](README.md).

---

## 1. What it is

ekitty is a single-page client-side application that visualises an equity portfolio as an animated "field" of SVG cat glyphs. There is no backend database or auth; Express serves static files plus the optional `POST /api/mr-bungles` endpoint. Portfolio calculations, CSV parsing, layout, costume state, and digest construction remain client-side.

Repo layout:

```
client/
  index.html              # Vite entry; fonts, analytics snippet
  public/data/            # canonical portfolio.csv (served at /data/)
  src/
    pages/Home.tsx        # the entire field: physics loop, camera, interactions
    components/           # PortfolioKittySvg, Drawer, Header, Legend, ErrorBoundary
    lib/
      portfolio.ts        # CSV parsing + all financial calculations (pure)
      portfolioVisuals.ts # visual encoding: size/pigment/emphasis per lens (pure)
      uiState.ts          # UI state helpers (pure)
      *.test.ts           # vitest unit tests for the pure modules
    hooks/                # usePersistFn, useComposition, useMobile
    contexts/ThemeContext # light/dark mode
shared/const.ts           # constants shared between client and server
shared/mrBungles.ts       # Mr. Bungles digest schema + grounded directive builders (client and server)
server/index.ts           # production static file server (Express) + /api/mr-bungles mount
server/mrBungles.ts       # validated, rate-limited, cached router for /api/mr-bungles
server/mrBunglesProvider.ts # OpenAI-compatible provider call (server env only)
server/mr-bungles-prompt.ts # Mr. Bungles system/wire contract
scripts/                  # one-off data verification scripts (.mts)
vite.config.ts            # build config + three custom dev plugins
```

## 2. Stack

| Layer | Choice | Version |
| --- | --- | --- |
| Language | TypeScript (strict, `tsc --noEmit` gate) | 5.6 |
| UI framework | React | 19.2 |
| Build tool | Vite | 7 |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite`, CSS-first config) | 4.1 |
| Component library | shadcn/ui-style Radix primitives in `components/ui/` | — |
| Animation | GSAP (camera tweens) + hand-rolled `requestAnimationFrame` physics | 3.15 |
| Charts | None in the shipped path (recharts present only for a `ui/chart.tsx` shim) | — |
| Server (prod) | Express static file server, bundled with esbuild | 4.21 |
| Router | wouter (patched — see §6) | 3.7 |
| Forms/validation | react-hook-form + zod v4 | — |
| Tests | Vitest | 2.1 |
| Package manager | pnpm 10 (enforced via `packageManager` + SHA-512 pin) | 10.4 |
| License | Dual: non-commercial free / commercial paid — see [LICENSE.md](LICENSE.md) | — |

### Deliberate absences

- **No state-management library.** The app is one screen; `useState`/`useMemo` in `Home.tsx` plus a theme context cover it. Redux/Zustand would be architecture tourism.
- **No charting library.** The transaction timeline is drawn as positioned DOM nodes on a GSAP-transformed world container, not as a chart. A chart lib would fight the physics-field metaphor.
- **No backend portfolio logic.** The sole exception is `POST /api/mr-bungles`: a bounded, validated, cached forwarder to an env-configured model provider; portfolio calculations stay client-side.

## 3. Data model and pipeline

**Source of truth:** a CSV with columns `company, buy_qty, avg_price, current_price, txn_date`, plus optional `prev_close_price`. One row = one purchase lot. The canonical file lives at `client/public/data/portfolio.csv` and is fetched from `/data/portfolio.csv`.

Pipeline:

1. **Parse** — `parsePortfolioCsv()` in `lib/portfolio.ts`. Hand-rolled line/cell parser (handles quoted cells, `\r\n`, currency symbols via a `[^0-9.-]` scrub). No CSV dependency; parsing is pure and unit-tested.
2. **Aggregate** — lots roll up into company-level `PortfolioPoint`s: invested value, current value, absolute and percentage P&L, lot age, tax sensitivity, ETF flag.
3. **Derive visuals** — `portfolioVisuals.ts` maps each point to size / pigment / emphasis under the active *visual lens*:
   - `portfolio-impact` — size from position value, colour from P&L sign and magnitude
   - `trade-quality` — size from P&L magnitude, colour from entry quality
   - `capital-at-risk` — alternative risk-weighted encoding
   - Normalisation uses linear or √ scaling with clamped percentiles so one whale holding doesn't flatten the entire palette.
4. **Layout** — two placement modes: a force-directed field (anchor pull + peer repulsion + edge pressure) for the default view; literal month-strip placement ordered by `txn_date` for Transactions view.
5. **Animate** — see §4.

### Data honesty rules

These are enforced in code, not convention:

- **Day-change is never imputed.** `prev_close_price` is optional per lot. Day-mover values are computed only when *every* contributing lot has a valid positive previous close; partial coverage renders as "unavailable", never zero.
- **Current-value-by-date ≠ historical value.** The (prototype-stage) cumulative series idea is explicitly gated in `docs/timeline-storytelling-spike.md`: with only today's marks, a dated value series answers "what would accumulated lots be worth today", not "what was the portfolio worth then". The doc requires explicit labelling and a ship/reject review gate.
- Uploaded CSVs are stored in `localStorage` under `ekitty-portfolio-csv`; "Reload portfolio.csv" clears it and refalls back to the served file (whose `Last-Modified` becomes the "data updated" dateline).
- Tax flags are the existing loss-plus-330-day age heuristic, not verified tax eligibility. Holding age means oldest known lot; no missing dates, prior closes, history, volatility, or quote freshness are invented.

## 4. Rendering and animation

Two independent motion systems:

**Field physics** — a `requestAnimationFrame` loop inside `Home.tsx` integrates per-node velocities: spring pull toward a personal anchor point, inverse-distance repulsion between neighbouring kitties, and soft pressure from canvas edges. Bobbing amplitude/frequency derives from each record's volatility and P&L movement. Node positions live in refs, not React state — React never re-renders per frame; the loop writes transforms directly.

**Camera** — pan/zoom is a separate transform layer ("world" divs for grid, kitties, and the dateline) moved with GSAP tweens (`force3D`, shared easing). Drag-to-zoom on the month viewport, viewport reset, and focus-on-company all route through one `cameraTween` ref so animations never stack.

**Accessibility constraints baked into motion:**
- `prefers-reduced-motion` freezes the field entirely (`effectiveFrozen`) while keeping every interaction functional.
- Every cat is a real `<button>` with a fully descriptive `aria-label` (company, profit/loss, amount, percent, active lens, ETF/tax status), visible focus ring in Catkin Gold, and Tab order that hides search-filtered-out cats.
- Controls meet 48px minimum touch targets; hover affordances have focus equivalents.

### Costume semantics

Each kitty may wear one main costume (plus an ETF basket). `deriveCostumeStates()` in `client/src/lib/portfolioCostumes.ts` computes the eligible states per record; `COSTUME_ORDER` decides priority, the first non-`basket` eligible state is drawn, and any remaining eligible states are not drawn. Share denominators are the ETF-filtered portfolio *before* search or tax-isolate filters; a share is unavailable when denominator inputs are negative or non-finite. The costume palette uses brass `#9b5939`/`#d79b79` — never Catkin Gold — and adds no animation beyond the base bob; costumes freeze under reduced motion and the Freeze control.

| Costume | Field view | Transactions view |
| --- | --- | --- |
| Wounded | Bandage · blended loss of at least 25%. | Bandage · this purchase has lost at least 25%. |
| Monopoly | Top hat + green coat · at least 20% of portfolio current value. | — |
| Firefighter | — | Fire jacket · this purchase used at least 10% of invested capital. |
| Parachute | Parachute · holding down at least 2% today; every lot covered. | Parachute · purchase down at least 2% today; prior close known. |
| Rocket | Rocket pack · holding up at least 2% today; every lot covered. | Rocket pack · purchase up at least 2% today; prior close known. |
| Strutting | Brass chain + shades · blended gain of at least 50%. | Brass chain + shades · this purchase has gained at least 50%. |
| Patchwork | Split coat · winning and losing purchases within one holding. | — |
| Fledgling | Eggshell cap · every purchase is dated and under 30 days old. | Eggshell cap · this purchase is under 30 days old. |
| Veteran | Reading glasses · oldest known purchase is at least 730 days old. | Reading glasses · this purchase is at least 730 days old. |
| Tightrope | Balance pole · blended return is within 1% of break-even. | Balance pole · this purchase is within 1% of break-even. |
| Fog | Dotted veil · day-change unavailable for the complete holding. | Dotted veil · day-change unavailable for this purchase. |
| Basket | Woven basket · all contributing lots are classified as ETF. | Woven basket · this purchase is classified as ETF. |

## 5. Design system decisions

The design language ("Inkfield Menagerie", documented in `ideas.md`) drives several technical choices:

- **White canvas sovereignty.** All controls are hidden until summoned; the only persistent chrome is the litter-box drawer toggle. This is why there's no header/nav component tree beyond a thin header and floating controls.
- **Typography:** DM Mono for everything numeric/control, Fraunces reserved for the drawer title and focus label (editorial contrast), loaded via Google Fonts with `display=swap`.
- **Catkin Gold `#D8AE37` is semantically reserved** for tax-loss collars, focus rings, and key emphasis — never decoration. Enforced by convention in `portfolioVisuals.ts` and index.css tokens.
- **Colour direction:** gains use alpine-to-emerald greens, losses clay-to-rose reds (`#17885b`/`#ff3b3b`, dark-mode variants `#4ade80`/`#ff6b6b`). Dark mode is a full token set in `index.css` toggled through `ThemeContext`, not a filter.
- **Glyphs are information marks**, not mascot art: `PortfolioKittySvg.tsx` parameterises stroke, fill pigment, collar, lean, whisker energy per record, so variation encodes data.

## 6. Tooling and build decisions

- **pnpm pinned by hash** (`packageManager` + `pnpm-lock.yaml`) — reproducible installs across machines; also enables `patchedDependencies`.
- **wouter is patched** (`patches/wouter@3.7.1.patch`). The patch is declared in `pnpm.overrides`-style config so it survives lockfile regeneration. If you bump wouter, re-check the patch applies.
- **esbuild bundles the server separately** from Vite (`server/index.ts → dist/index.js`, `--packages=external`): the server keeps normal Node resolution for express while the client gets Vite's optimised bundle. One `pnpm build` produces both.
- **Vite root points at `client/`**, aliases `@` → `client/src`, `@shared` → `shared/`. Output goes to `dist/public`, matching what the Express server serves.
- **Three custom dev-only Vite plugins** live inline in `vite.config.ts`:
  1. **Storage proxy** — serves `/data/*` from local `client/public/data/`, the canonical privacy-preserving source. Missing files return 404.
  2. **jsx-loc plugin** — injects source-location attributes for debugging.
  3. **Mr. Bungles route** — mounts the same `createMrBunglesRouter` used in production at `/api/mr-bungles`, so dev and prod share the endpoint.
- **Analytics is opt-in via env.** `VITE_ANALYTICS_ENDPOINT` / `VITE_ANALYTICS_WEBSITE_ID` (self-hosted Umami) are interpolated into `client/index.html`; copy `.env.example` → `.env` or the script tag resolves empty. No third-party analytics by default.
- **Type-checking is a gate:** `pnpm check` runs `tsc --noEmit`; formatting is Prettier (`.prettierrc`).

### Mr. Bungles

Mr. Bungles is an optional, click-only AI commentary feature: the Glass Kitty perch speaks one grounded directive per click.

- **Digest construction is client-side and validated twice.** `shared/mrBungles.ts` defines a strict Zod schema for the digest and the reply; the client and endpoint separately enforce a 32 KiB request limit. The digest carries at most 13 targets: the union of the top 3 by concentration, worst losers, best gainers (by rupee P&L), and day movers (by absolute percent), plus one quiet curiosity. Holdings use company totals; transactions use the exact lot. Totals cover the full ETF-filtered portfolio, while targets respect the active search and tax-isolate filters.
- **The model selects, never writes.** The system/wire contract in `server/mr-bungles-prompt.ts` instructs the model to return exactly one of the digest's precomputed, grounded utterances — not a freeform financial forecast. The response is validated verbatim against the digest on the server *and* again in the client. The persona has no chat channel, signature, or disclaimer; the single app-level disclaimer lives in the portfolio legend.
- **Provider wiring:** the server provider (`server/mrBunglesProvider.ts`) calls an OpenAI-compatible Chat Completions endpoint over native `fetch`, configured only via server env `MR_BUNGLES_BASE_URL` / `MR_BUNGLES_MODEL` / `MR_BUNGLES_API_KEY` (read from `.env` through `process.loadEnvFile`). The base URL defaults to OpenAI and is configurable; the model identifier must be configured. The API key never reaches the client bundle.
- **Operation bounds:** server reply cache 64 entries / 60 s, client cache 8 entries / 60 s (memory only); identical in-flight requests deduplicate, at most 4 concurrent distinct calls, and at most 30 new provider calls per rolling minute per process. The provider deadline is 20 s and the provider body is capped at 64 KiB. Failure map: malformed JSON/schema → 400, oversized body → 413, wrong content type → 415, non-POST → 405, foreign origin → 403, schema-valid digest without actionable targets → 422, busy or rate-limited → 429, unconfigured → 503, ungrounded or upstream failure → 502.
- This is **not** distributed rate control or auth; public deployments that need additional abuse resistance should add edge controls rather than new infrastructure here. Static-only hosting or `pnpm preview` cannot supply the endpoint — the field still works and Mr. Bungles reports himself unavailable.

## 7. Testing

Unit tests target the **pure layers** — `lib/portfolio.test.ts`, `portfolioAcceptance.test.ts`, `portfolioVisuals.test.ts`, `uiState.test.ts` — covering CSV edge cases, aggregation correctness, percentile/normalisation behaviour, and UI-state helpers. Because the Vite root is `client/`, all tests — including the server HTTP endpoint tests (`lib/mrBunglesEndpoint.test.ts`) — live under `client/src`. Run with `pnpm test` or `pnpm exec vitest` (Vitest 2).

SSR component tests cover glyph paths, costume layers, accessible labels, and legend scope. Browser checks validate perceptual rendering and interaction at desktop/mobile sizes, in both themes, with keyboard and reduced motion. Additional data acceptance scripts include:

- `scripts/verify-august-placement.mts` — asserts specific companies' transactions land in the correct literal month serials on the timeline axis.
- `scripts/verify-refresh.mts` — parses the current canonical CSV and summarises rows/dated rows/ETF classification/year-badge eligibility against expectations after each data refresh.

(Both scripts contain hardcoded paths from their original authoring environment; update the path before reuse.)

This split is deliberate: financial math must be exact and regression-tested; the physics field is perceptual and is verified visually at desktop/mobile breakpoints (see `gsap_camera_validation.md` for the camera migration validation notes).

## 8. Known constraints and sharp edges

- **Single-page scope.** wouter routes exist for `/` and a 404 fallback; there is no deep-linkable state (drawer open, selected cat, zoom). State is intentionally ephemeral except the imported CSV.
- **localStorage as the only persistence.** Clearing site data loses an uploaded portfolio. The canonical `portfolio.csv` in-repo is the durable record.
- **Prices are manual.** `current_price` comes from whatever produced the CSV. Nothing fetches live quotes — a privacy choice, not an oversight.
- **Timeline caps at a 24-month window** with right-anchored drag-zoom; older months remain reachable via navigation but never render simultaneously.
- **Dev scripts assume Linux paths** (`scripts/*.mts`); they're migration artifacts from the original build environment, not part of the runtime.
- **Map iterators need `Array.from`.** The TS target predates downlevel iteration; spread/`for…of` over `Map` iterators fails typecheck — collect with `Array.from(...)` instead.
- **Do not exclude tests from `tsconfig.json`.** An excluded test opens in an IDE inferred project without `paths`, so imports such as `@shared/*` degrade to `any` and callbacks report `noImplicitAny`; keeping tests included makes editor diagnostics match `pnpm check`.
- **Tailwind v4 `focus-visible:outline` never sets `outline-style`.** Use `focus-visible:outline-solid` for focus rings on non-`button`/`select`/`input` elements (the global rule in `index.css` covers only those three).
- **Standalone SVG mounts need explicit size.** `PortfolioKittySvg` carries no width/height attributes; browser-default 300×150 overflows small wrappers — set `width:100%;height:100%` (or fixed dims) on the host.
- **Guard stale async `finally` blocks by controller.** When a new request can start before an old one settles, compare `pendingAbort.current !== controller` inside `finally` so an old request can't clear the new one's busy state or timeout.

## 9. Extension points

If you're picking this up:

- **New visual lens:** add a variant to `VisualLens` in `portfolioVisuals.ts`, implement its size/color raw-score functions, register it in the drawer's lens selector, extend legend content in `PortfolioLegend.tsx`.
- **New CSV column:** extend `PortfolioLot` and the parser, then decide whether it feeds calculation (`portfolio.ts`), visuals (`portfolioVisuals.ts`), or both. Add acceptance coverage mirroring `portfolioAcceptance.test.ts`.
- **Live prices:** would require either a tiny proxy endpoint in `server/index.ts` or a user-supplied quote CSV merge in `parsePortfolioCsv`'s output shape. The day-change model in `docs/timeline-storytelling-spike.md` already defines how partial coverage must degrade.
