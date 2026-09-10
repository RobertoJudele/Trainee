# Salvio — Idea Backlog

Everything from the cold-start / feature brainstorm (2026-07-03). Session-package
tracking is already built (booking consumes a session, cancel refunds it) — the
rest lives here.

## Cold-start / go-to-market plan

Core insight: **every Romanian PT already has clients** (managed via WhatsApp +
notebook). Seed trainers with the free scheduling tool; each trainer brings
10–20 existing clients. The marketplace emerges from density, one city at a time.

### 1. ~~Kill the paywall at launch~~ — **live in production** (confirmed 2026-08-13)
- Shipped as **3 months free**, not 12, and **with no cap on the number of
  trainers**. `BillingService.grantFoundingEntitlement` checks the deadline and
  nothing else, so the "first ~50" framing is not what runs — do not advertise a
  limited number of spots. The real scarcity is the date.
- **Deadline: 2026-09-30**, set in `EnvBillingConfig.ts` and overridable per
  environment with `FOUNDING_GRANT_DEADLINE` / `FOUNDING_GRANT_MONTHS`. Clearing
  the deadline env var switches the promo off.
- The three months run **from the moment the grant is issued**, not to a fixed end
  date: joining on 29 September means cover until 29 December. Copy should say
  "sign up by 30 September for 3 months free", never "free until December".
- Implemented as a RevenueCat *promotional* entitlement — no store purchase, no
  auto-charge, and it does not silently convert to a paid subscription. The call is
  idempotent, so retries never stack.
- **Not implemented: the "grandfathered discount forever" part.** Only the
  three-month grant exists; there is no permanent founder price. Either build it
  before promising it, or drop it from the pitch.
- **Open risk, carried over from the original plan.** The 12-month figure was
  argued for on the grounds that "trainers must survive the low-demand period
  without churning" — three months may expire well before Cluj has enough demand to
  justify paying. Watch what the first cohort does at the 3-month mark; extending is
  an env var, not a code change.

### 2. Launch city: Cluj-Napoca
- ~300k people, compact, ~40–60 relevant gyms — personally coverable in 2 weeks.
- IT salaries + 100k students = the people who pay for PT and download apps.
- Dense, interconnected Instagram fitness scene → word travels fast.
- Success gate before city #2: **30 active trainers, 300 registered clients**.
- Bucharest is city #2, district by district.

### 3. Manual trainer outreach + concierge onboarding (weeks 1–4)
- Import every Cluj gym via `googlePlacesImport.ts`; find trainers via gym
  Instagram tags and walking in.
- Do the onboarding FOR them: 20 min sitting together, full profile, photos,
  credentials, gyms, working hours. A half-filled profile is worse than none.
- Pitch = "free tool that replaces WhatsApp/notebook scheduling" + marketplace
  upside, NOT "get listed in my (empty) marketplace".
- Prioritize trainers with 1k–20k local Instagram followers — they're the
  distribution channel.

### 4. Trainer → client invite link (the one real pre-launch build)
- Deep link from the schedule screen: "Your trainer Andrei uses Salvio — sign up
  to see your sessions and check-in code." Client lands already connected.
