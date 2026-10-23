---
name: ClinicDesk
description: The front desk and consulting room of a small Indian clinic, drawn as a guide map — "The Clinic Map".
colors:
  ground: "#eef3ee"
  surface: "#ffffff"
  paper: "#ffffff"
  ink: "#11241a"
  muted: "#46594d"
  line: "#d5e0d7"
  land: "#86cfa0"
  land-ink: "#11241a"
  land-muted: "#1f5236"
  action: "#1c6a44"
  on-action: "#ffffff"
  chip: "#11241a"
  on-chip: "#ffffff"
  coral: "#ba3c27"
  on-coral: "#ffffff"
  coral-soft: "#fae6e1"
  action-soft: "#e4ede9"
  edge: "#738a7c"
  scrim: "rgb(17 36 26 / 0.45)"
  ground-dark: "#0d1813"
  surface-dark: "#14231b"
  paper-dark: "#ffffff"
  ink-dark: "#e4f1e8"
  muted-dark: "#a7bcae"
  line-dark: "#26392e"
  land-dark: "#2e6a48"
  land-ink-dark: "#e4f1e8"
  land-muted-dark: "#cbe8d5"
  action-dark: "#7fd3a0"
  on-action-dark: "#0d1813"
  chip-dark: "#e4f1e8"
  on-chip-dark: "#0d1813"
  coral-dark: "#ff8c73"
  on-coral-dark: "#2a0d06"
  coral-soft-dark: "#3b2622"
  action-soft-dark: "#21382b"
  edge-dark: "#5a7564"
  scrim-dark: "rgb(0 0 0 / 0.6)"
typography:
  display-lg:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "3.5rem"
    fontWeight: 700
    lineHeight: 0.95
    letterSpacing: "-0.03em"
    fontFeature: "tnum"
  display:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "2.75rem"
    fontWeight: 700
    lineHeight: 0.95
    letterSpacing: "-0.02em"
  token:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 0.95
    letterSpacing: "-0.02em"
    fontFeature: "tnum"
  heading:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "1.625rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.25
  body:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.5
  small:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.4
  caption:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.35
  tab:
    fontFamily: "Figtree, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1
rounded:
  full: "9999px"
  row: "1.375rem"
  sheet: "1.75rem"
  lake: "48% 52% 44% 56% / 38% 40% 60% 62%"
  lobe: "58% 42% 55% 45% / 50% 56% 44% 50%"
spacing:
  gutter: "16px"
  gutter-wide: "32px"
  row-gap: "10px"
  section-gap: "32px"
  target: "44px"
  field: "48px"
  row: "64px"
components:
  button-primary:
    backgroundColor: "{colors.action}"
    textColor: "{colors.on-action}"
    typography: "{typography.body}"
    rounded: "{rounded.full}"
    padding: "0 49px 0 18px"
    height: "44px"
  button-primary-chip:
    backgroundColor: "{colors.chip}"
    textColor: "{colors.on-chip}"
    rounded: "{rounded.full}"
    size: "34px"
  button-danger:
    backgroundColor: "{colors.coral}"
    textColor: "{colors.on-coral}"
    typography: "{typography.body}"
    rounded: "{rounded.full}"
    padding: "0 49px 0 18px"
    height: "44px"
  button-danger-chip:
    backgroundColor: "{colors.on-coral}"
    textColor: "{colors.coral}"
    rounded: "{rounded.full}"
    size: "34px"
  button-secondary:
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.full}"
    padding: "0 18px"
    height: "44px"
  button-quiet:
    textColor: "{colors.action}"
    typography: "{typography.body}"
    rounded: "{rounded.full}"
    padding: "0 18px"
    height: "44px"
  button-quiet-hover:
    backgroundColor: "{colors.action-soft}"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.full}"
    padding: "10px 20px"
    height: "48px"
  row-surface:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.row}"
    padding: "10px 8px 10px 14px"
    height: "64px"
  row-menu:
    textColor: "{colors.ink}"
    padding: "8px 4px 8px 0"
    height: "64px"
  pin:
    backgroundColor: "{colors.coral}"
    textColor: "{colors.on-coral}"
    typography: "{typography.small}"
    rounded: "{rounded.full}"
    padding: "4px 14px 4px 10px"
    height: "32px"
  status-pill-live:
    backgroundColor: "{colors.action-soft}"
    textColor: "{colors.action}"
    typography: "{typography.caption}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
  status-pill-attention:
    backgroundColor: "{colors.coral-soft}"
    textColor: "{colors.coral}"
    typography: "{typography.caption}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
  land-header:
    backgroundColor: "{colors.land}"
    textColor: "{colors.land-ink}"
    padding: "20px 16px 8px"
  nav-place-active:
    backgroundColor: "{colors.land}"
    textColor: "{colors.land-ink}"
    rounded: "{rounded.full}"
    height: "32px"
    width: "56px"
  add-button-bar:
    backgroundColor: "{colors.land}"
    textColor: "{colors.land-ink}"
    rounded: "{rounded.full}"
    size: "60px"
  sheet:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sheet}"
    width: "28rem"
---

# Design System: ClinicDesk

This file is the design system's authority from the end of Phase 2 (AGENTS.md §23, §30). It records what the shipped build does. The tokens live in `src/app/globals.css`, the coastline paths in `src/assets/coastlines.ts`, the face in `src/app/fonts.ts`, and the kit in `src/components/ui` and `src/components/nav`. Where this file and a screen disagree, the screen is wrong. Where this file and the plan's decision log disagree, the decision log wins and this file is updated.

## Overview

**Creative North Star: "The Clinic Map"**

Each screen is a guide map. One flat field of leaf green, the **land**, leads the screen and holds its one key fact: a greeting, a screen's title, the app's own line on the account screens. Its edge is a softly swelling **coastline**, never a straight card edge. Everything else sits on the **ground**, a pale sage water in light and a deep green-black in dark. The reader should know in under a second what needs them now, in glare, on a budget phone, with little practice with software.

Controls are **capsules**. A primary capsule is green with a round ink **chip** riding its trailing edge; when the thing is live the chip crosses to the leading edge, so the chip's place repeats what the label says. Coral is kept for attention only: an allergy, an amount owed, an ended plan, an action that cannot be undone. The page is flat. Depth appears only on what floats over it in the top layer: sheets, cards, popovers.

The world refuses the category's white-cards-and-pastel-icon-tiles grid, and cold grey ERP tables. It has no photographs or illustrations; people are initials.

**Key Characteristics:**
- The land leads every signed-in screen and every account screen; its edge is an authored coastline.
- Ground and surface carry everything else; menus are one list on the ground, parted by hairlines.
- Capsule controls with a travelling chip; everything you tap is round-ended and at least 44 px.
- Green, ink and one coral. No yellow, gold, blue or lilac.
- Figtree in two weights; display numerals big, bold and tight.
- One duration (`--duration-map`) and one curve (`--ease-map`), no overshoot; instant under reduced motion.
- Light and dark ship together; every text pair is held to WCAG AA by `tests/contract/design-tokens.test.ts`.

## Colors

Leaf green, near-black green ink and one coral, on a pale sage ground; dark mode is a deep green-black ground with a lifted leaf land, pale ink and a lighter coral.

Tokens are defined bare on `:root` (light), redefined for a dark device unless the person chose Light (`prefers-color-scheme: dark` on `:root:not([data-theme="light"])`), and again for a person who chose Dark (`:root[data-theme="dark"]`). The two dark blocks must stay identical; the token test enforces it. In the frontmatter, the `-dark` keys are the same token's dark value, not separate tokens: code always says `--land`, never a dark name.

Tailwind's own palette is cleared (`--color-*: initial`), so `bg-land`, `text-ink` and the rest are the only colours a screen can name.

