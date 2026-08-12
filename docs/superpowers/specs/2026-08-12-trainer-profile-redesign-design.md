# Public trainer profile — visual redesign

**Date:** 2026-08-12
**Screen:** `frontend/app/trainers/[id].tsx` (client-facing trainer detail)
**Status:** Design approved, ready for implementation planning

## Goal

Replace the card-stack layout of the public trainer detail screen with a
photo-led layout: a full-bleed hero image, a white sheet that overlaps it, and a
sticky primary call to action. Every section that exists today survives; only the
chrome changes.

This is a frontend-only redesign. No API, database, or server changes.

## Why

The screen a client lands on after tapping a trainer is the marketplace's
conversion moment, and today it opens with a 64px avatar inside a bordered grey
card. It also has no primary action at all — the contact icons that are the
entire point of the screen sit below the reviews list, under a fold most clients
never reach.

## Scope

### In

- Hero image, overlapping sheet, identity block, sticky CTA, scrolled-state header
- Restyle of every existing section from bordered cards to sheet sections
- Contact sheet as the primary action
- Overflow menu holding Report issue / Block trainer
- Removing the native nav header for this route
- Splitting the 1184-line route file into focused components

### Out

- **Favorites / saved trainers.** The heart in the mockup implies a feature that
  does not exist: no table, no endpoints, no saved-trainers list. Logged in
  `docs/ideas-backlog.md` as a follow-up. The mockup's heart position is taken by
  the overflow menu instead.
- **Verified badge.** Nothing in the data honestly supports it. `User.isVerified`
  is email confirmation; badging that as trainer credibility misleads clients.
  Revisit when a real credential-verification process exists.
- **Client self-booking.** The mockup's "Programează antrenament" implies clients
  can book their own sessions. They cannot: the schedule model is trainer-driven
  (drag-assign in the day planner, or assign-by-check-in-code), and the
  WhatsApp/Instagram hand-off is the deliberate design per `docs/ideas-backlog.md`.
  The CTA opens the contact sheet and is labelled accordingly.
- The trainer's own profile (`features/trainer/TrainerProfile.tsx`) is untouched.

## Layout

### Hero

Full-bleed image, `height = 42%` of window height, running under the status bar.

Image source, in order:

1. `trainer.user.profileImageUrl`
2. `trainer.galleryImages[0].imageUrl`
3. Green gradient (`theme.gradients.primary`) with the trainer's initials at ~56px

Note that (1) fixes a live bug: the screen currently reads the avatar from
`params.profileImageUrl`, a route param passed by the search card. Any entry
point that does not pass params — a deep link, or navigation from anywhere but
search — renders initials even when a photo exists in the API response.

Overlays on the hero:

- A top scrim (`rgba(0,0,0,0.5)` → transparent, ~110px) so the status bar and
  buttons stay legible against a bright photo.
- Circular back button (`←`), top-left, offset by `useSafeAreaInsets().top`.
- Circular overflow button (`⋯`), top-right, same offset.
- Both buttons: 34px, `rgba(17,24,39,0.42)` fill, 1px `rgba(255,255,255,0.18)`
  border, white glyph. Minimum 44×44 touch target via `hitSlop`.

### Sheet

A white surface with `borderTopLeftRadius / borderTopRightRadius: 26`, pulled up
over the hero by `marginTop: -26`, with an upward shadow. All page content lives
inside it. Horizontal padding: 18px.

### Identity block

```
Andrei Popescu                    ← 22px / weight 800 / letterSpacing -0.4
5 ani experiență · București      ← 12.5px / textSecondary
★ 5.0 (32 recenzii)               ← star in theme.colors.primary
```

- Subtitle composes `experienceYears` and `locationCity`, joined by `·`, dropping
  either part when absent. This replaces both the mockup's grey "Antrenor
  personal" line and its separate 📍 pin row.
- The rating star switches from amber (`#F59E0B`) to `theme.colors.primary` to
  match the mockup. Review-list stars stay amber — they are a different signal.
- **Removed:** the Available/Unavailable pill and the profile-view count. Views
  are a trainer-facing vanity metric with a home in `trainer-analytics`;
  `isAvailable` no longer surfaces on this screen at all.

### Sections

