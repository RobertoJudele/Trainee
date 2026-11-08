# LLM Council transcript (20261107-2159)

## Original question

analyze which design should remain and if this looks too aish

## Framed question

## The question

Which design direction should Salvio keep for its mobile app, and does any of it look "AI-generated" (generic, template-like, "AI slop")?

## Product and stage

Salvio is a React Native (Expo) app in Romania. Clients use it to find the personal trainers who work at the gyms around them, see what each charges, and contact them over WhatsApp, Instagram or Facebook. Trainers also use it as a free tool for scheduling, packs and check-in codes.

The audience is people who want a trainer but are too shy to ask a stranger in the gym what they charge. The product promise is "a trainer is never shown without a price".

The app is pre-scale. It launches in Cluj-Napoca first: the target is 30 trainers and 300 clients. Trainers are onboarded in person, and the founder sits with each one to fill in the profile and take photos. Trainers get free access until they convert. Most UI copy is Romanian. The founder is a solo developer finishing a bachelor's degree, and all design work today was done with AI help.

## The three directions on the table

Read the files below. Each `.dc.html` is a 390-px-wide phone mockup as HTML with inline styles. Read the markup and styles to picture the layout. The base path for all files is:
`/private/tmp/claude-501/-Users-robertojudele-Desktop-Trainee/72187b39-d10e-4354-98b8-630e7f8f063f/scratchpad/`

### 0. The current app (branch `ui/design-foundations`, already in TestFlight)

- Archivo Condensed uppercase headings, Manrope body text, IBM Plex Mono for prices and small labels.
- Dark green #047857, solid buttons, no gradients.
- Flat white cards with hairline borders and 20px corners. Selected chips are ink.
- Inline form errors.
- Everything else (layout and structure) is unchanged.
- Mockup of today's trainer page: `trainer-canvas/project/Current.dc.html`.

### A. "Poster" trainer page redesign

- `trainer-canvas/project/Main.dc.html` (first screen) and `trainer-canvas/project/ProposedFull.dc.html` (full page).
- The page is restructured: compact header, a "Cât costă" price card as the second thing on screen, and a sticky bottom bar with the price and "Scrie pe WhatsApp".
- The visual system is the current app's: every section is a white card that opens with a small mono uppercase label, plus pill tags.

### B. "Human / editorial"

Trainer page: `trainer-canvas/project/HumanTop.dc.html` and `trainer-canvas/project/HumanFull.dc.html`.

App-wide sketches in `app-canvas/project/`:
- `Main.dc.html`: Welcome
- `Home.dc.html`: Home, with a new bottom tab bar
- `Search.dc.html`: search results
- `MapSheet.dc.html`: the gym sheet on the map
- `Schedule.dc.html`: the client's schedule

What B does:
- A full-bleed real photo of the trainer.
- The price written as a sentence ("120 lei o ședință.").
- No cards: hairline dividers and varied spacing.
- Mono font only on numbers.
- The trainer's bio as a pull quote, and one featured review.
- One personal button ("Scrie-i lui Andrei pe WhatsApp").
- Warm, green-tinted off-white background.
- Plain trainer lists with the price aligned right.

B depends on real photos of every trainer.

## Research the founder collected on "AI-looking" design tells

- Cards around everything, and cards nested in cards.
- The same spacing everywhere.
- An icon next to every item.
- Monospace used for "tech vibes" on things that aren't data.
- Colored pills and status dots everywhere.
- Grids of identical icon tiles.
- The sparkles icon.
- Generic copy: "Get started", "fitness journey", "find your perfect…".
- The same fade-in animation on every element.
- Everything centered.
- Default fonts.
- Purple gradients.

## What a scan of the current app found

- 19 generic copy strings, for example "Găsește antrenorul de fitness perfect", "Începe acum" and "Fii primul!".
- A 2×2 "Acțiuni rapide" tile grid on Home.
- A sparkles icon.
- 35 decorative mono labels.
- 57 fade-in animations.
- 11 big centered empty-state icons.
- 17 pill and badge styles.
- Initials-in-circles instead of photos.
- Spacing that is mostly 8, 10 or 12 px.

