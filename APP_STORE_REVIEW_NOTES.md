# App Store — Notes for Reviewer

Paste the block below into the **App Review Information → Notes** field in App Store
Connect. Fill in the two `<...>` placeholders (contact phone) before submitting.

---

Thank you for reviewing Salvio.

WHAT THE APP DOES
Salvio is a two-sided fitness-trainer marketplace. Trainers pay a subscription to
be listed; clients browse, contact, and book trainers for free. Payment for the
actual training sessions happens off-app, in person — the app never processes
client-to-trainer payments. The trainer subscription is the only in-app purchase and
uses StoreKit (via RevenueCat).

IMPORTANT — GEOGRAPHY / WHY SEARCH MAY LOOK EMPTY
The marketplace is launching in Romania (Bucharest, Cluj-Napoca, Timișoara).
Searching from a US location returns no trainers, which is expected at launch. To
see populated data, please sign in with the demo accounts below, or search by city
name ("București", "Cluj-Napoca", "Timișoara") or use the Map screen.

DEMO ACCOUNTS (password for both: DemoPass123!)
- Trainer:  andrei.popescu.demo@salvio.app
    Featured trainer with profile photo, reviews, and session packages — best account
    to see a fully populated trainer profile and the trainer-side schedule.
- Client:   client1.demo@salvio.app
    Use to browse/search trainers, view the map, and try the client flows below.

FLOWS THAT AREN'T OBVIOUS
1. Check-in code: the client opens "My Schedule" and taps "Generate check-in code"
   to get a 6-digit code. The trainer enters that code on their side to confirm the
   client attended a session. This is attendance confirmation only — no payment.
2. Trainer invite code: a trainer shares an invite code; the client enters it on
   "My Schedule" to link to that trainer.
3. Two-sided model: only trainers see the subscription paywall. Client accounts
   never see it.

ABOUT STRIPE IN THE BUNDLE
The Stripe SDK is present in the binary but web/card checkout is disabled on iOS.
There is no external or alternative purchase path in the app — the only way to
subscribe is Apple In-App Purchase. Stripe is reserved for a future web version.

PUSH NOTIFICATIONS
Reminders are opt-in and off by default. The permission prompt only appears after
the user turns on the "Session reminders" toggle in My Schedule. Notifications are
transactional only (a reminder the evening before a booked session) — no marketing.

CONTACT DURING REVIEW
Phone: <your phone number>
Email: <your contact email>

Thank you!
