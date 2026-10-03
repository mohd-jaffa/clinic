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
- **Attention Coral** (`--coral`, text on it `--on-coral`): the danger capsule, the `Pin`, field errors and their border, coral words such as "₹2,500 owed", the attention mark on response and confirm cards, the Delete clinic row's icon, and the icon in a coral band.
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
**The Coral Is Attention Rule.** Coral marks only what must not be missed: an allergy, money owed or to bill, an ended plan or view-only clinic, no connection, an error, an action that cannot be undone. A required-field asterisk is muted, not coral. If a screen's coral is not one of these, remove it.

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
- **Raised** (`--shadow-raised`): `Sheet`, `Dialog` (confirm and response cards), the response notice, `SelectMenu` and `DatePicker` popovers, and the `AccountMenu` popover. Nothing on the page itself.

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

### Buttons (`button.tsx`: `Button`, `LinkButton`, `IconButton`; `capsule.tsx`)
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
- **`LinkButton`:** the same capsules as an anchor, for navigation, `tel:` and `wa.me`.

### Capsule state (`capsule.tsx`: `Capsule`)
A capsule that only says where something stands ("Waiting", "With the doctor"): `surface` tone with a `--line` ring by default, the chip trailing and leading once live. The words carry the state; the chip's side repeats it.

### Chips and pills
- **`StatusPill`:** a small capsule with a dot and a word, in `neutral` (ground, muted, line ring), `live` (`--action-soft`, `--action`) or `attention` (`--coral-soft`, `--coral`) tones from `statuses.ts`.
- **`AlertChip`:** a clinical alert: `danger` on `--coral-soft` with a warning icon, `note` on ground with an info icon.
- **`Pin`:** a coral capsule pinned on the coastline at the right of a `CoastHeader`, carrying the one thing not to miss. With `href` its tap area grows to 44 px.
- **`ChoiceChips`:** a row of 44 px round, bold small choices (a radio group) that scrolls sideways on a phone.
- **`SegmentedControl`:** round choices on a `--surface` track with a `--line` ring; the chosen thumb is `--chip` and slides on the map's curve (the theme switch in My account).

### Cards / Containers
- **Rows (`row.tsx`):** `RowList` look `rows` stacks surface rows 10 px apart; look `menu` is one continuous list with `--line` hairlines above, below and between. `Row` look `surface` (a `--surface` fill, `--radius-row`) is for people and records: the queue, bills. Look `quiet` (a `--line` ring, no fill) is a record not yet in play: still to come, done. Look `menu` is bare on the ground with an `--ink/5` hover. Rows are at least 64 px; with `href` or `onClick` the whole row is the target, a chevron shows where it goes, and `trailing` actions sit above the target. `detail` is a value read at the row's end, before the chevron — a price, a length — bold `--ink`, tabular, and part of the target. `RowIcon` is a bare 22 px icon in a 44 px box, `--coral` only for a row that leads to the irreversible. `RowToken` is the row's lead numeral.
- **`StatTile`:** on the land, a display numeral in `--land-ink` over a `--land-muted` label, its note a small coral capsule; on the ground, a surface tile with a heading-size numeral and coral note words.
- **`Dialog` (cards):** a `--surface` card with `--radius-sheet` and the raised shadow. On a phone it sits at the foot within thumb's reach, actions stacked full-width with the main one on top; from 768 px it is centred, max 28rem, actions in a row with the main one last. Its mark (a bare icon in `--ink`, `--action` or `--coral`) sits beside the title.
- **Response card (`response-card.tsx`, `useResponse()`):** the one way to report an outcome: a card, a confirm card, or a self-closing notice above the bottom bar whose `--action` line empties as its clock (it keeps time under reduced motion and pauses while held). Error cards show the request reference.
- **`EmptyState`, `SystemNotice`:** a lobe-shaped mark (`--radius-lobe`) on land, or on `--coral-soft` for failure, a title, a warm line and one action.

### Inputs / Fields (`field.tsx`, `text-field.tsx`, `select-field.tsx`, `select-menu.tsx`, `date-picker.tsx`)
- **Style:** a 48 px capsule well (`FIELD_WELL`): `--surface` fill, 1 px `--edge` border, 20 px side padding, body text, tabular digits. A textarea takes `--radius-row` instead.
- **Label:** small bold `--ink` above the field; "(Optional)" in regular muted; required marked with a muted asterisk.
- **Focus:** the global 3 px `--action` outline at 3 px offset.
- **Error:** `--coral` border, and a bold small coral message with an icon below, announced and tied to the field.
- **Disabled:** 60% opacity, not-allowed cursor.
- **Pickers (D65):** select and date fields open the app's own popovers, never the browser's: a `--surface` popover with a `--line` border, the raised shadow and `animate-drop-in`. Options are 44 px round rows, the active one on ground, the chosen one bold with an `--action` check. Calendar days are 44 px circles; today has an `--action` ring, the chosen day is `--chip`.

### Navigation (`AppShell.tsx`, `QuickAdd.tsx`, `MoreSheet.tsx`, `AccountMenu.tsx`)
- **Bottom bar and rail:** each place an icon (22 px, stroke 2.25) over a `text-tab` name, `--muted` at rest. The current place gets a 56×32 land patch behind its icon and a bold `--ink` name.
- **Sidebar:** places are 44 px capsule rows; the current place is wholly `--land` with `--land-ink`; hover is `--surface`.
- **`AddButton`:** `bar` (a 60 px land chip raised out of the bar, ringed in ground), `rail` (a 56 px land chip), `sidebar` (a full-width primary `Button` labelled Add).
- **`MoreSheet`, Settings, My account:** menu `RowList`s on the ground (D75).

### Sheets (`sheet.tsx`, `modal.tsx`)
Every create and edit form opens in a `Sheet`: a bottom sheet on a phone (rounded top corners, a grab handle, up to 92dvh, above the keyboard) and a 28rem right-hand panel from 768 px. Title and close at the top, a scrolling body, a foot for actions above a hairline. All modals are the native `<dialog>` through `Modal`, which makes the page inert, traps and returns focus, and stays mounted while closed so typed text survives.

### Quick Actions lobe (`quick-actions.tsx`: `QuickActions`)
The signature of the shell. On a phone, a lobe of land rises from the bottom with a flipped `phone` coastline as its top edge. From 768 px it drops beside the rail's ＋ or the sidebar's Add, 22rem wide, rounded top corners and the coastline as its lower edge (D76). Each action is a 56 px surface capsule with its 44 px `--chip` chip on the trailing edge: one per line on a phone, two-up from 640 px, one per line again beside the rail. In a view-only clinic every action stays visible, turned off, with the reason under the title.

### Land pieces (`coast-header.tsx`: `CoastHeader`, `Coastline`; `page-header.tsx`: `PageHeader`; `lake.tsx`: `Lake`)
- **`CoastHeader`:** size `lead` (generous padding, the `phone` coastline under 768 px, `wide` above) or `band` (slim, the `band` coastline). Pays the top safe area. Holds a `PageHeader` (heading on a phone, display from 768 px, land-muted subtitle) and an optional `Pin`.
- **`Lake`:** an opening in the land, `--ground` showing through, `--radius-lake`, holding the patient now with the doctor: a display-large token, the name in title, a detail line, and their actions side by side. Built in the kit for the Queue (a later phase).

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