## What's at stake

The founder wants the app to feel human and trustworthy to shy users, not like an AI template. But time is limited, the real bottleneck is getting trainers and clients in one city, and a redesign costs weeks.

The decision: keep the current look, adopt A, adopt B (on the trainer page only or app-wide), or mix them. Also: how "AI-ish" does each one look, honestly?

## Advisor responses

### The Contrarian

B's mockups look human because the content is fake, not because the design is good. Look at what fills them. HumanTop has "[Fotografie: Andrei în sală, nu portret de studio]" where the hero image goes. The Home and Search lists show grey `tone` blobs (#A3ADA8, #B7C0BC) where trainer photos should be. So B's whole premise, a full-bleed real photo, isn't shown anywhere. When the founder takes those photos on a phone under gym fluorescents, a full-bleed layout puts every bad one on display. And nobody has designed the fallback for a trainer who has no photo yet, which at launch is a real case.

Second flaw: B is built around content the trainers don't have yet. The featured review ("Mi-a fost frică de sala de forță…") and "4,8 din 23 de recenzii" are invented. The mocks give it away themselves: "Elena Rus · fără recenzii încă", "Sorina Lazăr · fără recenzii încă". With 30 new trainers, most pages will have an empty pull quote and no featured review. That's exactly when an editorial layout looks hollow, and cards would at least hold the shape.

Third: "120 lei o ședință." quietly drops the "de la" that the current page and A both keep. Writing packs as a sentence ("Sau 440 lei pentru 4, 800 lei pentru 8") breaks for a trainer with no packs or with five. A single "Scrie-i lui Andrei pe WhatsApp" button assumes every trainer uses WhatsApp.

Fourth: B app-wide is not a reskin. Its Home adds a new bottom tab bar (Antrenori / Hartă / Programul meu), which means new navigation. That's weeks of work while the real bottleneck is signing up 30 trainers.

What actually makes the app look AI-made is cheap to fix and needs neither A nor B: 19 generic strings, the sparkles icon, 57 fade-ins, the "Acțiuni rapide" grid, 35 decorative mono labels. A shy user won't spot "AI slop" tells. They'll notice that in Current.dc.html the price is the 4th card ("PREȚUL: AL 4-LEA CARD") and contact comes last. That is the real defect. A fixes it with the "Cât costă" card and the sticky WhatsApp bar.

My recommendation: ship A's structure, run the copy and cleanup pass, and wait on B until you actually have real photos and reviews.

### The First Principles Thinker

You're asking the wrong question. "Does it look AI?" is a designer's worry. A shy person in Cluj doesn't notice Archivo Condensed or count mono labels. What they're really asking is "is this a real person, what will it cost me, and how awkward will the first message be?" Judge each direction by that.

Seen that way, Current.dc.html fails on substance, not style. The trainer is an initials circle ("AȘ"), so nothing shows he's a real person. The price sits in the 4th card ("PREȚUL: AL 4-LEA CARD") under a "Disponibil" pill and "312 vizualizări". The contact buttons come last ("CONTACTUL: ULTIMUL"), as bare "IG / FB / WA". Your whole promise is "never shown without a price", yet the page hides the price and buries the action. That's an information-order bug, and changing the look won't fix it.

Now strip A and B down to what actually changes behavior:
- **A's real contribution is the order:** price second, a sticky "120 lei / Scrie pe WhatsApp" bar. The cards and pills don't matter either way.
- **B's real contribution is content, not a visual system:** a real photo, "120 lei o ședință.", "Prețurile le stabilește Andrei", and "Scrie-i lui Andrei pe WhatsApp". The no-cards look and the off-white background are taste.

The thing that "depends on real photos" isn't a risk for you. You already sit with every trainer and take the photos yourself. With 30 trainers, that's an afternoon each you're already spending.

What nobody drew is the moment that actually scares a shy user: the empty WhatsApp chat. Put a pre-filled message in the deep link: "Bună Andrei, te-am găsit pe Salvio. Aș vrea să încep cu o ședință de 120 lei la Iron Works." That one change probably does more for trust than any of the three looks.

