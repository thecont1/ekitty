# ekitty design directions

## Three possible directions

### 1. Inkfield Menagerie
**Very Brief Intro:** A gallery-like white field where expressive ink cats drift like living portfolio marks, with restrained colour signaling financial movement.

**Probability:** 0.07

### 2. Paper Ledger Playground
**Very Brief Intro:** A tactile editorial system inspired by annotated investing notebooks, bringing data closer through warm paper, stamps, and pencilled motion.

**Probability:** 0.04

### 3. Neon Ticker Night
**Very Brief Intro:** A dark, electric market terminal rendered as a lively constellation of cats, designed around dramatic contrast and high-energy motion.

**Probability:** 0.08

## Chosen approach: Inkfield Menagerie

### Design Movement
**Minimal editorial information art**: the calm precision of a museum label system combined with playful, hand-drawn visual marks. The interface treats the browser viewport as a white exhibition wall rather than a dashboard.

### Core Principles
1. **The canvas remains sovereign.** Financial data is visible as animated kitties; all controls stay hidden until deliberately invoked.
2. **Meaning appears through embodiment.** Scale, pigment, stroke, collar, and motion make portfolio properties felt before they are read.
3. **Precision arrives on demand.** Hover and focus surfaces contain exact figures but remain compact, carefully layered, and temporary.
4. **Human movement, clear signals.** Organic easing and small asymmetries make the cats charming without obscuring status, hierarchy, or calculation.

### Color Philosophy
The base canvas is uncompromising white, treating space as a neutral ground for investor attention. Green positions use soft alpine-to-emerald tints rather than trading-terminal green; losses use clay-to-rose tones rather than alarm red. Gold is reserved for qualifying tax-loss attention, while silver signals ordinary lots. Ink charcoal anchors outlines and all interface type.

### Layout Paradigm
The primary layout is a **field composition**, not a grid: nodes settle naturally across the visible viewport with soft edge pressure and peer avoidance. The sole persistent control is a detached corner switch. When needed, a right-side drawer overlays the field without reformatting it; an individual detail label may appear anchored beside a selected cat.

### Signature Elements
1. **Ink-outline kitty glyphs** with coloured bodies, soft collar medals, and energetic hand-like whiskers.
2. **A quiet market halo** on hover/focus: a thin ring and a small contextual label that feels like a curator’s annotation.
3. **Ragged micro-motion**: ears, whiskers, and bodies drift on different cycles to avoid mechanical uniformity.

### Interaction Philosophy
Interactions should feel like picking up a piece from a tabletop: hover reveals a slender fact tag, click brings a cat into focus with nearby detailed context, and drawer changes visibly remap the field immediately. Controls never promise actions they do not execute.

### Animation
Nodes use a requestAnimationFrame physics loop, with positions gently pulled toward personal anchors while repelling nearby kitties and the canvas edges. Bobbing derives from the individual record’s volatility/profit movement and preserves reduced-motion preferences. Drawer and detail surfaces use 220–280ms snappy ease-out transitions; no generic infinite UI flourishes are used.

### Typography System
**DM Mono** carries tickers, dates, values, and controls for measured financial clarity. **Fraunces** is used sparingly for the drawer title and focus label, creating a small editorial contrast without turning the app into a report. Body text uses a compact sans fallback only where prolonged readability is needed. Titles are sentence case, values are tabular, and labels are uppercase at a small tracked size.

### Brand Essence
**ekitty turns an equity portfolio into a quietly playful living field for investors who think visually.**

Personality: **observant, affectionate, exacting**.

### Brand Voice
Headlines speak like small gallery labels; controls use direct financial language; microcopy is low-ego and action-led. The voice avoids tutorial talk and generic product slogans.

Examples:
- “183 lots, one living field.”
- “Bring forward the losses worth keeping an eye on.”

### Wordmark & Logo
The mark is a charcoal continuous-line cat whose back and tail imply a rising market arc. The drawer pairs the mark with a small, considered serif wordmark; the default canvas shows only the required hamburger control.

### Signature Brand Color
**Catkin Gold — #D8AE37**: a concentrated warm gold for tax-sensitive collars, focus indicators, and the unmistakable ekitty accent.

## Style Decisions

- Kitty glyphs are treated as hand-drawn ink information marks rather than mascot stickers; each record carries deliberate variations in lean, ears, tail arc, and whiskers.
- The physics field uses a low-density asymmetrical constellation with a few dominant financial entities and wide areas of clean white canvas.
- Catkin Gold #D8AE37 is reserved for tax-sensitive collars, focused rings, and key emphasis; it is never used as generic ornament.
- Transaction reference marks remain deliberately quiet: the month strips and horizontal guides support orientation, while the full-height kitty field remains the primary visual system.
