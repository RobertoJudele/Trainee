# Trainee — Idea Backlog

Everything from the cold-start / feature brainstorm (2026-07-03). Session-package
tracking is already built (booking consumes a session, cancel refunds it) — the
rest lives here.

## Cold-start / go-to-market plan

Core insight: **every Romanian PT already has clients** (managed via WhatsApp +
notebook). Seed trainers with the free scheduling tool; each trainer brings
10–20 existing clients. The marketplace emerges from density, one city at a time.

### 1. Kill the paywall at launch (trivial build)
- "Founding Trainer" offer: first ~50 trainers in launch city get 12 months free,
  grandfathered discount forever.
- Use existing `billingMode.ts` / entitlement service — grant comped entitlements
  manually, don't build a self-serve free tier.
- 12 months, not 3: trainers must survive the low-demand period without churning.

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
- Deep link from the schedule screen: "Your trainer Andrei uses Trainee — sign up
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
  Trainee"); gyms want busy trainers. Gym map already gives each gym a presence.
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

### Automatic session reminders (small build)
Push/email to the client the evening before ("Session with Andrei tomorrow at
18:00"). No-shows are trainers' #2 pain. Schedule data + `emailService` already
exist. Outreach framing: "the app chases your clients so you don't have to."

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
Shareable month-summary card ("11 workouts 💪 Trainee") = free Instagram-story
marketing. Highest-priority client-side idea.

### Simple progress tracking (moderate build)
Weight, measurements, progress photos over time. Useful with or without a
trainer; photos ride the existing S3 pipeline. Later becomes a marketplace hook
("share progress with your trainer" / trainer sees a client plateauing).

### Gym map as standalone utility (mostly done)
Lean into "find a gym near you in Cluj": gym details, trainers-per-gym as the
upsell surface.

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
2. Trainer → client invite link + review prompt (pre-launch)
3. Check-in streaks + shareable monthly card
4. Public trainer profile pages
5. Session reminders
6. Per-client notes
7. Attendance stats
8. Progress tracking
9. Challenges / leaderboards (post-traction)
