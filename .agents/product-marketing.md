# Product Marketing Context

**Document version:** v2
**Last updated:** 2026-08-13

> Auto-drafted from the codebase (`CLAUDE.md`, `docs/ideas-backlog.md`, the billing
> and schedule services, the RO/EN translation file, and the gym table). Sections
> marked **⚠ needs your input** could not be derived from the repo and must not be
> guessed — see "Known gaps" at the end.

## Product Overview

**One-liner:** Salvio îi dă antrenorului personal unealta gratuită care înlocuiește
programarea pe WhatsApp și caiet — și, pe măsură ce se adună antrenori, devine
locul unde clienții îi găsesc.

**What it does:** Mobile app (iOS + Android, Expo/React Native) with a Romanian-first
interface. Trainers manage a weekly schedule, assign clients to slots, sell and track
session packages, and confirm attendance with a per-client check-in code. Clients see
their upcoming sessions, get a push reminder the evening before, and can browse
trainers by gym, specialization, and price.

**Product category:** Two shelves, depending on the side. To a trainer it is a
*scheduling and client-management tool*. To a client it is a *marketplace for finding
a personal trainer*. The go-to-market leads with the first — see `docs/ideas-backlog.md`:
the pitch is "free tool that replaces WhatsApp/notebook scheduling", **not** "get
listed in my (empty) marketplace".

**Product type:** Two-sided local marketplace, mobile only. No web app today; the
absence of a domain currently blocks URL deep links and public trainer pages.

**Business model:** Supply-side subscription. **Trainers pay, clients are free.**
Plans run 1 / 3 / 6 / 12 months (`server/src/config/billingPlans.ts`), billed through
RevenueCat IAP on device; Stripe exists but is gated off on native. Entitlement is
`Trainee Pro`.

**Founding-trainer grant — live in production, confirmed 2026-08-13.** Every trainer
profile created on or before **2026-09-30** gets **3 months free** as a RevenueCat
promotional entitlement — no store purchase, no auto-charge (`EnvBillingConfig.ts`,
`BillingService.grantFoundingEntitlement`). The three months run from the moment the
grant is issued, not to a fixed end date: a trainer who joins on 29 September is
covered until 29 December.

**There is no cap on how many trainers get it.** `grantFoundingEntitlement` checks the
deadline and nothing else — no count limit exists in the code. `docs/ideas-backlog.md`
describes the offer as "first ~50 trainers", which is *not* what ships. Marketing it as
a limited number of spots would be scarcity the product does not enforce; the honest
scarcity is the date. (The same backlog section says 12 months and argues for it —
superseded by the 3 months now live.)

## Target Audience

**Supply side (who pays):** Personal trainers in Romania, starting with
**Cluj-Napoca**. The defining trait: *they already have 10–20 clients*, managed across
WhatsApp threads and a paper notebook. Priority targets are trainers with 1k–20k local
Instagram followers — they are the distribution channel, not just the inventory.

**Demand side (free):** People in Cluj who can afford personal training — the city's
IT salaries and ~100k students are the stated reason for choosing it as launch city.

**Primary use case:** A trainer stops running their week out of WhatsApp and a
notebook, and their existing clients get an app that shows their sessions.

**Jobs to be done — trainer:**
- "Stop losing track of who booked what and who still owes me sessions."
- "Look like a professional operation to a new client."
- "Eventually, get clients I didn't have to chase myself."

**Jobs to be done — client:**
- "Find a trainer near a gym I'd actually go to, who isn't a stranger from Instagram."
- "Know when my next session is without scrolling back through a chat."

**Use cases:**
- Trainer sets a working-hours template, generates slots, drag-assigns clients per day
- Trainer sells a 5- or 12-session pack; booking consumes one, cancellation refunds it
- Client shows a check-in code at the gym; the trainer confirms attendance
- Trainer shares an invite code; the client signs up already connected, and is prompted
  to review the trainer they have genuinely trained with
- A prospective client browses the gym map and opens a trainer's profile

## Personas

Not a B2B buying committee — a marketplace with two independent sides.

| Persona | Cares about | Challenge | Value we promise |
|---|---|---|---|
| **Trainer (payer, champion)** | Filling their week, getting paid, looking professional | Runs the whole business from WhatsApp and a notebook; forgets who paid for what | One place holding the schedule, the client list, and the remaining sessions |
| **Trainer's existing client (imported)** | Knowing when the next session is | Buries session details in a chat thread | Their sessions, their remaining pack, a reminder the night before |
| **New client (marketplace demand)** | Finding someone trustworthy nearby | No way to compare trainers; relies on word of mouth or Instagram | Trainers filtered by gym, specialization and price, with reviews from real clients |
| **Gym (channel, not a user)** | Busy trainers, busy floor | — | A poster and a QR that sends members to trainers who work there |

