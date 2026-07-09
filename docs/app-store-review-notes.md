# App Store Review Notes — Trainee

> Paste the block below into **App Store Connect → your version → App Review Information → Notes**.
> Fill every `‹FILL IN›` first. Keep the pasted text under the 4000-character ASC limit
> (trim the External Services table if needed). Create the demo accounts so they stay
> active at least 2 weeks past submission.

---

Trainee — Review Notes (bundle: com.juroctech.frontend)

1) SCREEN RECORDING
Demo video (captured on a physical ‹device model, e.g. iPhone 13›): ‹PASTE VIDEO URL›
The recording starts at app launch and shows: sign-up + login, account deletion
(Profile ⋯ menu → Delete my account), browsing/searching trainers, viewing a trainer
profile and reviews, the trainer subscription paywall + Restore Purchases, and the
user-generated-content safety tools (report a review, block a user, unblock).
Location, camera and photo-library permission prompts also appear in the recording.

2) APP PURPOSE
Trainee is a marketplace that connects people looking for a fitness/sports coach with
independent trainers. Clients discover and search trainers, view profiles, ratings and
reviews, see nearby gyms on a map, and manage their session schedule and check-in codes.
Trainers create a public profile, manage gyms, set working hours and a schedule, and
assign clients to session slots. It removes the friction of finding, vetting and
scheduling with a local trainer.

3) ACCESS INSTRUCTIONS & TEST CREDENTIALS
The app is login-gated. Two demo accounts are provided:

Client account (browse, review, report/block):
  Email: ‹CLIENT DEMO EMAIL›   Password: ‹CLIENT DEMO PASSWORD›

Trainer account (already subscribed — shows all gated trainer features):
  Email: ‹TRAINER DEMO EMAIL›  Password: ‹TRAINER DEMO PASSWORD›

Subscriptions: only trainers subscribe; clients use the app free. The paywall
(Checkout screen) is reachable from the trainer account. In-app purchases are handled
by Apple IAP via RevenueCat — please test purchase in the sandbox. "Restore Purchases"
is on the paywall.

UGC safety (Guideline 1.2): open any trainer profile → a review → the "⋯" button to
Report the review or Block the author. "Block trainer" is at the bottom of the trainer
profile. Blocked accounts can be reviewed/unblocked in Profile ⋯ menu → Blocked accounts.

Both demo accounts remain active through ‹DATE — at least 2 weeks out›.

4) EXTERNAL SERVICES
- RevenueCat — App Store in-app subscription validation/entitlements
- Amazon S3 — profile / trainer gallery image storage
- Google Maps & Places — gym map display and gym data
- Transactional email provider — email verification and password reset
- PostgreSQL backend (our own API) — accounts, profiles, scheduling, reviews
(Stripe web checkout code is present but disabled in the native build; all in-app
purchases go through Apple IAP.)

5) REGIONAL DIFFERENCES
The app functions consistently across all regions. It is localized in English and
Romanian (auto-selected, user-switchable); features and content are identical everywhere.
Trainer/gym results depend on the user's location, not on region-gated functionality.

6) REGULATED INDUSTRY
Trainee is a discovery-and-scheduling marketplace for independent fitness trainers. It is
not a medical, healthcare or telehealth service, does not provide diagnoses or treatment,
and does not integrate HealthKit. The operator is Juroc Tech Solutions SRL (Romania);
Terms of Use and Privacy Policy are available in-app (Profile ⋯ → Legal & policies) and
at juroc.tech/terms.html and juroc.tech/privacy-policy.html.

Contact: robertojudele@juroc.tech