My verdict: keep the current visual system. On the trainer page, use A's order with B's photo, price sentence, personal button and a pre-filled message. Spend a day deleting the sparkles icon, the "Acțiuni rapide" tile grid and copy like "Începe acum". Don't do B app-wide. Redesigning Home, Search and Schedule won't recruit trainer #31 or client #301.

### The Expansionist

B is the only option with upside past "looks less like AI." A and the current look are skins. B turns the parts nobody can copy into the product.

**The photos are an advantage, not a dependency.** The framing treats "B depends on real photos" as a cost. But the founder is already sitting with all 30 trainers in person and taking their pictures. A competitor scraping Instagram can't match a full-bleed photo with the placeholder note "Andrei în sală, nu portret de studio" on every profile. B makes that work show on screen. Current and A hide it behind a circle with the initials "AȘ".

**B's trainer page could be the growth engine.** HumanFull is basically a link-in-bio page already: photo, "120 lei o ședință.", the pull quote, one review, and "Scrie-i lui Andrei pe WhatsApp". Publish it as a web page at salvio.ro/andrei and every trainer gets something they want to put in their own Instagram bio. Thirty trainers, each with a few thousand local followers, all linking back to Salvio, is distribution for free. A's mono labels and pill grid ("● Disponibil", "CÂT COSTĂ") are app furniture. Nobody shares that.

**The price sentences add up to a price index.** Home says "6 antrenori, de la 90 lei". MapSheet says "6 antrenori lucrează aici, de la 90 lei ședința." Search says "14 antrenori, Cel mai ieftin primul." Put together, that's a public answer to "how much does a personal trainer cost in Cluj?" No one in Romania publishes that today. It's a press angle, a search-traffic page, and later a moat in each new city. It only works because B writes prices as sentences a person would say. Cards with price chips can't be quoted.

**The tab bar changes what the app is for.** Antrenori / Hartă / Programul meu makes the client's schedule something people come back to every week. Current treats it as a side screen.

My call: ship B on the trainer page now, with a web version from day one. Next, carry B's plain price-sorted list into Home and Search. Treat the app-wide sketches as the plan for the next city. Pick the design that can spread beyond the app, not just the one that looks least generated.

### The Outsider

I'm 27, in Cluj, I've never hired a trainer, and I'm scared of looking stupid. I open Andrei's page.

**Current:** a grey circle that says "AȘ". Then a green "Disponibil", then "312 vizualizări". Why do I care how many people looked at him? It reads like the trainer's own dashboard leaking into my view. Then "Despre", "Specializări", "Experiență", all in boxes. The price is the fourth card down, and the contact options are "IG FB WA" at the very bottom, like tiny buttons I could miss. Your promise is "never shown without a price" and I still had to scroll to find it. This screen could be any app. Nobody chose anything for me.

**A:** better, because the price is second and it stays stuck at the bottom with WhatsApp. But it still feels like a form filled in by a template: 17 mono-font spots, a "Cât costă" label over a card, "● Disponibil" as a status dot, "Prețurile sunt stabilite de antrenor." It looks like a bank statement. And "AȘ" is still a circle of initials, so I still don't know who he is.

**B:** the first one where I'd actually tap. "120 lei o ședință." is a sentence a person says. "Scrie-i lui Andrei pe WhatsApp" makes it feel like I'm messaging a guy, not filling in a lead form. "Mi-a fost frică de sala de forță" is exactly my fear, and it's placed where I'd see it. The Welcome line "cu prețul la vedere" says what the app is in six words. Home's "6 antrenori, de la 90 lei" answers my real question before I ask it.

