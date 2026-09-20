# ekitty — agent context

Inkfield Menagerie: a local-first portfolio visualizer where every holding or
purchase is an ink-cat mark on a white field. See `TECH-SPEC.md` for
architecture and `README.md` for usage; check/test/build commands are
documented in `TECH-SPEC.md` (run them with `pnpm`).

## Audience and priorities

- Built for non-technical portfolio owners reviewing their own CSV locally.
- Design order: **privacy first, then market neutrality, then playful legible
  ink-cat beauty.** Never invent financial facts; missing data is a missing
  mark, not an estimate.

## Mr. Bungles

- The Glass Kitty is a regal, click-only commentator: it returns one
  precomputed, digest-grounded directive per click. One bounded provider
  retry is allowed after HTTP 429; freeform model text is never accepted.
- Error surface is an allowlist (`MR_BUNGLES_ERRORS` in `shared/mrBungles.ts`).
  The server never logs or reflects upstream provider bodies; the client maps
  only allowlisted `code` values and falls back to fixed status messages.
- Catkin Gold (`#D8AE37`) is reserved for tax collars, focus rings, and key
  emphasis — never costume art or ornaments.

## Layout invariants

- A permanent 112px right icon lane (`FIELD_ICON_LANE_PX` in
  `client/src/lib/kittyField.ts`) exists in both views and all motion states.
  Holdings are hard-clamped inside `fieldViewportWidth`; transactions are
  clipped by the `data-kitty-viewport` wrapper and stay reachable by pan/fit
  — month-lane placement never changes, only the strip width shrinks.
- The pink Mickey pointer replaces the native cursor only while its overlay
  is mounted and active (`data-mouse-cursor`); reduced motion, touch, drawer
  focus, and window blur always restore the native cursor.