**Revised after first review.** The original plan gave every section the same
treatment — heading, content, hairline divider. With two sections that reads
fine; with six it becomes an undifferentiated wall, which is exactly how it
landed. Sections are now split into **three visual registers matching how the
content is actually consumed**:

- **Prose you read** — flat on the white sheet, no container.
- **Data you compare** — a tinted block (`#F8FAFC`, radius 14, **no border, no
  shadow**), so it scans like a table. This is not a return of the bordered
  cards: those wrapped *every* section and so carried no information, whereas
  the tint here means "these are figures, not paragraphs".
- **Media you scan** — edge to edge, negating the sheet's 18px padding, under a
  quiet 10px uppercase label rather than a heading that would compete with the
  images.

Dividers between sections are gone; whitespace (26px) separates them. One
divider stays under the identity block and one above Reviews.

| Section | Register | Source | Change |
|---|---|---|---|
| Specializări | prose | `specializations` | Chips go from green-tinted to neutral `#F1F5F9` / `#334155` — the CTA should be the only green thing competing for attention |
| Despre mine | prose | `bio` | Unchanged content |
| **Prețuri** | tinted | `minSessionPrice`, `trainerPackages` | **Rates and Packages merge into one block** — two headings answering "what does this cost?", one of them a single row. Omitted when there is neither. **Also fixes a copy bug**: the screen rendered `myPackages` ("Pachetele Mele") while showing *someone else's* packages |
| Săli disponibile | tinted | `availableGyms` | Absorbs the standalone Location section, now redundant with the subtitle |
| Galerie | media | `galleryImages` | `TrainerImageCarousel` with `bleed={18}` |
| Certificări și Premii | media | `credentialImages` | Same, `resizeMode="contain"` |
| Recenzii | prose | `reviews` | Same behaviour (write / edit / delete / report / block), restyled |

`TrainerImageCarousel` needed fixing, not just reusing: it rendered its own
bordered, shadowed card with a 20px `typography.h3` title, so the two media
sections were cards *inside* the flat sheet with a heading size found nowhere
else on the screen. It now has no card chrome, a quiet uppercase label, and an
optional `bleed` prop. Its only consumer is this screen.

Row separators inside tinted blocks use `#E7EDF3`; the `#F3F6F9` used on white
is invisible against the tint.

Bottom padding must clear the sticky CTA: `88 + insets.bottom`.

### Sticky CTA

Pinned to the bottom of the screen, above the content, over a white-to-transparent
gradient so scrolling content doesn't collide with it.

- `GradientButton` from `src/components/ui`, `borderRadius: 999`, height 46
- Label: `t("contactTrainer")` — "Contactează antrenorul" / "Contact trainer"
- `onPress` → contact sheet (below)
- **Hidden entirely when `contactOptions.length === 0`.** A trainer with no
  Instagram, Facebook, or WhatsApp has nothing for the button to do; showing a
  disabled button advertises a dead end. When hidden, bottom padding drops to
  `24 + insets.bottom`.

### Scrolled state

Chosen behaviour: **the hero scrolls away, and a bar fades in.**

An `Animated.ScrollView` drives a single interpolation over
`scrollY ∈ [heroHeight - 100, heroHeight - 60]`, mapping opacity `0 → 1` on an
absolutely-positioned white header containing `←`, the trainer's name (16px/700,
`numberOfLines={1}`), and `⋯`. The floating hero buttons fade out on the inverse
ramp so exactly one set is visible at a time.

Uses `Animated` from `react-native` core with `useNativeDriver: true`. Salvio has
no Reanimated, and this design deliberately avoids needing it.

### Navigation

`app/_layout.tsx:153` changes from

```tsx
<Stack.Screen name="trainers/[id]" options={{ title: t("trainerDetailsTitle"), headerBackButtonDisplayMode: "minimal" }} />
```

to `options={{ headerShown: false }}`, so the photo can run under the status bar.

There is a known hazard here, already documented at `app/_layout.tsx:105`: the
first header screen pushed over a `headerShown: false` screen can come up
unresponsive. This screen is a common origin for pushes to `/report-issue`
(header shown), so **that path must be tested explicitly** — see Verification.

The `trainerDetailsTitle` key stays in `translations.ts`; it becomes the accessible
label for the scrolled-state header rather than dead weight.

