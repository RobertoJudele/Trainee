# App Store & Google Play Screenshots — Strategy & Caption Copy

**Date:** 2026-06-23
**App:** Trainee (fitness trainer marketplace)
**Deliverable:** Screenshot strategy + caption copy (no tooling/build)

## Goal & audience

Produce the store screenshot set for **both the Apple App Store and Google Play**, targeting
**clients** (the demand side — people searching for a personal trainer). The set must answer a
searcher's gut questions in order: *Are there good trainers here? Can I trust them? Can I find the
right one? What will it cost? What happens after I book?*

The first 2–3 frames carry the listing (App Store shows ~3 in search, Play ~2–3), so frames 1–3 are
the conversion engine; later frames reinforce.

## Strategy: Approach A — Trust & Choice (discovery-led)

Lead with the marketplace's breadth and credibility, blended with a pricing-transparency frame
(borrowed from a "differentiator-led" alternative). Narrative arc:

**Find → Trust → Control → Transparency → Payoff → Call to action.**

## Frame-by-frame narrative & copy

Captions are **Romanian-first** (the listing is RO-only). English is kept as reference only.

| # | Screen | RO headline | RO subhead | (EN reference) |
|---|--------|-------------|------------|----------------|
| 1 | Search results grid | **Găsește antrenorul perfect** | Antrenori verificați, lângă tine | Find your perfect trainer / Browse certified pros near you |
| 2 | Trainer detail + reviews | **Verificați. Recenzați. De încredere.** | Vezi recenzii reale înainte să alegi | Certified. Reviewed. Trusted. / See real ratings before you commit |
| 3 | Search with filters open | **Caută după obiectiv și preț** | Filtrează exact ce cauți | Search by goal, price & place / Match exactly what you're after |
| 4 | Trainer packages/pricing | **Prețuri clare, fără surprize** | Alege pachetul potrivit ție | Clear pricing, no surprises / Pick the package that fits you |
| 5 | My schedule + check-in code | **Programează-ți ședințele** | Urmărește-ți fiecare antrenament | Book & track every session / Stay on top of your training |
| 6 | Welcome / CTA | **Începe astăzi** | Următoarea ședință, la o atingere | Start training today / Your next session is one tap away |
| 7 | Gym map *(optional)* | **Antrenori chiar lângă tine** | Găsește ședințe în zona ta | Discover trainers near you / Find sessions around the corner |

**Craft rationale**
- Frame 1 is the money shot: it must show several attractive trainer cards with visible 4.7–5.0★
  ratings — this single frame does most of the converting.
- Frames 2 + 4 are the "trust pair" (social proof + price transparency) — the two biggest objections
  before booking.
- Frame 6 closes with action, not a feature.
- Frame 7 (map) is optional; include it to lean into the local differentiator. Both stores allow it
  (App Store up to 10, Play up to 8).

## Visual treatment

**Layout: caption-on-top over the brand gradient, framed device below.** Proven converter; ties the
listing to the in-app brand.

- **Background:** the app's emerald gradient — `#10B981` (primary) → `#059669` (tertiary), same as the
  in-app Welcome screen.
- **Caption block (top ~25% of frame):** bold headline + one supporting subhead, white text.
  Suggested sizes on the 1290 px-wide master: headline ~64–80 px bold, subhead ~36–44 px regular.
  Use a bold sans consistent with the in-app typography.
- **Device:** a framed phone mockup holding the real, Romanian-language screenshot, soft rounded
  corners consistent with the app's `roundness: 16` aesthetic.
- **Consistency:** identical caption position, type scale, and gradient across all frames so the set
  reads as one cohesive story when swiped.

**Exception — Frame 6 (Welcome):** the Welcome screen is *itself* a full emerald gradient. Rendering
it on another gradient would muddy it. Render Frame 6 **full-bleed** (screenshot fills the frame) with
the caption overlaid on a subtle scrim — the one deliberate departure from the layout.

## Per-frame capture spec (demo data to stage)

Screenshot quality lives or dies on the on-screen data. No placeholder avatars, no low ratings, no
empty states. App captured in **Romanian**. Use a clean status bar (full signal/battery; Apple's 9:41
convention is a nice touch).

| # | Screen | What must be on screen |
|---|--------|------------------------|
| 1 | Search results | 4–5 trainer cards with real-looking photos, diverse names, specialties, ratings 4.7–5.0★, prices. Scrolled to top, a recognizable city in the search field. |
| 2 | Trainer detail | Flagship profile: strong hero photo, filled bio, 2–3 specialization tags, 4.9★, 3+ written reviews visible, populated gallery. |
| 3 | Search + filters | Filter panel open mid-interaction: a specialty chip or two selected, price range set, location filled. |
| 4 | Packages/pricing | A trainer with 3 named packages (e.g. *Starter · 5 ședințe*, *Popular · 10 ședințe*, *Pro · 20 ședințe*) and clean prices. |
| 5 | My schedule | A few upcoming sessions on the calendar + the check-in code visible. |
| 6 | Welcome / CTA | The existing emerald Welcome screen (barbell + taglines), in Romanian. |
| 7 | Gym map *(optional)* | Map centered on a city with several trainer/gym markers (clustered), one callout open. |

### Prerequisite: demo dataset
Frames 1–5 require a seeded demo account with multiple trainers (photos, reviews, packages). The local
database was recently empty of packages, so **staging realistic demo data is a hard prerequisite**
before any capture — especially for Frame 4 (packages must actually be saved on the demo trainer).

## Store & technical requirements

**Localization:** Romanian-only listing. All app screenshots captured with the app language set to RO;
all captions in Romanian.

**Sizes (design once on the master, export per target):**

| Target | Dimensions | Notes |
|--------|------------|-------|
| iPhone 6.7″ (master) | 1290 × 2796 px | App Store primary required size. Design all frames here. |
| iPad 13″ | 2048 × 2732 px | **Required** because `app.json` has `supportsTablet: true`. Re-lay-out captions for the wider canvas; do not just upscale the phone frame. |
| Google Play phone | 1080 × 1920 px (9:16) | Re-export/pad the master; the caption-top gradient layout scales down cleanly. |
| Play feature graphic | 1024 × 500 px | Listing header. Reuse gradient + logo + a tagline (e.g. *Găsește antrenorul perfect*). |

**Counts & ordering:** Ship all 6 core frames (optionally 7 with the map). Order is fixed:
1 Find → 2 Trust → 3 Filter → 4 Pricing → 5 Schedule → 6 CTA (→ 7 Map). Frames 1–3 must be the
strongest because they're what shows in search.

**Compliance note:** keeping `supportsTablet: true` obligates the iPad screenshot set; an iPad-claimed
listing without iPad screenshots is incomplete/rejectable. (The alternative — setting it to `false` —
was considered and declined; iPad support is being kept.)

## Out of scope
- No framing tool/pipeline is built (strategy + copy only).
- No app preview *video* (separate effort).
- English/other-locale screenshot sets (RO-only by decision).

## Production order (summary)
1. Stage the demo dataset (trainers, photos, reviews, packages) and set app language to RO.
2. Capture the 6–7 raw RO screenshots on a 6.7″-class device/simulator and an iPad.
3. Build the caption-top gradient template (headline + subhead + framed device) at the 1290 × 2796
   master; render Frame 6 full-bleed.
4. Export each frame for iPhone 6.7″, iPad 13″, and Google Play phone; produce the Play feature graphic.
5. Upload in the fixed order to App Store Connect (RO locale) and Google Play (RO locale).