### Primary
- **Leaf Land** (`--land`): the field that leads a screen (`CoastHeader`, `AuthScene`, the Quick Actions lobe), the patch behind the current place in the bottom bar and rail, the whole current place in the sidebar, the raised ＋, an avatar on the ground, the lobe behind an empty state, and text selection. Text on it is `--land-ink`, quieter text `--land-muted`.
- **Clinic Green** (`--action`): the primary capsule's fill, quiet button words, links such as "Forgot password?", the focus ring, the caret, today's ring in the calendar, the success mark, and the response notice's countdown line. Text on it is `--on-action`.
- **Action Wash** (`--action-soft`): the hover behind a quiet button and the background of a live status pill.

### Secondary
- **Ink Chip** (`--chip`, text `--on-chip`): the round chip on a capsule, the chosen day in the calendar, the sliding thumb of `SegmentedControl`, a Quick Actions chip, an avatar on the land. In dark it inverts to pale with dark text.

### Tertiary
- **Attention Coral** (`--coral`, text on it `--on-coral`): the danger capsule, the `Pin`, field errors and their border, coral words such as "₹2,500 owed", the attention mark on response and confirm cards, the warning mark over the appointments on days a closure is about to close (D137), the Delete clinic row's icon, and the icon in a coral band.
- **Coral Wash** (`--coral-soft`): the plan band once the plan has ended, the offline band, the attention status pill, the danger `AlertChip`, and the attention `SystemNotice` lobe.

### Neutral
- **Sage Ground** (`--ground`): the page, the shell's bar, rail and sidebar, menus, and the opening of the `Lake`.
- **Surface White** (`--surface`): rows that stand on their own (`Row` look `surface`), fields, sheets, cards, popovers, the quiet plan band, and the Quick Actions capsules.
- **Paper White** (`--paper`): the page a bill or prescription prints on — white in every theme — under the clinic's logo wherever it is shown (`ClinicLogo`), so a logo made for paper is seen as it will print.
- **Green Ink** (`--ink`): all text on ground and surface, the secondary capsule's outline, bare menu icons.
- **Moss Muted** (`--muted`): subtitles, hints, captions, idle nav places, the required asterisk, chevrons.
- **Hairline** (`--line`): dividers between menu rows, the sidebar's edge and group rules, the bottom bar's top edge, sheet foot rules, outline rows, and skeletons.
- **Field Edge** (`--edge`): the border of fields and checkboxes. It clears 3:1 on ground and surface (WCAG 1.4.11) where a hairline would not show where to type.
- **Scrim** (`--scrim`): the backdrop behind every modal.
- `--shadow-tone` is not a colour to paint with; it is the RGB triple `--shadow-raised` is mixed from.

### Named Rules
**The Coral Is Attention Rule.** Coral marks only what must not be missed: an allergy, money owed or to bill, an ended plan or view-only clinic, no connection, an error, an action that cannot be undone, appointments on days about to be closed. A required-field asterisk is muted, not coral. If a screen's coral is not one of these, remove it.