## Contact sheet

Opened by the CTA. Built on the existing `BottomSheet`, which currently lives in
`src/components/schedule/SchedulePrimitives.tsx` — a schedule module importing
into a trainer screen is the wrong dependency direction, so:

- Move `BottomSheet` to `src/components/ui/BottomSheet.tsx`
- Update its one consumer, `app/trainer-schedule/[date].tsx:55`
- No re-export shim

Contents: one row per available contact option, each with the platform icon in
its brand colour, the platform name, and a chevron. Reuses the existing
`contactOptions` memo and `openContactUrl` callback verbatim — including the
WhatsApp `whatsapp://` → `https://wa.me/` fallback, which is already correct.

**Shortcut:** when exactly one contact option exists, the CTA opens it directly
instead of presenting a one-row sheet.

The standalone row of circular social icons near the bottom of the page is
removed; the CTA is now their home.

## Overflow menu

The `⋯` opens an `Alert.alert` action sheet — matching `handleReviewOptions`,
which already uses this pattern on this screen — with:

- Report issue → `router.push("/report-issue", { targetType: "trainer", ... })`
- Block trainer → existing `handleBlockTrainer` confirmation
- Cancel

The two full-width red buttons at the bottom of the page are deleted.

## File structure

`app/trainers/[id].tsx` is 1184 lines and this redesign adds to it. Split into
`src/components/trainer-detail/`:

| File | Responsibility |
|---|---|
| `TrainerHero.tsx` | Hero image, source fallback chain, scrim, floating buttons |
| `TrainerIdentity.tsx` | Name, subtitle, rating row |
| `TrainerSections.tsx` | Specializations, bio, rates, packages, gyms |
| `TrainerReviews.tsx` | Review list, write/edit form, per-review options |
| `TrainerStatusScreen.tsx` | The four full-screen states, which share one shape |
| `ContactSheet.tsx` | The contact bottom sheet |
| `useReviewComposer.ts` | Review form state and the create/update/delete mutations |
| `useTrainerContact.ts` | Contact option list, link opening, sheet visibility |
| `trainerProfileView.ts` | Pure header derivations (hero fallback, name, subtitle) |
| `styles.ts` | Shared section/heading/divider styles |

The route file keeps data fetching, navigation, the block/report handlers, the
scroll animation, and the composition of the above.

**It landed at 541 lines, not the sub-400 this section originally targeted.**
The estimate was written before the screen existed and undercounted the imports,
the scroll-header wiring, and the sticky CTA. Every extraction above is
justified by cohesion; going further would mean splitting the screen's own
composition across files to chase a number, which would make it harder to read
rather than easier.

The URL-normalising helpers at the top of the route file (`normalizeSocialUrl`,
`normalizeWhatsAppPhoneDigits`, `getWhatsAppContactUrls`) move to
`src/lib/contactLinks.ts` — they are pure functions with real edge cases and no
JSX, and they are the natural first unit tests here.

## Data

No new fields. Everything comes from the existing `PublicTrainerProfile`,
`useGetTrainerReviewsQuery`, and `useGetTrainerPackagesQuery`.

The route-param fallbacks (`params.firstName`, `params.totalRating`, …) stay:
they let the screen paint instantly from the search card's data while the detail
query resolves. `params.profileImageUrl` remains as a hero fallback *ahead of*
gallery, so a search-originated push shows the photo with no flash — but it is no
longer the only source.

## i18n

New keys, EN + RO:

| Key | EN | RO |
|---|---|---|
| `yearsExperience` | {n} years experience | {n} ani experiență |
| `trainerOptions` | Trainer options | Opțiuni antrenor |
| `contactVia` | Contact via | Contactează prin |
| `packages` | Packages | Pachete |

`packages` and `rates` are **new keys, not renames.** `myPackages` must stay as
it is: `features/trainer/TrainerProfile.tsx:458` and
`features/users/CreateTrainer.tsx:361` both show the trainer their *own*
packages, where "My Packages" is correct. Only this screen switches to
`packages`. `experienceAndRates` has no other consumer and becomes dead once this
screen uses `rates`; delete it from both language maps.

Three keys this section originally planned turned out to be unnecessary —
`translations.ts` carries a number of defined-but-unused keys, so check before
adding:

