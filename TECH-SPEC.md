# ekitty — Technical Spec

Architecture, tech stack, and the reasoning behind the non-obvious decisions. For the friendly overview, read [README.md](README.md).

---

## 1. What it is

ekitty is a single-page client-side application that visualises an equity portfolio as an animated "field" of SVG cat glyphs. There is no backend database, no auth, no API surface: the Express server that ships in production exists only to serve static files. All portfolio math, CSV parsing, layout, and animation run in the browser.

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
server/index.ts           # production static file server (Express)
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
- **No backend logic.** `server/index.ts` is ~30 lines. Everything security- or money-relevant is client-side and offline-capable by design.

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

## 4. Rendering and animation

Two independent motion systems:

**Field physics** — a `requestAnimationFrame` loop inside `Home.tsx` integrates per-node velocities: spring pull toward a personal anchor point, inverse-distance repulsion between neighbouring kitties, and soft pressure from canvas edges. Bobbing amplitude/frequency derives from each record's volatility and P&L movement. Node positions live in refs, not React state — React never re-renders per frame; the loop writes transforms directly.

**Camera** — pan/zoom is a separate transform layer ("world" divs for grid, kitties, and the dateline) moved with GSAP tweens (`force3D`, shared easing). Drag-to-zoom on the month viewport, viewport reset, and focus-on-company all route through one `cameraTween` ref so animations never stack.

**Accessibility constraints baked into motion:**
- `prefers-reduced-motion` freezes the field entirely (`effectiveFrozen`) while keeping every interaction functional.
- Every cat is a real `<button>` with a fully descriptive `aria-label` (company, profit/loss, amount, percent, active lens, ETF/tax status), visible focus ring in Catkin Gold, and Tab order that hides search-filtered-out cats.
- Controls meet 48px minimum touch targets; hover affordances have focus equivalents.

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
- **Two custom dev-only Vite plugins** live inline in `vite.config.ts`:
  1. **Storage proxy** — serves `/data/*` from local `client/public/data/`, the canonical privacy-preserving source. Missing files return 404.
  2. **jsx-loc plugin** — injects source-location attributes for debugging.
- **Analytics is opt-in via env.** `VITE_ANALYTICS_ENDPOINT` / `VITE_ANALYTICS_WEBSITE_ID` (self-hosted Umami) are interpolated into `client/index.html`; copy `.env.example` → `.env` or the script tag resolves empty. No third-party analytics by default.
- **Type-checking is a gate:** `pnpm check` runs `tsc --noEmit`; formatting is Prettier (`.prettierrc`).

## 7. Testing

Unit tests target the **pure layers** — `lib/portfolio.test.ts`, `portfolioAcceptance.test.ts`, `portfolioVisuals.test.ts`, `uiState.test.ts` — covering CSV edge cases, aggregation correctness, percentile/normalisation behaviour, and UI-state helpers. Run with `npx vitest` (Vitest 2).

The rendering layer is validated through acceptance scripts rather than component tests:

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

## 9. Extension points

If you're picking this up:

- **New visual lens:** add a variant to `VisualLens` in `portfolioVisuals.ts`, implement its size/color raw-score functions, register it in the drawer's lens selector, extend legend content in `PortfolioLegend.tsx`.
- **New CSV column:** extend `PortfolioLot` and the parser, then decide whether it feeds calculation (`portfolio.ts`), visuals (`portfolioVisuals.ts`), or both. Add acceptance coverage mirroring `portfolioAcceptance.test.ts`.
- **Live prices:** would require either a tiny proxy endpoint in `server/index.ts` or a user-supplied quote CSV merge in `parsePortfolioCsv`'s output shape. The day-change model in `docs/timeline-storytelling-spike.md` already defines how partial coverage must degrade.