**The No Gold Rule.** No yellow, gold, blue or lilac anywhere, in either theme (the user's fixed constraint). Warnings use coral and their words, not amber.

**The Never Colour Alone Rule.** Every state that has a colour also has words and an icon or a position: the status pill carries a dot and its word, the band carries its icon and sentence, the capsule's chip changes side. The tone of a status comes from `src/constants/statuses.ts` (`neutral`, `live`, `attention`), never from the screen.

## Typography

**Display Font:** Figtree (with system-ui, sans-serif)
**Body Font:** Figtree (with system-ui, sans-serif)

**Character:** One legible grotesk in regular and bold (D64), served by `next/font` with its `latin` and `latin-ext` subsets so the ₹ sign renders. It has no slashed zero or alternate I/l; codes and doses rely on Figtree's flagged 1 and on context.

Tailwind's sizes are cleared (`--text-*: initial`); these are the only sizes.

### Hierarchy
- **Display large** (`text-display-lg`, bold, 0.95): the token numeral in the `Lake`.
- **Display** (`text-display`, bold, 0.95, -0.02em): a page title from 768 px (`PageHeader`), a number on the land (`StatTile` on land), the account screens' title and the app's line from 1024 px.
- **Token** (`text-token`, bold, 0.95, -0.02em, tabular): a row's lead numeral (`RowToken`): a token, a booked time.
- **Heading** (`text-heading`, bold, 1.15): a page title on a phone, a stat on the ground, a `SystemNotice` title, the large `Wordmark`.
- **Title** (`text-title`, bold, 1.25): section headings, sheet and card titles, the clinic name in the sidebar, the page subtitle from 768 px.
- **Body** (`text-body`, 17 px, 1.5): everything read; what is typed in a field; capsule labels.
- **Small** (`text-small`, 1.4): row subtitles, field labels (bold), hints and errors, band sentences (bold), the `Pin`.
- **Caption** (`text-caption`, 1.35): status pills, weekday heads in the calendar, a request reference.
- **Tab** (`text-tab`, 1): a place's name under its icon in the bottom bar and the rail.

### Named Rules
**The Two Weights Rule.** Regular (400) and bold (700) only. Hierarchy comes from size and weight, never from a third weight, italics or capitals. No uppercase labels, no letter-spaced kickers.

**The Tight Numeral Rule.** Numbers that matter (tokens, rupees, counts) are bold, at token size or larger, line-height 0.95, slightly negative tracking, and `tabular-nums`. Any amount, time, phone number or date in a row or field is `tabular-nums`.

**The Sixteen Pixel Floor.** Inputs never fall below 16 px (`font-size: max(1rem, 1em)` in the base layer) so iOS does not zoom.

## Layout

Mobile first at 360, 390 and 414 px; every screen ships phone, tablet and desktop together.

- **Breakpoints:** `sm` 640 px (Quick Actions go two-up; band links move beside their words), `md` 768 px (48rem: the rail replaces the bottom bar, sheets become right-hand panels, cards centre, the lobe drops from its ＋), `lg` 1024 px (the sidebar replaces the rail; account screens split in half; menu screens go to two columns).
- **Shell (`AppShell`):** phone, a bottom bar on the ground, 4rem tall, five places in fixed columns (Home, Queue, ＋, Patients, More) so the ＋ is always centred; no top bar (D68). Tablet, a 6.5rem icon rail with the round ＋ at its top and the account at its foot. Desktop, a 17rem sidebar with the clinic's name, the **Add** capsule, the places in three groups parted by hairlines, and the account at its foot.
- **Screen gutters:** 16 px on a phone, 32 px from 768 px (`px-4 md:px-8`), on the land and the ground alike.
- **Rhythm:** 10 px between surface rows; 32 px between sections; 40 px column gap where a menu screen splits at 1024 px; 8 px under a section heading.
- **The land's share:** a lead screen's land is generous (about a third of the first viewport); a dense screen keeps the slim `band` coastline.
- **Account screens (`AuthScene`, D70):** on a phone the land holds the `Wordmark` and the app's line over the phone coastline, the form below on the ground, max 28rem wide. From 1024 px the land fills the left half, sticky, its right edge the `side` coastline; the form stands centred on the right.
- **Bands:** `OfflineBanner` and `PlanBanner` lead `main` above the land and pay the top safe area; anything after a band (`[data-band] ~ *`) does not pay it again.
- **Device:** insets flow only through `--safe-top/right/bottom/left` and the `safe-top`, `safe-bottom`, `safe-x` utilities (with `--safe-pt/pb/px` for an element's own padding). Heights are `dvh`. `--keyboard-inset` lifts sheets and cards above the iOS keyboard; `--bottom-bar-offset` lifts notices and the last row above the phone's bar.

### Named Rules
**The Centre Plus Rule.** On a phone the ＋ is the middle of the bottom bar, a 60 px land chip raised out of its top edge and ringed with ground. It is never moved, hidden by a missing neighbour, or replaced by a floating button. On tablet and desktop the same Quick Actions open from the rail's round ＋ and the sidebar's **Add** (D69).

**The Land Leads Rule.** A signed-in screen begins with its land (`CoastHeader` holding `PageHeader`), after any band. Its title lives on the land; there is no separate top bar.

## Elevation & Depth

The page is flat: land, ground and surface are tonal layers with no shadows, gradients or grain. Depth exists only for what floats in the top layer over the page. One shadow exists, tinted by the theme's `--shadow-tone`.

### Shadow Vocabulary
- **Raised** (`--shadow-raised`): `Sheet`, `Dialog` (confirm and response cards), the response notice, `SelectMenu`, `SuggestField` and `DatePicker` popovers, and the `AccountMenu` popover. Nothing on the page itself.

### Named Rules
**The Raised Only In The Top Layer Rule.** A shadow means "this floats over the page and will go away". Rows, fields, stat tiles, the land and the shell never cast one. A surface row is set apart by its fill on the ground, an outline row by a `--line` ring.

## Shapes

- **Fully round** (`rounded-full`): every capsule, field well, pill, chip, nav patch, the ＋, avatars, icon buttons, calendar days, skeleton lines.
- **Row** (`--radius-row`, 22 px): surface and outline rows, the textarea, stat tiles on the ground, the facts strip in a response card, the select menu, skeletons.
- **Sheet** (`--radius-sheet`, 28 px): sheets (top corners on a phone, left corners as a side panel), cards, the notice, the date picker and account popovers, the lobe's top corners from 768 px.
- **Lake** (`--radius-lake`): the hand-drawn opening in the land; used only by `Lake`.
- **Lobe** (`--radius-lobe`): a small island of land; the mark behind `EmptyState` and `SystemNotice`.
- **Coastlines** (`src/assets/coastlines.ts`): four authored paths, drawn by `Coastline`: `phone` (390×34, under a phone's lead land, with room for a pin at the right), `wide` (1200×34, from 768 px), `side` (34×1200, the upright edge of the account screens from 1024 px), `band` (1200×12, a dense screen's slim edge). They stretch along the edge with `preserveAspectRatio="none"` and keep their depth. `flip` turns one over for land rising from below (the phone lobe).

### Named Rules
**The Capsule Rule.** If a person can tap it or type in it, it is round-ended. Square corners and small radii do not appear on controls.

**The Coastline Edge Rule.** Land ends in a coastline from `COASTLINES`, never in a straight edge or a card radius, and never in a path generated at render time. Only the `Pin` sits on the coastline; no other text crosses it.

## Components

### Buttons (`button.tsx`: `Button`, `LinkButton`, `IconButton`, `IconLink`; `capsule.tsx`)
Firm, round and unmistakable: one look per variant, declared once.
- **Shape:** fully round, 44 px minimum height at both sizes (`md` body text, `sm` small text).
- **Primary:** `--action` fill, `--on-action` bold label, and a 34 px `--chip` chip (30 px small) on the trailing edge holding an icon, an arrow by default. One primary per view: the one thing to do.
- **Danger:** `--coral` fill with an `--on-coral` chip holding `--coral` icon; only for what cannot be undone.
- **Secondary:** transparent with a 2 px inset `--ink` ring; beside a primary, or the other way in ("Set up your clinic").
- **Quiet:** `--action` words alone, `--action-soft` on hover; for a way out ("Cancel").
- **Live:** `live` sends the chip to the leading edge, gliding on `--duration-map`/`--ease-map`.
- **Busy:** a spinner in the chip; the button stays focusable with `aria-busy` and ignores presses.
- **Press / disabled:** scale to 0.98 on press; 50% opacity and a not-allowed cursor when disabled.
- **`IconButton`:** a 44 px round, label-less action (close, next month) in `plain`, `outline` or `danger` tone; its label is required.
- **`IconLink`:** the same 44 px round, as a link out of the app: a reminder's WhatsApp in a new tab, or — with `newTab` off — a call the phone takes in place (a follow-up's row, D272).
- **`LinkButton`:** the same capsules as an anchor, for navigation, `tel:` and `wa.me`.
- **`ArchiveButton` (`archive-button.tsx`):** a small secondary **Archive** at the foot of a record's edit sheet — a catalogue entry's, a patient's — above a `--line` hairline, apart from the details. It asks first, and the sheet closes once archived.

### Capsule state (`capsule.tsx`: `Capsule`)
A capsule that only says where something stands ("Waiting", "With the doctor"): `surface` tone with a `--line` ring by default, the chip trailing and leading once live. The words carry the state; the chip's side repeats it.

### Chips and pills
- **`StatusPill`:** a small capsule with a dot and a word, in `neutral` (ground, muted, line ring), `live` (`--action-soft`, `--action`) or `attention` (`--coral-soft`, `--coral`) tones from `statuses.ts`. A tag that is not a status carries its own 14 px icon in place of the dot: **Urgent** (`UrgentTag`, D201) is the `attention` pill with a siren; **Fee paid** (`FeePaidTag`, D306) the `live` pill with a rupee, on a queue row after Urgent and in the appointment's detail.
- **`Panel` (`panel.tsx`, D202):** a part of a screen that holds its own form or read-out — a visit's vitals, notes, follow-up: its `SectionHeading` on the ground, then a `--surface` card with `--radius-row` and 16 px padding (20 px from 640 px) holding the fields, and what it saves at the card's foot, at the end.
- **`AlertChip`:** a clinical alert: `danger` on `--coral-soft` with a warning icon, `note` on ground with an info icon. Its `kind` ("Allergy") is said before the label to a screen reader; the mark says it to the eye. A patient's chips run in one row with **Alerts** after the last (D117), allergies first; **Alerts** carries a pencil when they may be changed and an eye when they may only be read (D126).
- **`OwingPill` (D101):** the `attention` pill saying "₹1,200 due" — at the end of a patient's row in the list and on Outstanding; nothing for a patient who owes nothing or holds an advance.
- **`Pin`:** a coral capsule pinned on the coastline at the right of a `CoastHeader`, carrying the one thing not to miss. With `href` its tap area grows to 44 px. First used on the queue: "3 to bill" with a receipt, jumping to its To bill (D340).
- **`ChoiceChips`:** a row of 44 px round, bold small choices (a radio group) that scrolls sideways on a phone. **`ChoiceField`** sets a short set of them as a form field — its label (required marked), the chips wrapping, the hint or refusal beside them — with nothing chosen until one is (a patient's gender).
- **`DateRangeFilter` (`date-range.tsx`, D320):** a list's days as `ChoiceChips` — Today, 7 days, This month, Pick dates — and, picked, From and To date fields side by side, From never after To, To never after today, at most 366 days apart.
- **`SegmentedControl`:** round choices on a `--surface` track with a `--line` ring; the chosen thumb is `--chip` and slides on the map's curve (the theme switch in My account).

### Cards / Containers
- **Rows (`row.tsx`):** `RowList` look `rows` stacks surface rows 10 px apart; look `menu` is one continuous list with `--line` hairlines above, below and between. `Row` look `surface` (a `--surface` fill, `--radius-row`) is for people and records: the queue, bills. Look `quiet` (a `--line` ring, no fill) is a record not yet in play: still to come, done. Look `menu` is bare on the ground with an `--ink/5` hover. Rows are at least 64 px; with `href` or `onClick` the whole row is the target, a chevron shows where it goes, and `trailing` actions sit above the target. The title keeps at least 8rem: in a narrow column (the queue's four on a desktop) the actions go onto a line of their own under it, at the row's end. `detail` is a value read at the row's end, before the chevron — a price, a length — bold `--ink`, tabular, and part of the target. A row's line is one line, cut short; with `wrap` it runs on, for words that must be read whole (why an import's row was left out). A `note` is one more such line under it, the same small `--muted` type, cut short alike: a patient's last visit, a visit's medicines. `RowIcon` is a bare 22 px icon in a 44 px box, `--coral` only for a row that leads to the irreversible. `RowToken` is the row's lead numeral.
- **`CalendarGrid` (`calendar-grid.tsx`, D66):** a `--surface` panel with `--radius-row` and a `--line` ring: the hours down a sticky 4rem side in `--muted` captions, a column per doctor of a day or per day of a week — its title small bold `--ink` (`--action` for today, `aria-current="date"`), a caption under it — and `--line` hairlines on the hour. Each step (a quarter hour) is 24 px. A column's items are a list at their times, overlapping ones sharing it side by side in lanes, each said whole to a screen reader. A closed column is shaded `--ink/5` and says why. With a pick, an empty step turns `--action-soft` under the pointer with a small bold `--action` "＋ 10:15 AM"; the steps are hidden from assistive technology — the screen's own button does the same. Columns keep 10rem (a week's 7.5rem) and the panel scrolls sideways past that. With an open, each item is a button (named by its label, the action focus ring an inch inside) that opens it.
- **An appointment on the grid (`AppointmentBlock`):** a `--surface` block with small 6 px corners — a quarter-hour block keeps its status edge straight — and a `--line` ring, its start and the patient on the first line (bold name), what kind and the status under it in `--muted`, a 4 px status edge down its side (`--action` live, `--coral` attention, `--edge` otherwise). A walk-in is on `--action-soft`.
- **A day's closures (`ClosureNotices`):** each a `--surface` line with `--radius-row`, a muted closed-calendar icon and bold small words — "Clinic closed: Diwali".
- **Today's queue (`Queue`, D168 – D170):** the land holds the title, today's date and the doctor capsules (`ChoiceChips` on the land), then the lakes on a phone. On the ground, **Add walk-in**, then the sections — each a `SectionHeading` with its count over a `RowList`, or a quiet muted line when empty. A phone stacks Waiting, Still to come and Done (folded in a `Disclosure` with its count); a tablet puts two side by side and a desktop four: Waiting, With doctor, Still to come, Done. For whoever reads bills, **To bill** (`QueueToBill`, D318) follows With doctor — the Billing tab's `ToBillRow`s, **Show more** under them as a small secondary capsule — so a phone stacks Waiting, To bill, Still to come and Done, and a desktop keeps four columns with Done under Still to come (D338); Done then lists only the settled (D339), and the land's coral `Pin` "3 to bill" (a receipt) jumps to To bill (D340). With the room free on one doctor's queue and someone waiting, **Next patient** (a small primary capsule) sits in the free lake and under the With doctor section's muted line (D196).
- **A queue row (`QueueRows`, D172, D174):** Waiting, With doctor and Done lead with the token in display numerals ("04", read "Token 04"); their line runs onto a second line rather than being cut. Still to come and Done are `quiet` (outlined). A patient still to come shows their time, then "Late 25 min" in bold coral words once it has passed, and **Arrived** as a small secondary outline capsule at the row's end. A waiting row carries **Send in** as a small primary capsule (D172); a patient stepped out is drawn `quiet`, "Stepped out" first on their line in bold `--ink` (D198). A patient marked urgent has the **Urgent** tag leading their line, on Waiting and With doctor rows alike; their place in the list does not change (D201). A With doctor row carries **Done** (small secondary) and **Next patient** (small primary), and is a link to the visit for whoever reads visits (D193, D195).
- **A visit's screen (`VisitScreen`, D195, D202 – D209):** the land holds the back arrow — to the queue, or to the patient's profile when it was opened from there (D230) — the patient's name, their age, sex and number, "With Maya Rao", a status pill (Open, Done), the **Urgent** tag for a patient marked so (D201), the alert chips (`AlertChips`, an allergy in coral, shared with the profile) — or a muted "No alerts" — and a small secondary **Alerts** capsule (pencil, or an eye when they may only be read) opening the profile's alerts sheet (D207). While the patient is in, a `Lake` under it: the token, "In since 10:30 AM", the minutes, **Done** and **Next patient**; a visit started from the profile has the lake without a token, with **Done** alone (D204). On the ground, the sections (D202), each a `Panel`: **Vitals**, **Complaint, diagnosis and notes**, **Prescription**, **Follow-up**, then a `DetailList` of the day, token, when they went in, when done and billing. A phone stacks them; from 768 px two columns, the notes and the prescription under them on the right, vitals, follow-up and details on the left (D209). For whoever may write a section, its fields are open: vitals two to a row on a phone and four from 640 px, aligned at their wells so a label on two lines never drops its field, each labelled with its unit ("Temperature (°F)"), number pads, and the BMI in bold under them as weight and height are typed; the notes three text wells (2, 2 and 6 rows); the follow-up the chips (3 days, 1 week, 2 weeks, 1 month — `ChoiceChips`, wrapping, the chosen one filled) over a `DateField` that may be cleared, and **Book next appointment** (small secondary, a calendar-plus) for whoever books. A small primary **Save vitals**, **Save notes** or **Save follow-up** stands at the card's foot only once something is typed. For whoever may only read, read-outs: the vitals in heading-size numerals over their names and units, blood pressure as one ("120/80"); the notes each under its bold muted name; "Review on Tuesday, 20 Oct 2026" in bold, or a muted "No follow-up"; a muted "Nothing recorded" for a section with nothing in it. Should someone save a section while it is typed into (D206), a `--coral-soft` panel inside the card says so with a coral history mark — "Someone saved this meanwhile" — reads theirs out on a `--surface` well, and offers **Use theirs** (small secondary).
- **The prescription (`PrescriptionSection`, `MedicineLine`, D210 – D217):** a `Panel` titled **Prescription**. For whoever writes it, first "Allergies" in small bold with the patient's allergy chips (coral), or a muted "No allergies recorded"; then each medicine as a block of its own on `--ground` with `--radius-row`: "Medicine 1" in bold, with round **Move up**, **Move down** (each dimmed at its end) and **Remove** marks at its right; the medicine's `SuggestField`; "Allergy: Penicillin" in bold small coral with a warning triangle under it when the name holds one (D212); **Strength** and **Dose** side by side; **Frequency** and **Timing** each a small bold name over wrapping `ChoiceChips` (1-0-0 … SOS and **Other**, which opens a "Frequency, in words" field; Before food … Bedtime), a chip tapped again unchosen; then **Days** (a narrow number well) beside **Instructions**. Under the blocks a small secondary **Add medicine** (plus), the **Advice** well (2 rows) and the **Print the diagnosis** checkbox with its hint. "Typed by Priya Nair" in small muted type when an assistant typed it (D45). A small primary **Save prescription** stands at the foot once something is typed; a medicine naming an allergy makes it ask first, on a danger confirm card with **Save anyway** (D212). Once saved with a medicine on it, the foot holds small secondary **Print** (a printer; a link that opens the PDF beside the app), **Download** (a download arrow) and **WhatsApp** (a speech bubble, as Remind) instead — for whoever reads the visit too (D221, D222, D244). On a touch-first phone WhatsApp opens the share sheet with the PDF and the message, and an auto-closing "Prescription shared" follows; should the phone want a fresh tap, an info card "The prescription is ready" offers **Send**. On a desktop the chat opens in a new tab and a success card that stays — "Attach it in WhatsApp" — names the file downloaded (D245, D246). Until the doctor has a registration number, the card holds the read-out and a `--coral-soft` panel with a coral badge mark — "Arjun Shah has no registration number yet, …" and where it is added — with a small secondary **Open Team** for whoever manages the team (D213). The read-out lists the medicines numbered in muted tabular digits: the name and strength in bold, how it is taken on one line ("1 tab · 1-0-1 · After food · 5 days"), the instructions muted; then the advice under its muted name, and "The diagnosis prints on it" when ticked; a muted "No prescription yet" until anything is written.
- **Repeat and templates on the prescription (`PrescriptionAids`, `SaveTemplateSheet`, D236 – D243):** under the allergies, a wrapping row of small secondary capsules: **Repeat 12 Oct · Dr. Maya Rao** (a turning-back arrow; the year added for another year's; not there when the patient has none before) and **Templates** (a clipboard). Either adds its medicines after those typed and its advice on a new line; an auto-closing success card says "Added from 12 Oct · Dr. Maya Rao" or "Added from “Viral fever”", and a warning card says so when it would pass 30 medicines. **Templates** opens a `Sheet` titled "Templates" — "Maya Rao’s templates" for whoever types for her — listing those in use as a menu `RowList`, the name over "Paracetamol, Amoxicillin +1" or a muted "Advice only"; one tap adds it and closes the sheet; an `EmptyState` (a clipboard) says "No templates yet" with where one comes from. For the visit's doctor, a small secondary **Save as template** (a bookmark-plus) sits beside **Add medicine** once there is a medicine; it checks the lines first, then opens a `FormSheet` with **Template name** and its hint, its foot capsule **Save as template**. A name in use asks on a confirm card, "Replace your template “Viral fever”?", with **Replace**.
- **Treatments (`TreatmentsSection`, `PatientTreatments`, `TreatmentRows`, D256 – D263):** a `SectionHeading` **Treatments** with a small secondary **Add treatment** (plus) for whoever writes, then the rows: the name bold, "Maya Rao · Due in 7 days · Est. ₹4,500" in `--muted`, and on a visit a second muted line — "This visit: Canal cleaned", "Worked on this visit", "Started this visit" — the status pill (In progress in the live tone, the rest quiet) and a chevron. Completed and cancelled rows are `quiet` (outlined), with "Completed 1 Oct" or "Cancelled 20 Sep" where the due day was. None open: a `--surface` card with `--radius-row` saying "No open treatments" (and, on a visit, a muted line on what a treatment is). On a visit it stands between the notes and the prescription — the right column from a tablet (D263); on the profile, between the next appointment and the details, the closed behind a `Disclosure` **Show closed (2)** (D260).
- **A treatment's sheet (`TreatmentSheet`, D257, D259, D261):** a `Sheet` titled with its name; the status pill, then a `DetailList` (doctor, started, completed or cancelled, the reason, the estimate, the description). On a visit, **This visit**: the **What was done** well, the **This completes it** checkbox with its hint while it is open, a small quiet **Remove from this visit** (a bin) while the visit is open, and a small primary **Save session** — at once for a first session, else once something changes. **Next sitting**: wrapping `ChoiceChips` (3 days … 1 month from today) over the optional date, **Save next sitting** once chosen. **Sessions**: `quiet` rows, "12 Oct 2026 · Maya Rao" over the note (or "No note"), each a link to its visit but this one. The foot, for whoever writes: the forward move as a small primary capsule (**Start**, **Resume** or **Complete**, a play or double-check mark), **Put on hold** (pause) and **Edit** (pencil) secondary, **Cancel treatment** danger. It opens at its top, never in the note, so a phone's keyboard stays down. Someone else's save meanwhile shows theirs on the `--coral-soft` panel, as a visit's sections do.
- **New and edited treatments (`NewTreatmentSheet`, `EditTreatmentSheet`, `CancelTreatmentSheet`, D250, D252, D258):** `FormSheet`s. The name is a `SuggestField` listing the price list's active procedures holding what is typed, each with its price under it; taking one fills the name and the **Estimated cost** (`MoneyField`). Then **Description** (2 rows); on the profile the doctor's `SelectField`; a `SegmentedControl` **Plan it** · **Start today** (Start today chosen on a visit, Plan it on the profile) and, begun on a visit, **What was done today**; the next sitting's chips and date. **Add treatment** (plus) is the primary. Edit holds the same fields and, while open, the doctor — one who has left stays among the choices by "No longer on the team". Cancel holds an optional **Reason** with its example hint, a danger **Cancel treatment**, then the danger confirm card naming the reason, **Keep it** the way back.
- **Follow-ups (`FollowUps`, D267 – D278):** the land holds the title — "Your patients" under it for a doctor — then, on the ground, `Tabs` for Today, Overdue, Upcoming, Lapsed and Completed, each with its count, scrolling sideways on a phone. Each tab is a `RowList` of `surface` rows: the patient's `Avatar`, their name bold, "Root canal · Maya Rao" (or "Follow-up · Maya Rao" for a visit's) under it, then "Due today" — "Overdue by 4 days", "Completed 12 Oct" — and the last contact ("No answer, 14 Oct") each on a `note` line of its own, and a round `outline` **Call** `IconLink` at the row's end (D272). The row opens its sheet. An empty tab is an `EmptyState` with a calendar-clock mark. One column at reading width on a phone and a desktop alike (D278).
- **A follow-up's sheet (`FollowUpSheet`, `FollowUpPanel`, D272 – D277):** a `Sheet` titled with the patient's name; a small muted "P-1001 · Due today" first (where focus starts, so a phone's keyboard stays down), then a `DetailList` — For, Doctor, Due, and Last contact ("No answer · 14 Oct, by Priya Shah" over its note) or "Not contacted yet". Then a wrapping group: **Call** (small primary, a phone), **Remind on WhatsApp** (small secondary, a speech bubble, new tab), **Book** (small secondary, a calendar-plus) and **Open profile** (quiet, a person). For whoever notes contacts, **Mark contacted** under a `SectionHeading`: **How it went** as a required `ChoiceField` (Reached … Reminder sent), an optional one-line **Note** with its example hint, the "remind me" chips (Tomorrow, 3 days, 1 week, 2 weeks — `ChoiceChips`, wrapping) over an optional **Remind me on** `DateField` from tomorrow, and a small primary **Save contact** at its end. **Book** opens the booking sheet in its place, filled in (D276); a treatment on Completed shows For, Doctor and Completed, with Call and Open profile only (D277).
- **New visit (`NewVisit`, D204):** in the profile's header, after **Call** and **WhatsApp**, a small secondary capsule with a stethoscope. A doctor's tap starts their own visit and opens it; anyone else gets a `FormSheet` holding the doctor's `SelectField` and **Start visit**.
- **A new bill (`NewBill`, `BillLines`, `BillSummary`, D302 – D313):** the land holds the back arrow — to where it was started — **New bill**, the patient's name with age · sex · number, and "Visit 18 Oct · Maya Rao" or "Arrival · #7 with Maya Rao". With no one named it opens on the patient search alone, at reading width. A patient with a visit to bill gets a `--surface` card first — "Anita Rao has a visit to bill from 12 Oct" in bold over a small secondary **Bill that visit** (a receipt). Then two `Panel`s: **Lines** and **Total**, stacked on a phone and side by side from 1024 px (3 : 2), the totals kept in view (`sticky`). Each line is a block on `--ground` with `--radius-row`: the name bold, "For Root canal" muted under it when it bills a treatment, a round **Remove** bin at its right, then **Quantity** (a narrow number well) and **Price** (`MoneyField` for `payments.discount`, its bold read-out otherwise) with the **Amount** at the row's end. A treatment with no entry of its name is a `--coral-soft` block — a coral warning triangle and "Crown: pick its price-list entry" in bold — with a small secondary **Pick entry**. A small secondary **Add line** (plus) closes the panel; **Notes** (2 rows) under it. **Total** holds the figures as a list — Subtotal, then for `payments.discount` the **Discount** `SegmentedControl` (None, Amount, Percent) over its field, "−₹500" when given, the bold heading-size **Total**, **Balance now** and **Balance after** ("₹200 due", "₹300 advance", "Nothing due") — then a hairline, the **Collect now** checkbox, the amount, the method as wrapping `ChoiceChips` and the reference with its hint. **Issue bill** (primary, full width, a receipt) ends it; below 1024 px it sits on a bar fixed above the bottom bar with the total beside it in title numerals, and the form keeps room at its foot for the bar. Issued, the success card stays up with **Print** (primary, a printer, the PDF beside the app) and **View bill** (secondary, a receipt) for whoever reads bills (D317). A void bill issued again (**Re-issue**) starts filled with its lines, discount and notes.
- **A bill's page (`BillScreen`, D314):** the land holds the back arrow, "Bill 2026-27/0042", the patient with age · sex · number, "Issued 16 Oct 2026 · Maya Rao", and its state as a pill — Paid in the live tone, Part paid and Unpaid in the attention tone, Void neutral. On the ground a wrapping row of small capsules: **Print** (a printer; a link that opens the PDF beside the app) and **Download** secondary, **Re-issue** primary (a turning-back arrow) on a void bill, **Void bill** danger, and a quiet **Open profile**. A void bill then has a `--surface` card with a muted ban mark — "Voided 17 Oct 2026 by Asha Menon" bold over "Void: Wrong patient" muted: a state, never coral. Then the **Lines** and **Total** `Panel`s, side by side from 1024 px (3 : 2): each line its description bold over "3 × ₹40" muted, its amount bold at the right, hairlines between, the notes under a hairline; the figures as the new bill's (`Figure`), with **Paid**, **Due on this bill** and **Patient’s balance**, "Issued by Priya Shah" small and muted under them.
- **Void bill (`VoidBillSheet`, D314):** a `FormSheet` — "Bill 2026-27/0042" bold over "Asha Rao · ₹900" muted, a required **Reason** line with its example hint, and a coral **Void bill** (a ban) — then the coral confirm card, **Keep it** the way back.
- **The bill PDF (`documents/bill.ts`, plan §15.5; D315, D316):** the letterhead with the GSTIN under the phone; "Bill" in bold 13 with the day at the right, "No. 2026-27/0042" semibold under it; a rule; the patient semibold with "29 y · Male · P-1002" muted beside, their mobile and doctor muted under; the lines as a table — Description, Qty, Rate, Amount in small muted semibold over a rule, each column's figures set to its right edge; the figures at the right, the total bold 10; the balance semibold; the notes. The clinic's name over "Authorised signatory" at the foot of the last page, right-aligned under a short ink rule. A void bill has VOID in bold 96 pt, grey at 18% and slanted 30°, across every page.
- **Billing (`Billing`, plan §15.4; D318 – D325, D335, D336):** a slim land holding "Billing" and, for whoever may bill, **New bill** (primary, a page with a plus) and **Record payment** (secondary, a rupee) as small capsules. On the ground the `Tabs` — **To bill** with its count, **Bills**, **Payments**, **Outstanding** — in the 3xl column. **To bill**'s rows (`ToBillRow`): the avatar, the patient bold over "Maya Rao · #7 · 18 Oct" muted and what was done under it, **Fee paid** at the end when it was, and one small **Bill** capsule (a receipt) above the row's target. **Bills** and **Payments** lead with the `DateRangeFilter`, Bills with a second chip row (All, Paid, Part paid, Unpaid, Void); a bill's row ends with its total over its state pill, a void one an outline row; a payment's says "Paid ₹500 · UPI" over its day and who took it, a refund with a neutral **Refund** pill, a void one an outline row with **Void**. **Outstanding**'s rows end with the coral `OwingPill`, then **Call** and **WhatsApp** as outline round icons and a small secondary **Record payment**.
- **A visit to bill opened (`ToBillPanel`, D319):** a `Sheet` titled "Anita Rao’s visit" — **Fee paid** when it was, the doctor, day, token and what was done as a `DetailList` — and in its foot **Bill** (primary link) and **No charge** (secondary, an open hand). **No charge** (`NoChargeSheet`) slides over it: the visit bold, the reasons as wrapping chips (Review chosen), a **Note** line with "Needed for Other.", and **Mark No charge**. A done visit waiting in To bill has **No charge** (`NoChargeButton`, small secondary, an open hand) beside **Bill now** at its foot, opening the same sheet.
- **Record payment (`RecordPaymentSheet`, D322 – D324, D334):** a `FormSheet` — the patient search first (the picker), or the patient named as a menu row; "Balance: ₹1,200 due" small and muted under them; **Amount** (a money field, "More than is due is kept as an advance."), **Paid on** (a date field, never after today), **Method** as wrapping chips, **Reference**, **Note**; **Record payment** with a rupee. As **Refund** it keeps the amount ("Up to the ₹500 advance they hold."), the method and the reference, and submits with a turning-back arrow.
- **A payment opened (`PaymentPanel`, D336):** a `Sheet` titled "Payment" or "Refund": the amount in display numerals with a neutral **Void** pill once void, the patient bold over "P-1042" muted, the void's when, by whom and why muted, then a `DetailList` — Paid on, Method, Reference, Received by, Note. Its foot: a quiet **Open profile** and a small coral **Void payment**, whose reason (`VoidPaymentSheet`) slides over it as the bill's does.
- **Bill now and New bill (`NewBillLink`, D307, D311):** a small capsule with a receipt mark — **Bill now** primary at the foot of a visit, after its details; **New bill** secondary in a profile's header after New visit. Neither shows without `payments.create`, in a view-only clinic, or for an archived patient.
- **A profile's next appointment (`NextAppointment`, D166):** one `--surface` row — the long date bold, then the time, doctor and kind in `--muted`, the status pill and a chevron — opening its detail; or a `--surface` card saying "No appointment to come" in `--muted` with a small primary **Book appointment**.
- **A profile's history (`PatientHistory`, D167, D225 – D227):** one list of rows, newest first. An appointment: the date and time bold, the doctor, kind and any cancel reason under it, the status pill and a chevron, opening its detail; cancelled ones and no-shows drawn `quiet` (outlined). A visit: a `surface` row, "14 Oct 2026 · Visit" bold, the doctor and the diagnosis (or complaint) under it — or "Nothing recorded" — and "Rx Paracetamol, Amoxicillin +1" as its `note`, the status pill (Open, Done) and a chevron, a link to its screen. **Show more** under it. Under the Rx line, "Tx Root canal, Crown +1" names the treatments it worked on or began, two named (D262).
- **A profile's columns (D231):** a phone stacks the next appointment, the treatments, the details and the history at reading width; from 1024 px two columns, the state (next appointment, details) in the narrower left, the history in the wider right (2 : 3), each starting at the top.
- **The patients list's last visit (D228, D229):** "Last visit: 28 Sep" — "today", or with the year when not this one — as the row's `note`, under age · gender · number; nothing for a patient never seen.
- **`StatTile`:** on the land, a display numeral in `--land-ink` over a `--land-muted` label, its note a small coral capsule; on the ground, a surface tile with a heading-size numeral and coral note words.
- **`Dialog` (cards):** a `--surface` card with `--radius-sheet` and the raised shadow. On a phone it sits at the foot within thumb's reach, actions stacked full-width with the main one on top; from 768 px it is centred, max 28rem, actions in a row with the main one last — wrapping rather than spilling past the card. A card with three actions (Cancel, **Keep both in**, **Mark done and send in**) stacks them full-width at every width, the main one on top. Its mark (a bare icon in `--ink`, `--action` or `--coral`) sits beside the title.
- **Response card (`response-card.tsx`, `useResponse()`):** the one way to report an outcome: a card, a confirm card, or a self-closing notice above the bottom bar whose `--action` line empties as its clock (it keeps time under reduced motion and pauses while held). Error cards show the request reference. A confirm card may offer a second way to go ahead as a secondary button between Cancel and the confirm — "Rahul Mehta is still with Maya Rao": Cancel, **Keep both in**, **Mark done and send in** (D192).
- **`EmptyState`, `SystemNotice`:** a lobe-shaped mark (`--radius-lobe`) on land, or on `--coral-soft` for failure, a title, a warm line and one action.
- **Archived notice (a patient's, `PatientArchived`):** in the profile's header, first among its rows: a `--surface` card with `--radius-row` on the land, a muted archive icon, the bold "Archived on 4 Oct 2026 by Asha Rao", a small muted line that the profile is read-only until restored, and a small secondary **Restore**. Neutral, never coral: archived is a state, not an alarm (The Coral Is Attention Rule).
- **`DetailList` (`detail-list.tsx`):** a record's facts on a `--surface` card with `--radius-row`: each line a small bold `--muted` label and its `--ink` value, `--line` hairlines between — side by side from 640 px (a 10rem label column), the label over the value on a phone. Only what holds a value is listed (D113); a value keeps its own lines (an address).
- **`Steps` (`steps.tsx`):** where a person is in a task of a few steps — a patient import's File, Columns, Check and Import (D131): an ordered list across the width, each step a 28 px round mark and its small name, joined by `--line` hairlines. Done is a check on `--action`, the current step is the `--chip` with a bold `--ink` name and `aria-current="step"`, one to come is a `--line` ring with a muted name. On a phone only the current step is named on screen (every name is read out), so four steps fit 360 px; from 640 px all are named. It keeps to the content's 42rem column. Under it, one step at a time: a title, what it asks, what it holds, and Back (secondary) beside Next (primary). A long list in a step shows 20 at a time with a quiet **Show more**; a choice per row (a possible duplicate to import anyway) is a `CheckBox` row labelled by the row, described by what it matched. Progress while sending is a slim `--line` track filling with `--action`, a `progressbar` with its count said beside it.
- **`Disclosure`:** what a screen keeps out of the way until asked — archived entries, past holidays, a form's less-asked fields: a quiet small toggle ("Show archived (3)", then a chevron up and "Hide archived") whose words line up with the rows above, and what it opens onto. A form may hold it open (`shown`), as the patient sheet's **More details** does on a refused field inside.

### Inputs / Fields (`field.tsx`, `text-field.tsx`, `suggest-field.tsx`, `select-field.tsx`, `select-menu.tsx`, `date-picker.tsx`)
- **Style:** a 48 px capsule well (`FIELD_WELL`): `--surface` fill, 1 px `--edge` border, 20 px side padding, body text, tabular digits. A textarea takes `--radius-row` instead.
- **Label:** small bold `--ink` above the field; "(Optional)" in regular muted; required marked with a muted asterisk.
- **Focus:** the global 3 px `--action` outline at 3 px offset.
- **Error:** `--coral` border, and a bold small coral message with an icon below, announced and tied to the field.
- **Disabled:** 60% opacity, not-allowed cursor.
- **`ClockField` (`clock-field.tsx`, D146):** a time as its hour and its minutes, two pickers side by side in one labelled group — "12 AM" to "11 PM", ":00" to ":55" on the screen's steps — each named by the field and what it holds ("Time, Hour"); its hint or refusal sits under both. A picker may open on a choice the screen names while none is chosen (`opensAt`): the booking sheet's hours open on the hour it is now.
- **A record found in a sheet (`PatientPicker`, D144):** the field's label, a `SearchField`, and the best matches under it as a `menu` `RowList` (name, and age · gender · number) to choose from; once chosen, the one row with a quiet **Change**. A quiet **New patient** follows the matches. "Already here?" (`PatientMatches`) chooses instead of opening while a new patient is added with a booking, and an archived one there chooses nothing.
- **Suggestions under a field (`SuggestField`, D211):** a text well like any other, where anything may be typed; as the person types, what was written before opens under it in the pickers' popover — each suggestion a 44 px row with soft corners, its name in bold and a small muted line under it ("1 tab · 1-0-1 · After food · 5 days"), the one the keys are on on `--ground`. Down opens and moves, Enter takes, Escape closes; it never opens by itself, and taking one fills more than the field.
- **A line of times (`DoctorDay`, D147):** small `--muted` words under a field — "Maya Rao that day: 10:00 AM – 10:30 AM, 11:00 AM – 11:15 AM." — each time kept whole on its line, the line breaking only between them; said politely as it changes.
- **Pickers (D65):** select and date fields open the app's own popovers, never the browser's: a `--surface` popover with a `--line` border, the raised shadow and `animate-drop-in`. Options are 44 px round rows, the active one on ground, the chosen one bold with an `--action` check. Calendar days are 44 px circles; today has an `--action` ring, the chosen day is `--chip`. The calendar's heading jumps (D109): the month's name opens its year's twelve months, the year's a page of twelve years, each a 44 px capsule in rows of three, marked as the days are — the one holding the chosen day `--chip`, the one holding today ringed in `--action`; choosing goes back down to the days.

### Navigation (`AppShell.tsx`, `QuickAdd.tsx`, `MoreSheet.tsx`, `AccountMenu.tsx`)
- **Bottom bar and rail:** each place an icon (22 px, stroke 2.25) over a `text-tab` name, `--muted` at rest. The current place gets a 56×32 land patch behind its icon and a bold `--ink` name.
- **Sidebar:** places are 44 px capsule rows; the current place is wholly `--land` with `--land-ink`; hover is `--surface`.
- **A place's count (`PlaceCount`, D337):** the Queue item's To bill, for whoever reads bills — a 20 px coral circle in `text-tab` bold `--on-coral` on the icon's top right corner in the bar and the rail, a 24 px one in `text-small` at the end of the sidebar's capsule; "99+" past ninety-nine; none at nought. The place is named with it ("Queue, 3 to bill").
- **`AddButton`:** `bar` (a 60 px land chip raised out of the bar, ringed in ground), `rail` (a 56 px land chip), `sidebar` (a full-width primary `Button` labelled Add).
- **`MoreSheet`, Settings, My account:** menu `RowList`s on the ground (D75). A doctor's My account adds a **Prescriptions** section under the password: one menu row, **Prescription templates** (a clipboard), "Saved prescriptions, added in a tap" (D242).
- **A doctor's prescription templates (`PrescriptionTemplates`, `TemplateEditor`, D242):** the list is a `CatalogueScreen` whose back arrow leads to My account, "2 templates" under its title: those in use as one menu `RowList`, each the name over its medicines ("Paracetamol, Dolo +1", or "Advice only") opening its screen, a primary **New template** (plus) under them — the `ReadOnlyNote` instead in a view-only clinic — and `ArchivedEntries` with **Restore** under that; an `EmptyState` (a clipboard) when none is in use. A template opens on a screen of its own (land: its name, "Archived" under it for one archived; the back arrow to the list): one column, at most `max-w-3xl` — **Template name** on the ground, then a **Prescription** `Panel` holding its medicines as the visit's `MedicineLine` blocks (`--ground` on `--surface`), **Add medicine** under them (and "Add a medicine or advice to it first." in coral when it holds neither) and **Advice** (3 rows); then a primary **Save** (a check) and, under a hairline across the column, **Archive** for one in use, asked first. In a view-only clinic its fields are disabled and neither button shows.

### Printed documents (`src/lib/pdf`, `src/features/documents`)
- **The page (D218 – D220):** laid out on A5's width with 30 pt margins and scaled to A4, so both print the same. Black and grey only — ink `#111111`, muted `#4a4a4a`, rules `#8a8a8a` — in Figtree (Regular, SemiBold, Bold).
- **Letterhead:** the clinic's logo (44 pt square, when it has one) beside its name in bold 15 pt, the address and city on a line and the phone under it in muted 8 pt, then an ink rule.
- **The prescription:** the doctor's name in semibold 10.5 pt with the date set right, their qualifications · specialization and "Reg. …" in muted 7.5 pt, a grey rule; the patient's name in semibold 10 pt with "36 y · Male · P-1002" muted beside it; the vitals in one 8 pt line that breaks only between readings; "Diagnosis:" when it prints. Then "Rx" in bold 13 pt and each medicine numbered in muted semibold, its name and strength in semibold 9.5 pt, how it is taken in 8.5 pt and its instructions muted 8 pt under it; the advice under its semibold name; "Review on …" in semibold. A signature line, 130 pt, with the doctor's name under it, stands at the foot of the last page.
- **Every page:** "Generated with ClinicDesk" in muted 6.5 pt centred at the foot, "Page 1 of 2" at the right when there are more; a later page starts with the patient, their details and the date in muted 7 pt. A page breaks only between medicines, or around the advice and the review.

### Sheets (`sheet.tsx`, `modal.tsx`)
Every create and edit form opens in a `Sheet`: a bottom sheet on a phone (rounded top corners, a grab handle, up to 92dvh, above the keyboard) and a 28rem right-hand panel from 768 px. Title and close at the top, a scrolling body, a foot for actions above a hairline. All modals are the native `<dialog>` through `Modal`, which makes the page inert, traps and returns focus, and stays mounted while closed so typed text survives. Focus goes to the first typed field, or `initialFocus` where that would skip what comes first (a booking with its patient given starts on the doctor).

- **A record's detail (`AppointmentSheet`, D160):** the same sheet with the record's name as its title; a status pill — and the **Urgent** tag, D201 — and a `--muted` line (number · kind) under it, then the facts as a `DetailList`; a quiet **Open profile** link. The foot holds what its status allows, small capsules wrapping in a row: the primary first (**Confirm**), secondary outlines (**Reschedule**, **Edit notes**, **No-show**), the coral danger capsule last (**Cancel appointment**). A view-only clinic hides them and shows the lock note. A waiting patient's detail adds **Vitals** (small secondary, a heart-pulse) for `visits.create`, opening a `FormSheet` titled "Vitals for Kiran Das" with the visit's vitals fields (D203).
- **Add a line (`AddLineSheet`, D303, D308):** a `Sheet` titled "Add a line" — "Entry for Crown" when it picks a treatment's entry — with **Search the price list** first, then the active entries grouped by category, each a `SectionHeading` over a menu `RowList`, the price as each row's line; "Nothing in the price list matches." when none does. For `payments.discount`, "Or type a line" in small bold over a small secondary **Add typed line** (a pencil), which adds a line with its description focused. One tap adds the entry and closes the sheet.
- **Collect fee (`FeeCollection`, D305, D306):** held above every screen, so it follows an arrival as the queue's sheets close. A `Sheet` titled **Collect fee**: "Kiran Das is #2 with Maya Rao" in bold first when it follows a token, then **Consultation fee** — a `MoneyField` for `payments.discount`, else the fee in bold heading-size — the method's `ChoiceChips` and the reference. Its foot stacks **Issue and collect** (primary, a receipt) over **Skip** (secondary). A fee paid already, or no Consultation on the price list, says so in a line with **Skip** alone. The appointment's detail offers **Collect fee** (small secondary, a rupee) while the patient is arrived or in and the fee is unpaid.
- **The walk-in sheet (`WalkInSheet`, D171):** a form sheet of three fields — the patient (the booking sheet's search, or a new patient's fields, `PatientField`), the doctor and the type — and a full-width **Add walk-in** with the footprints chip.
- **Remind on WhatsApp (`RemindButton`, D179):** in the detail, a small secondary capsule with the message icon after Confirm; on a row (Still to come, the calendar's day list), a round `IconLink` with the message icon, named "Remind Rohan Mehta on WhatsApp", before Arrived. A row reminded says "Reminded" in its muted line; the detail gives when.
- **A reason sheet (`CancelSheet`, D162):** a form sheet with the record in bold over its `--muted` time, choice chips of quick reasons with **Other** opening a line, and a full-width coral submit — which then asks on the coral confirm card ("Keep it" as the way out).

### Quick Actions lobe (`quick-actions.tsx`: `QuickActions`)
The signature of the shell. On a phone, a lobe of land rises from the bottom with a flipped `phone` coastline as its top edge. From 768 px it drops beside the rail's ＋ or the sidebar's Add, 22rem wide, rounded top corners and the coastline as its lower edge (D76). Each action is a 56 px surface capsule with its 44 px `--chip` chip on the trailing edge: one per line on a phone, two-up from 640 px, one per line again beside the rail. In a view-only clinic every action stays visible, turned off, with the reason under the title.

### Land pieces (`coast-header.tsx`: `CoastHeader`, `Coastline`; `page-header.tsx`: `PageHeader`; `lake.tsx`: `Lake`)
- **`CoastHeader`:** size `lead` (generous padding, the `phone` coastline under 768 px, `wide` above) or `band` (slim, the `band` coastline). Pays the top safe area. Holds a `PageHeader` (heading on a phone, display from 768 px, land-muted subtitle, an optional land-muted `detail` line — a patient's doctor — and `actions` under them, aligned with the title, a row each — an archived patient's notice, their alert chips, then Call and WhatsApp as small capsules) and an optional `Pin`.
- **`Lake`:** an opening in the land, `--ground` showing through, `--radius-lake`, holding the patient now with the doctor: a display-large token, the name in title, a detail line, and their actions side by side. On the Queue (phone, D168) there is one per patient in with a doctor, named "With doctor: Rohan Mehta"; with no one in, one holds "The room is free" and a muted line. Its actions are **Done** (small secondary), **Next patient** (small primary) and **Open visit** (small quiet link) for whoever reads visits; with `onOpen` the name is a button — underlined on hover, the action focus ring — opening the appointment's detail (D172). A `tag` sits under the detail line: the **Urgent** tag (D201).

### Bands (`OfflineBanner.tsx`, `PlanBanner.tsx`)
Slim bands across the top of a signed-in screen, above the land, small bold `--ink` sentences with a 20 px icon. The plan band is quiet (`--surface`, hairline under it, muted icon) while the plan ends soon, and `--coral-soft` with a coral icon once it has ended or the clinic is view-only (D73); the owner gets **How to renew**. The offline band is `--coral-soft` with a coral no-signal icon (D55).

### Motion
One duration (`--duration-map`, 260 ms) and one curve (`--ease-map`), no overshoot. Sheets rise from the bottom (`rise-in`) or slide in from the right from 768 px (`panel-in`); cards and notices rise 12 px and fade (`card-in`, `card-out`); the phone lobe rises and the wide lobe and popovers drop 4 px (`drop-in`); backdrops fade. Each leaves the way it came where the browser supports `overlay`. Press feedback is a scale to 0.98 (0.95 for round icons). Under `prefers-reduced-motion` everything is instant except the notice's countdown, which is a clock, not motion.

## Do's and Don'ts

### Do:
- **Do** start every signed-in screen with its land (`CoastHeader` + `PageHeader`), and every account screen with `AuthScene`.
- **Do** use `Button` for every button and pick the variant by meaning: one `primary` per view, `danger` only for the irreversible, `secondary` beside a primary, `quiet` for the way out.
- **Do** list menus (Settings, My account, More) as `RowList look="menu"` with `Row look="menu"` and a bare `RowIcon` (D75); use `surface` rows for people and records, `quiet` rows for records not yet in play.
- **Do** name colours, sizes, radii and the shadow only by their tokens (`bg-land`, `text-title`, `rounded-row`, `shadow-raised`).
- **Do** put every create or edit form in a `Sheet`, every outcome through `useResponse()`, and every irreversible action behind a confirm card.
- **Do** set money, times, tokens and phone numbers in `tabular-nums`, and the numbers that matter at token or display size.
- **Do** check every screen in light and dark, at phone, tablet and desktop, with no axe violations.
- **Do** keep every target at least 44 px and every input at 16 px or more.

### Don't:
- **Don't** use yellow, gold, blue or lilac, in either theme.
- **Don't** use coral for anything that is not attention (allergy, owed or to bill, ended plan, offline, error, irreversible).
- **Don't** let colour carry a state alone; add its word and its icon or chip position.
- **Don't** give a menu row its own card, or set an icon on a tile, tinted square or circle under it (§32.1 Refuses, D75).
- **Don't** build the white-cards-and-pastel-icon-tiles dashboard grid or a grey ERP table.
- **Don't** end land in a straight edge, draw a coastline at render time, or let text other than the `Pin` cross a coastline.
- **Don't** put a shadow on anything that sits on the page; `--shadow-raised` is for the top layer only.
- **Don't** add a third font weight, uppercase or letter-spaced labels, or eyebrows above titles.
- **Don't** use the browser's native select, date or time pickers (D65).
- **Don't** add a top bar on a phone, move the ＋ off the centre of the bottom bar, or replace it with a floating button.
- **Don't** add photographs or illustrations; people are initials (`Avatar`).
- **Don't** use bounce, spring or overshoot, or a second duration or curve.