- 30 trainers × 15 clients ≈ 400+ real Cluj users at zero acquisition cost.
- At invite-accept, prompt the client to review the trainer ("How long have you
  trained with Andrei?") — solves the zero-reviews cold start legitimately.
- Build: deep link + signup attribution + pre-linking. Moderate.

### 5. Analytics-driven paid conversion (months 4–12)
- Monthly digest email via existing `emailService` + `profileViewTracking`:
  "63 profile views, 4 new contacts, 2 reviews this month."
- Reintroduce paywall per-city when the median founding trainer gets 3+ inbound
  contacts/month from clients they didn't invite. Founding trainers keep their
  deal — they're testimonials for the next city.

### 6. Demand-side tactics (Cluj, ongoing, mostly non-build)
- **Gym partnerships**: poster + QR per gym ("Find a trainer at [Gym] on
  Salvio"); gyms want busy trainers. Gym map already gives each gym a presence.
- **Romanian Facebook groups**: Cluj city groups, student groups (UBB, UTCN,
  UMF), fitness groups. Post as a person, not a brand.
- **Micro-influencer trainers**: give each founding trainer a story-ready
  graphic with their profile QR.
- **Concierge matching**: personally message early clients with 2 hand-picked
  trainer suggestions; teaches you what the matching algorithm should weigh.
- **No paid ads** until organic Cluj demand plateaus — supply saturates fast at
  ~30 trainers.

## Feature backlog — trainer side (wins supply)

### Per-client notes / CRM-lite (small build)
Private notes field per client: injuries, goals, last weights, "knee acting up".
Today this lives across WhatsApp threads. A text field on the trainer↔client
relationship. Compounds with packs into "my whole client book is in here."

### ~~Automatic session reminders~~ — done (push-only, client toggle)
At 19:00 Bucharest time the server pushes "Tomorrow at 18:00 with Andrei" via
Expo push for all of tomorrow's sessions, to clients who opted in (toggle on
My Schedule). Email variant skipped by choice. Needs FCM credentials
configured in EAS for Android production builds.

### Public web profile link (moderate build)
Server-rendered `trainee.app/t/andrei-popescu` (photo, bio, reviews, book-me CTA)
for the trainer's Instagram bio. Makes every trainer a distribution channel.
A simple Express-rendered page; no app changes. As much marketing infrastructure
as feature.

### No-show / attendance stats per client (trivial build)
"Maria: 12/14 sessions attended" surfaced in analytics — check-in data already
exists. Feeds the reminders story.

## Feature backlog — client side (standalone value)

### Check-in streaks + monthly stats (small build — the "mini-game" done right)
Streaks ("6 weeks in a row"), monthly counts ("11 workouts in March"), simple
badges — aggregation over existing check-in rows, tied to REAL gym visits.
Shareable month-summary card ("11 workouts 💪 Salvio") = free Instagram-story
marketing. Highest-priority client-side idea.

### Simple progress tracking (moderate build)
Weight, measurements, progress photos over time. Useful with or without a
trainer; photos ride the existing S3 pipeline. Later becomes a marketplace hook
("share progress with your trainer" / trainer sees a client plateauing).

### Gym map as standalone utility (mostly done)
Lean into "find a gym near you in Cluj": gym details, trainers-per-gym as the
upsell surface.

### Saved / favorite trainers (small build — deferred)
Heart on the trainer profile hero; a "Saved" list on the client profile. Came out
of the 2026-08-12 profile redesign, where the mockup drew a heart the app has no
feature behind — the corner went to the `⋯` overflow instead. Needs a
`client_favorite_trainers` table, POST/DELETE/GET endpoints, an entry point, and
an empty state. Worth it once there are enough trainers per city that a client
browses more than they can remember; pointless at 30 trainers in one city.

### Monthly challenges (small build — deferred)
"12 check-ins in March" badge, maybe per-gym leaderboard. Only after streaks
prove people care.

## Deliberately skipped (and why)

- **Workout logging / exercise libraries** — competing head-on with Hevy/Strong/
  FitNotes; huge build; doesn't feed the marketplace loop.
- **Free workout-video content** — a content treadmill you can't win vs YouTube.
- **Arcade mini-games, points economies, avatars** — engagement theater; churns
  as fast as it hooks.
- **In-app chat** — WhatsApp is entrenched in Romania; building chat well is
  enormous. Existing contact hand-off is fine.
- **Automated late-cancel penalty** (pack session consumed on late cancellation)
  — a policy, not a rule; trainers enforce manually via pack +/- controls. Build
  a configurable cutoff only when a real trainer asks.
- **Pack ↔ offering linkage / pack prices** — trainer_packages offerings are
  display-only pricing today; wire them to client packs when trainers ask.

## Priority order

1. ~~Session-package tracking~~ — **done** (booking consumes, cancel refunds)
2. ~~Trainer → client invite + review prompt~~ — **done** (share-code flow;
   URL deep links deferred until a web domain exists, see public profiles)
3. Check-in streaks + shareable monthly card
4. Public trainer profile pages
5. ~~Session reminders~~ — **done** (push-only with client toggle)
6. Per-client notes
7. Attendance stats
8. Progress tracking
9. Challenges / leaderboards (post-traction)