- **`contactTrainer` already existed** in both maps and had no consumer — a dead
  key, now revived by the CTA. Only its EN casing changed, "Contact Trainer" →
  "Contact trainer".
- **`aboutMe` already existed** as "About Me" / "Despre mine", which is the
  mockup's wording. The bio heading uses it instead of mutating `about`, so no
  existing key changes meaning.
- **`pricing` already existed** ("Pricing" / "Tarife"), also unused. Revived for
  the merged block; the RO value changed to "Prețuri" since it now covers the
  session rate *and* the packages. The `rates` key added earlier in this work is
  removed again — the merge made it redundant.

`src/lib/i18n/__tests__/translations.test.ts` guards EN/RO parity, which is what
caught these — a key present in one map only fails silently at runtime.

`yearsExperience` uses the codebase's existing `.replace("{n}", …)` convention
(cf. `cancelBookingConfirm` in `app/my-schedule.tsx:110`).

## Edge cases

| Case | Behaviour |
|---|---|
| No photo anywhere | Gradient hero with initials; layout height unchanged |
| No contact options | CTA hidden, bottom padding reduced |
| Exactly one contact option | CTA opens it directly, no sheet |
| No specializations | Section omitted (already the case) |
| No packages / gyms / gallery / credentials | Sections omitted |
| Long name | `numberOfLines={2}` in the identity block, `{1}` in the scrolled header |
| Missing city *and* experience | Subtitle omitted; rating row moves up |
| Trainer blocked | Existing full-screen blocked state, unchanged |
| Loading / error / invalid id | Existing states, unchanged |

## Tests

The frontend had no test setup at all. Jest is now configured at **29.x, not 30**
— `react-native@0.81.5` depends on `jest-environment-node@29`, which hoists
`jest-mock@29` to the top of the tree; jest 30's runtime then resolves the wrong
`jest-mock` and every suite fails to start. Matching React Native's version
avoids overriding its own tooling.

`jest.config.js` is scoped to pure TypeScript under `src/` (`testEnvironment:
node`). Component rendering would need the jest-expo preset plus mocks for
expo-router, the Redux store, and native modules — a much larger setup than the
logic under test justifies. `npm test` runs it.

| Suite | Covers |
|---|---|
| `src/lib/__tests__/contactLinks.test.ts` | URL normalising and WhatsApp number extraction |
| `src/components/trainer-detail/__tests__/trainerProfileView.test.ts` | Hero fallback chain, name, initials, subtitle composition |
| `src/lib/i18n/__tests__/translations.test.ts` | EN/RO key parity, blank values, placeholder survival |

### A bug the tests caught

`getWhatsAppContactUrls` stripped non-digits from the whole raw string *before*
checking the hostname, so any value holding 7–15 digits became a phone number. A
trainer pasting `facebook.com/profile.php?id=100012345678` into the WhatsApp
field got a working-looking button that opened WhatsApp on the Facebook id.

Pre-existing behaviour, carried over verbatim in the move to
`src/lib/contactLinks.ts` — but this redesign promotes it from a small icon below
the reviews to the screen's primary CTA, so it now fails loudly. Fixed by only
attempting raw-digit parsing when the value contains no letters, since a phone
number never does; anything with letters is matched on its host instead.

## Verification

1. `npx tsc --noEmit` clean.
2. `npm test` green.
2. Trainer with photo, gallery, packages, gyms, credentials, and reviews — full
   scroll, hero → scrolled header transition, CTA reachable throughout.
3. Trainer with none of the above — no empty sections, no orphan headings,
   gradient hero, no CTA.
4. Deep link straight to `/trainers/<id>` with no route params — hero shows the
   photo (the bug this fixes).
5. Push to `/report-issue` from the overflow menu and confirm the header screen
   is responsive — the `headerShown: false` hazard at `app/_layout.tsx:105`.
6. Both languages; RO is the default (`3005c8b`).
7. Android and iOS: safe-area insets top and bottom, and the Android back gesture
   (`predictiveBackGestureEnabled: false`).

## Follow-ups

- **Favorites / saved trainers** — added to `docs/ideas-backlog.md`.
- **Verified badge** — needs a real credential-verification process first.
- **Client self-booking** — a product-model change; its own spec if ever wanted.
