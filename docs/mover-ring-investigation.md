# Mover ring investigation (dev/eveta, Aug 2026)

## Question
The legend documents a "mover ring - daily movement of at least 2%" but the
ring was indistinguishable from the focus halo and never seemed to appear.
Does day-change data actually exist and is the >=2% condition ever met?

## Findings

**Data pipeline: fully supported.**
- `parsePortfolioCsv` reads an optional `prev_close_price` column
  (aliases: previous_close_price, prev_close, close_price).
- Per lot: `dayChange = current - prev_close`, `dayChangePercent = dayChange / prev_close * 100`.
- Per holding (`pointFromLots`): value-weighted `previousCloseValue` across all
  lots of the company (only when every lot has a prev_close), then derived
  day change / percent. Same for transaction points.

**Shipped data: no movers possible.**
`client/public/data/portfolio.csv` has columns
`company,buy_qty,avg_price,current_price,txn_date` - no `prev_close_price`.
Every point therefore has `dayChangePercent === undefined` and the ring can
never trigger with the default dataset.

**Rendering: present but dead and visually confusable.**
The old code rendered `.kitty-mover-ring` (a pulsing border) whenever
`|dayChangePercent| >= 2`. With no data it never rendered; had data existed,
the ring sat at `inset-[2%]`, nearly identical to the emphasis halo at
`inset-[3%]`.

## Resolution
Feature-flagged rather than deleted or left rendering a lie:

- `MOVER_RING_ENABLED = false` in `client/src/pages/Home.tsx`, gated in
  `CatGlyph.isMover`, with the full investigation note inline.
- The legend's mover-ring entry was removed so we don't document a feature
  that cannot fire.
- `kittyField.test.ts` pins both facts: the shipped CSV has no prev_close
  column, and a CSV *with* prev_close produces correct mover candidates
  (>=2% vs <1%).

## To enable
1. Add a `prev_close_price` column to portfolio.csv (or wire a live feed).
2. Flip `MOVER_RING_ENABLED = true`.
3. Restyle the ring distinctly from the focus halo (different stroke pattern
   and/or palette color) before shipping - see Step 10 styling guidance.
