# Timeline storytelling spike — review checkpoint

Status: prototype/design decision only; not shipped.

## Proposed v1

Render two cumulative series behind the Transactions field, aligned to the same literal month axis:

- cumulative invested cost basis
- cumulative mark-to-current value

The layer is non-interactive, low-opacity, and visible only while Freeze is active. It must not introduce an independent chart axis or compete with the kitty marks.

## Data caveat

A current-value series by transaction date is not historical portfolio value. With only today's `current_price`, it answers “what would each accumulated lot be worth at today's marks?”, not “what was the portfolio worth then?”. The latter requires dated price snapshots. The prototype must label this distinction explicitly.

## Review gate

Before shipping, compare the frozen Transactions field with and without the layer at desktop and mobile widths. Ship only if month orientation improves without reducing kitty legibility. Otherwise reject the feature; the canvas remains sovereign.

## Day-change model decision

`prev_close_price` is optional per CSV lot. Company/day-mover values are available only when every contributing lot has a valid positive previous close. Partial coverage is shown as unavailable, never imputed as zero movement. Existing CSVs remain valid and simply do not activate mover rings.