## Problems & Pain Points

**Core problem (trainer):** The business runs on WhatsApp threads and a paper notebook.
Scheduling, package balances, and attendance all live in the founder's head or in chat
history, and none of it is searchable.

**Core problem (client):** Finding a personal trainer in Romania is word of mouth or
Instagram scrolling. Nothing lets you compare who works at your gym, what they charge,
or whether anyone has actually trained with them.

**Why alternatives fall short:**
- **WhatsApp** — where the work actually happens today. Great for talking, hopeless as
  a record. No slot view, no pack balance, no attendance history.
- **Generic booking tools (Calendly and similar)** — model a meeting, not a package of
  sessions consumed over months at a specific gym.
- **Instagram** — a discovery surface with no booking, no schedule and no accountability.
- **Workout-logging apps (Hevy, Strong, FitNotes)** — solve a different problem
  entirely: self-guided training, not the trainer relationship. `docs/ideas-backlog.md`
  deliberately declines to compete here.

**What it costs them:** Double-booked slots, sessions given away because nobody
remembers the pack ran out, and no-shows with no record to point at.

**Emotional tension (trainer):** Looking amateurish next to a gym's in-house offer,
and the low-grade dread of having the whole business in one phone's chat history.

## Competitive Landscape

**Secondary (the real competitor):** WhatsApp + a notebook. Free, already installed,
already the habit. This is what you are actually displacing.

**Indirect:** The gym's own in-house trainer assignment — the member never chooses,
the front desk pairs them with whoever is on shift.

**Indirect:** Doing nothing — group classes, or training alone with a logging app.

**Direct:** ⚠ **needs your input.** No Romanian PT marketplace is named anywhere in the
repo, and naming one from memory would be a guess. If direct competitors exist, add
them here; if they genuinely do not, say so — "there is no incumbent" is itself a
positioning fact worth writing down.

## Differentiation

**Key differentiators:**
- **The wedge is a free tool, not the marketplace.** Trainers get value on day one with
  zero other users on the platform. This is the answer to the cold-start problem.
- **Reviews are earned, not bought.** Only a trainer's own clients can review them, and
  the server enforces it with a 403 — see commit `757b1e2`, "harden the review system
  against self-dealing". Attendance is tied to a real check-in code at a real gym.
- **Session packages are modelled properly.** Booking consumes a session, cancelling
  refunds it. Generic schedulers don't do this.
- **National gym coverage from day one.** 1,795 gyms imported from Google Places, ~40
  per city across Bucharest, Craiova, Iași, Baia Mare, Constanța, Sibiu, Arad and
  Cluj-Napoca. A trainer in any of those cities can already find their gym.
- **Romanian-first.** RO is the default language, not an afterthought translation.

**How we do it differently:** We do not try to win the client before we have the
trainer. Each trainer brings 10–20 existing clients, and the marketplace emerges from
density, one city at a time.

**Why that's better:** A marketplace that is useful at zero liquidity. The trainer's
week is better organised whether or not anyone else ever signs up.

## Objections

| Objection | Response |
|---|---|
| "I already have my clients — what do I need a marketplace for?" | You don't, yet. It replaces the notebook and the WhatsApp scrolling. New clients are the upside, not the pitch. |
| "There's nobody on it." | True, and that's why anyone who joins before 30 September gets three months free. You bring your own clients; the platform earns the next ones. |
| "Another subscription I have to remember." | Three months free, no card, no auto-charge — it's a promotional grant, not a trial that quietly bills you. |
| "My clients won't download an app." | They don't sign up cold — you send an invite code and they land already connected to you, seeing their own sessions. |
| "I'm not technical / this will take an evening to set up." | Concierge onboarding: 20 minutes sitting together and the profile is done — photos, credentials, gyms, working hours. |

**Anti-persona:**
- Online-only coaches with no physical gym — the whole model assumes a gym, a map pin
  and an in-person check-in.
- Anyone wanting workout logging or an exercise library. Deliberately not built, and
  not planned.
- Trainers with two clients and no intention of growing — the scheduling pain isn't
  real for them yet.