The catch: B only works if the photo is real. In the mockups the list avatars are grey blobs (#B7C0BC). If you ship B with grey blobs or initials, it gets worse than now: an editorial layout with an empty face looks fake. Since you're photographing every trainer in person anyway, that's the one thing that has to happen.

Verdict: B for the trainer page and the lists, with real photos as a must-have. Delete "vizualizări" today.

### The Executor

The ranking of A vs B matters less than what ships before the founder's first trainer sit-down in Cluj. Here's how I'd order the work by effort.

**The trainer page doesn't need a backend change.** `app/trainers/[id].tsx` (1,103 lines) already has `profileImageUrl`, `minSessionPrice`, the packages list, `galleryImages`, `whatsappUrl` and the Instagram/Facebook links. B's trainer page is just a different render of data that's already there: one ScrollView and one file. That's 2–3 days, not weeks. A's sticky bottom bar costs about the same: an absolutely positioned View outside the ScrollView, plus safe-area padding.

**B's photo requirement is free for you.** People treat "B depends on real photos" as a risk. The founder already sits with every trainer and takes photos, so it costs him nothing extra. And at 30 trainers, the fallback is "don't publish until the photo is taken." The initials circle at line 459 should just go away.

**App-wide B is the trap.** The `Home.dc.html` sketch adds a bottom tab bar (Antrenori / Hartă / Programul meu). In expo-router that means moving routes into a `(tabs)` group and fixing every `router.push`. `map.tsx` alone is 1,872 lines. That's the weeks-long part, and it doesn't help sign up a single trainer.

**What to do Monday:**
1. Rewrite the trainer page as B: full-bleed photo, "120 lei o ședință.", one personal WhatsApp button. Add A's sticky price/WhatsApp bar once the user scrolls past the hero. Mix them; it's the same file.
2. Run a copy pass over `translations.ts`. The 19 generic strings ("Găsește antrenorul… perfect", "Începe acum") are an afternoon of find-and-replace and fix the loudest AI tell.
3. Delete the sparkles icon and the 2×2 "Acțiuni rapide" grid on Home. That takes an hour.
4. Strip the decorative mono labels and most of the fade-ins on screens you touch anyway. Don't hunt down all 57 in one go.
5. Freeze Search, Map and Schedule as they are until there are 300 clients.

On "AI-ish": A is the current look rearranged, with a card for every section, a mono uppercase label on each and pills everywhere. It hits half of the founder's list of tells. B's trainer page doesn't. But the client only spends real time on one screen before deciding to message a trainer, and that's the trainer page.

## Peer reviews

Anonymization used: Response A = Executor, B = Contrarian, C = Outsider, D = Expansionist, E = First Principles.

### Reviewer 1

1. Strongest: E. It treats "does it look AI?" as the wrong question and finds the real defect in Current: the price is the 4th card and contact comes last. It keeps the best part of each direction (A's order, B's photo, price sentence and personal button) and adds the one idea nobody else had, a pre-filled WhatsApp message for the shy first contact. A comes close because it ties the work to real files and effort.

2. Biggest blind spot: D. It pushes app-wide B, a web link-in-bio and a "price index" for press, but ignores B's point that the reviews and pull quotes are invented and most of the 30 trainers will have neither. D also skips the tab-bar cost and the launch bottleneck. C and D both assume the photos will be good.

3. All five missed that nobody tested this. The founder sits with 30 trainers and can show a few shy clients the mockups in Cluj within days. No one asked what trainers want on their own page or whether they will accept the price shown up front. Nobody raised Romanian diacritics in Archivo Condensed uppercase either. Also missed: the photo-consent or GDPR step when the founder shoots trainers in gyms, and keeping "de la" honest when prices vary.

### Reviewer 2

**1. Strongest: E.** It changes the question from "does it look AI?" to "is this a real person, what will it cost, and how awkward is the first message?" That fits the shy-user brief best. It finds the real defect in Current (price in the 4th card, contact buried at the bottom). It keeps A's order and B's content and drops the taste-only parts. It is also the only response that names the scariest moment for a shy user, the empty WhatsApp chat, and fixes it with a pre-filled deep link. A complements it well with real effort estimates from the codebase.

**2. Biggest blind spot: D.** It pitches a link-in-bio web version, a Cluj price index and a tab bar to a solo founder whose bottleneck is 30 trainers. It ignores what B (Response B) showed: the featured review and "4,8 din 23" are invented, most launch pages will have no reviews, and no fallback exists for a missing photo. C also leans on the invented review.

**3. What all five missed:**
- **Test it.** Nobody suggested showing Current and the trainer page to 5–10 shy Cluj users and the first trainers. That takes an afternoon.
- **Trainers are buyers too.** The founder shows each trainer their own page during the sit-down, so the page is also the pitch that recruits trainers. Their preference counts.
- **Consent.** Full-bleed photos need trainer agreement and GDPR consent.
- **Price freshness.** A stale price breaks the "never without a price" promise faster than any visual tell.

### Reviewer 3

1. Strongest: E. It looks past style to the real problem: the current page shows the price fourth and the contact options last. It takes the useful part from each direction: A's order (price second, sticky bar) and B's content (real photo, price as a sentence, a personal button). It is also the only response with a new high-value idea: pre-filling the WhatsApp message, because the empty chat is what scares a shy user. A comes a close second, with concrete costs from the actual repo.

2. Biggest blind spot: D. It treats the mockup's placeholder text "Andrei în sală, nu portret de studio" as if it were content on the page. It also builds a growth thesis (link-in-bio pages, a city price index) on reviews and photos that don't exist yet. B checked the files and showed that "fără recenzii încă" will be most trainers' state at launch, and D ignores that. D also backs app-wide tabs, which costs weeks. It never addresses the time constraint.

3. What all five missed:
- **The trainers.** They are the bottleneck, yet nobody asked which page a trainer would be proud to show, or would put in their own bio. Getting the trainer to approve their page during the sit-down is the real conversion moment.
- **Testing.** Nobody suggested showing Current, A and B to 5 shy people in Cluj, which takes an hour, before spending days on a redesign.
- **Photo consent and GDPR.** Full-bleed photos of trainers, often with clients beside them, need written permission from both.

### Reviewer 4

1. Strongest: E. It moves the question from "does it look AI" to the three fears a shy user actually has (is he real, what does it cost, how awkward is the first message). It also separates what each option really contributes: A brings the order, B brings the content. And it is the only response with a new, cheap, high-trust idea: a WhatsApp deep link with the message already filled in. A comes close second because it adds real cost estimates from the code: 2–3 days for the trainer page, and a tab bar that would mean weeks of route surgery.

2. Biggest blind spot: D. It builds a growth story (link-in-bio web pages, a public price index, a press angle) while the city is still pre-scale. It ignores B's point that the reviews and pull quotes are invented, and that most of the 30 new trainers will have none. It backs the tab-bar rewrite and a web version from day one, even though there is one solo developer, a thesis to finish, and a recruiting bottleneck.

3. Missed by all five: no one suggests testing with real users. Show 5–10 shy Cluj users Current, A and B on a phone and see which one they would message from. Trainers also get no say: will they approve a full-bleed gym photo of themselves? Nobody checks the lists and empty states once real photos come in at different quality. And nobody raises consent to publish trainers' photos (GDPR).

### Reviewer 5

1. **Strongest: E.** It changes the question from "does it look like AI?" to "is this a real person, what does it cost, how awkward is the first message?" It sees that Current's real defect is the order of information (price in the 4th card, contact last), not the style. It takes A's order and B's content and rejects B app-wide. Its pre-filled WhatsApp message is the only new idea that targets shy users directly. A is a close second because it checks effort against the real file: the initials fallback at line 459, the tab-bar cost and map.tsx.

2. **Biggest blind spot: D.** It builds a growth thesis (salvio.ro/andrei pages, a price index, a press angle) on mockups that B shows are fake: grey placeholder photos, invented reviews, and "fără recenzii încă" on most trainers. It also brings back the app-wide tab bar while the bottleneck is 30 trainers. And in the code, the photo comes from route params (`params.profileImageUrl`), not from the trainer fetch. A deep link or web page would show initials.

3. **What all five missed:** the screen already logs every contact tap (`recordTrainerContact` with the channel). No one suggested measuring taps per page view before and after the change, or putting the page in front of five shy users in Cluj. Nobody planned for trainers without WhatsApp either; only B mentions it, and contact options already render only when a link is present. The decision can be measured. Ship E's version and look at the numbers.

## Chairman verdict

## Where the Council Agrees

- **The current page's real defect is the order of information, not its style.** The price is the 4th card. Contact is last, as tiny "IG / FB / WA" buttons. That breaks your own promise of "never shown without a price". Every advisor named this.
- **Do not do B app-wide.** The new tab bar means moving routes into a `(tabs)` group and fixing every `router.push`. `map.tsx` alone is 1,872 lines, so this is weeks of work. It recruits zero trainers. Four of five advisors said no, and every reviewer agreed.
- **The cheap cleanup does most of the de-AI work.** That means the 19 generic strings, the sparkles icon, the "Acțiuni rapide" grid, the decorative mono labels and most of the 57 fade-ins. It takes a day or two and needs neither A nor B.
- **Initials circles have to go.** "AȘ" tells a shy user nothing about who this person is.
- **The trainer page is cheap to redo.** All the data is already in `app/trainers/[id].tsx`, so it's 2 to 3 days and no backend work.

## Where the Council Clashes

**B's visual system vs. A's structure on the current system.** The Contrarian says B only looks human because the mockups are fake. The hero photo is a placeholder caption, the list photos are grey blobs, and the review is invented. Most launch trainers will show "fără recenzii încă", and an editorial layout with empty slots looks hollow. The Outsider and the Expansionist answer that B is the only version a scared first-timer would actually tap. "120 lei o ședință." and "Scrie-i lui Andrei pe WhatsApp" sound like a person. A "reads like a bank statement." Both sides are right. B's content wins. B's layout is risky until real photos and reviews exist.

**Is the photo requirement a risk or free?** The Executor, the First Principles Thinker and the Expansionist say it's free, because you already photograph every trainer. The Contrarian says phone shots under gym lights, shown full-bleed, will expose every bad photo. Both hold. The photos are free to take, but they are not guaranteed to be good.

## Blind Spots the Council Caught

- **Nobody tested anything.** You can show Current and the new page to 5 shy people in Cluj in an afternoon.
- **The screen already logs contact taps** (`recordTrainerContact`, by channel). You can measure taps per view before and after the change instead of guessing.
- **Trainers are buyers too.** The page is your pitch during each sit-down, so a page a trainer is proud of helps recruiting.
- **You need consent for the photos.** Full-bleed gym photos need written permission (GDPR), including from any client in the frame.
- **Keep "de la" in the price.** B dropped it. Without it, prices that vary or go stale break the core promise.
- **The photo comes from route params.** So a deep link or web page would currently show initials.
- **Not every trainer uses WhatsApp.** The single personal button needs a fallback.

## The Recommendation

Keep the current visual system: the fonts, the green and the flat look. Don't adopt A or B whole. Rebuild only the trainer page as a hybrid:
- A's order: price second, plus a sticky price and WhatsApp bar.
- B's content: a real photo, the price as a sentence with "de la" kept, and a personal "Scrie-i lui Andrei" button.
- One new idea: a pre-filled WhatsApp message ("Bună Andrei, te-am găsit pe Salvio…"). The empty chat is the scariest moment for a shy user.
- Remove "312 vizualizări" from the client view.
- Don't publish a trainer until their photo is taken.

Then run the copy and cleanup pass. Freeze Home, Search, Map and Schedule until you have 300 clients.

How AI-ish each one looks, honestly:
- **Current: high.** Cards around everything, a mono label on each, pills, initials, generic copy, a sparkles icon and an icon tile grid. It hits most of your list of tells.
- **A: medium-high.** It's the same system rearranged, a card plus a mono label for every section, with status dots and pills. It fixes the order, not the feel.
- **B: low on paper, but only with real content.** With grey blobs or initials it would look more fake than Current.

## The One Thing to Do First

Rewrite `app/trainers/[id].tsx` as the hybrid: real photo, "de la 120 lei o ședință" as the second thing on screen, and a sticky "Scrie-i lui Andrei pe WhatsApp" bar that opens WhatsApp with the message already filled in. Then compare contact taps per view against today's numbers.
