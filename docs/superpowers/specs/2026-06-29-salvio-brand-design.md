# Salvio — Brand & Naming Design

**Date:** 2026-06-29
**Scope:** Parent brand name, logo system, and sub-brand architecture for the app
currently codenamed *Trainee*.

## Decision

The product is named **Salvio** — a parent brand, not a fitness-only name.

- **Name:** Salvio
- **Meaning:** from Latin *salvere* / *salvio* — "to be in good health" (root of RO
  *salut*, *sănătate*). Carries health/wellbeing meaning that stretches across fitness,
  sport, and medical verticals.
- **Why this name:** rolls off the tongue, sounds international while resonating in
  Romanian, is the only finalist whose meaning genuinely spans a future doctors app, and
  gives a distinctive **S** monogram (the alternatives Veya/Visora both collapse to a
  generic **V**). Passed an initial US web check with no app/health/fitness conflict.

## Brand architecture — parent + vertical

One master brand snaps onto a category word. Each app stands alone in its store category
while sharing trust, logo, and account system.

| Vertical | Sub-brand | Status |
|----------|-----------|--------|
| Fitness / personal trainers | **Salvio Fit** | current app (was "Trainee") |
| All sports / coaching | **Salvio Sport** | future |
| Doctors / specialists | **Salvio Med** | future |

The current app rebrands from *Trainee* to **Salvio Fit**.

## Logo system

- **Primary mark — pulse line.** A heartbeat/pulse stroke. Vertical-neutral by design:
  heart-rate (fitness), performance (sport), vital sign (medical). This is the shared
  brand symbol across all verticals.
- **Secondary mark — "S" monogram.** For tight spaces / favicon when the pulse is unclear.
- **App icon:** white mark centred on an emerald gradient squircle.
- **Wordmark:** "Salvio" in a bold humanist sans (drafted in Segoe UI; production target
  **Inter ExtraBold / 800**). Initial **S** in emerald, remainder slate.
- **Lockup:** `Salvio` (slate) + category word (emerald), e.g. **Salvio** **Fit**.

### Color

| Token | Hex | Use |
|-------|-----|-----|
| Emerald (primary) | `#10B981` | mark, accents, initial letter |
| Emerald dark | `#059669` | gradient end |
| Slate | `#0F172A` | wordmark body |
| Grey | `#64748B` | sub-labels |
| Background | `#F8FAFC` | light canvas |

Palette inherited from the existing app theme (`frontend/src/lib/theme.ts`) so the brand
and product UI stay consistent.

## Draft assets

Comparison sheets (CSS drafts, not final vectors):
`C:\Users\RobertoJudele\Downloads\ss\branding\` — `salvio.png` (chosen), plus `veya.png`,
`visora.png` and the `gen-logo.js` generator.

## Open items (not done yet)

- **Trademark clearance** — verify EUIPO + OSIM (România); web search is *not* clearance.
- **Domain / App Store name** — secure `salvio` domain variant and reserve the App Store
  / Play names; "Salvio" alone may be taken, fallback `salvioapp` / `getsalvio`.
- **Final vector logo** — redraw the pulse mark and wordmark as SVG; these PNGs only fix
  the direction.
- **In-app rename** — `app.json` name/scheme and bundle IDs still say `Trainee` /
  `com.juroctech.frontend`; rebrand to Salvio Fit is a separate implementation task.