## Switching Dynamics

**Push:** Losing track of pack balances; double-bookings; a client who insists they
still have sessions left and no record to check.

**Pull:** A schedule they can see at a glance, a client list that survives losing the
phone, and the prospect of inbound clients once their city fills up.

**Habit:** WhatsApp is enormously entrenched in Romania — so much so that
`docs/ideas-backlog.md` deliberately refuses to build in-app chat and keeps the contact
hand-off instead. Do not fight this; the client conversation stays on WhatsApp.

**Anxiety:** "Will my clients actually install it?" and "what happens to my data when
the free period ends?" Both are worth answering explicitly in outreach.

## Customer Language

⚠ **needs your input — this section is empty on purpose.**

There are no interview transcripts, support tickets, reviews, or survey responses in
the repo, so there is no verbatim customer language to capture. Inventing plausible
quotes here would poison every downstream skill that reads this file. Fill this in
after the first concierge onboarding sessions — you will be sitting with trainers for
20 minutes each, which is exactly when to write down how they describe the problem in
their own words.

**Product vocabulary already fixed in the RO interface** (`src/lib/i18n/translations.ts`):

| Term | Meaning |
|---|---|
| Antrenor personal | Personal trainer |
| Ședință | A single training session |
| Pachet | A block of prepaid sessions (booking consumes one, cancelling refunds it) |
| Sală | Gym |
| Cod de check-in | Per-client code confirming attendance at the gym |
| Cod de invitație | Trainer's share code that pre-links a new client to them |
| Recenzie | Review — only a trainer's own clients can leave one |

**Words to avoid:** "booking" in the client's voice — clients cannot self-book; the
trainer assigns them. Promising self-booking in copy would describe a product that
does not exist.

## Brand Voice

**Tone:** Direct and informal. The Romanian copy addresses the user as *tu*, never the
formal *dumneavoastră*.

**Style:** Plain and practical. Short labels, no marketing throat-clearing. The app's
own strings are instructions, not slogans.

**Personality:** Practical, local, unfussy, trustworthy, quietly modern.

**Visual anchor:** Emerald green (`#10B981`) on a crisp light background. Light theme
only — there is no dark mode by design.

## Proof Points

⚠ **needs your input — nothing here is known.**

No metrics, customers, logos, or testimonials exist in the repo, and none should be
written here until they are real. The development database holds seed and test data
only (15 users, 8 trainers, 3 reviews) and must never be cited as traction.

| Theme | Proof |
|---|---|
| Reviews you can trust | Server-enforced: only a trainer's own clients can review — *(claimable today, it's a product fact)* |
| Real attendance | Check-in codes tie sessions to actual gym visits — *(claimable today)* |
| Gym coverage | 1,795 gyms across Romania already mapped — *(claimable today)* |
| Trainer adoption | ⚠ unknown |
| Client retention | ⚠ unknown |

## Goals

**Business goal:** Reach marketplace density in one city before opening a second.
The stated gate is **30 active trainers and 300 registered clients in Cluj-Napoca**;
Bucharest is city #2, district by district.

**Key conversion action:** A trainer completes a full profile *and* sends invite codes
to their existing clients. A half-filled profile is explicitly considered worse than
none — that is why onboarding is done sitting with them.

**Secondary conversion:** A client accepts an invite and leaves a review of the trainer
they already train with — this is the honest fix for the zero-reviews cold start.

**Current metrics:** ⚠ unknown. No production analytics are visible from the repo.

## Known gaps

Fill these in and re-run `/product-marketing` to bump this to v2:

1. **Actual prices.** `billingPlans.ts` defines 1/3/6/12-month plans but the amounts
   live in Stripe and RevenueCat, not in code.
2. **Direct competitors** — or written confirmation that there is no incumbent.
3. **Verbatim customer language** — after the first trainer conversations.
4. **Any real traction numbers** from production.
5. **`docs/ideas-backlog.md` is now stale** on the founding offer — it still says
   12 months for the first ~50 trainers. Reality is 3 months, uncapped, deadline-gated.

## Changelog

*Newest first. One line per revision: what changed and why.*
- v2 (2026-08-13) — Founding grant confirmed live in production at 3 months, resolving the 3-vs-12 conflict; noted that the code enforces no trainer cap, so "first 50 spots" is not claimable.
- v1 (2026-08-13) — Initial context, auto-drafted from the codebase; competitor set, customer language, pricing amounts and traction left explicitly blank rather than guessed.
