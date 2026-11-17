import { esc } from "./publicProfilePage";
import { SALVIO_LOGO_DATA_URI } from "./posterLandingLogo";

/**
 * The trainer landing page: the "link in bio" of the Salvio videos, served at
 * the bare public host (nginx maps / to /antrenori). It tells a personal
 * trainer in Bucharest what Salvio does for them and sends them to the store.
 *
 * Copy approved on the 2026-11-18 preview, Romanian, used verbatim. Server
 * rendered, no JS. Every outbound link goes through /antrenori/go/:target so
 * store and Instagram clicks are counted (see controllers/trainerLanding.ts).
 */

export type LandingStoreTarget = "ios" | "android";
export type LandingTarget = LandingStoreTarget | "instagram";
export type LandingPosition = "top" | "bottom" | "faq" | "footer";

export const LANDING_TARGETS: readonly LandingTarget[] = ["ios", "android", "instagram"];
export const LANDING_POSITIONS: readonly LandingPosition[] = ["top", "bottom", "faq", "footer"];

export const SALVIO_INSTAGRAM_URL = "https://www.instagram.com/salviofit/";

/** Shipped in server/assets/landing and served by GET /antrenori/img/:file. */
export const LANDING_IMAGES: readonly string[] = [
  "harta.jpg",
  "sala.jpg",
  "profil.jpg",
  "rezultate-card.jpg",
];

export interface TrainerLandingData {
  /** Decides which store button is the big one. */
  platform: "ios" | "android" | "unknown";
  /** Normalised ?src= tag (ig, tt, ...), carried into every outbound link. */
  source: string | null;
  /** PUBLIC_WEB_URL, for the absolute og:image; empty leaves it out. */
  publicBaseUrl: string;
}

export const landingGoUrl = (
  target: LandingTarget,
  position: LandingPosition,
  source: string | null
): string =>
  `/antrenori/go/${target}?from=${position}` +
  (source ? `&src=${encodeURIComponent(source)}` : "");

const DOWNLOAD_ICON = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/></svg>`;

const STORE_LABEL: Record<LandingStoreTarget, string> = {
  ios: "Descarcă din App Store",
  android: "Descarcă din Google Play",
};

/** The visitor's own store first and filled; the other one outlined. */
export const storeButtons = (data: TrainerLandingData, position: LandingPosition): string => {
  const order: LandingStoreTarget[] =
    data.platform === "android" ? ["android", "ios"] : ["ios", "android"];
  const links = order
    .map(
      (target, i) =>
        `<a class="store ${i === 0 ? "primary" : "secondary"}" href="${esc(
          landingGoUrl(target, position, data.source)
        )}">${DOWNLOAD_ICON}<span>${STORE_LABEL[target]}</span></a>`
    )
    .join("\n");
  return `<div class="stores">\n${links}\n</div>`;
};

const DESCRIPTION =
  "Apari pe harta sălii tale din București cu ce faci și cât ceri. Plătești doar după primul client adus de Salvio.";

const pageCss = `
html, body { margin: 0; }
img { max-width: 100%; }
/* Layout: a dark hero (the gym map in a phone) over a light "sheet" that rises
   like the app's bottom sheet; one reading column, phone-first. Single look by
   design: it mirrors the Salvio poster and trainer pages, not the viewer theme. */
:root {
  --ink: #141719;
  --ink-card: #1D2225;
  --ink-line: #2C3337;
  --on-ink: #F4F7F6;
  --on-ink-muted: #B9C0C3;
  --on-ink-label: #9AA4A9;
  --green: #00A970;
  --green-bright: #00BC89;
  --green-ink: #052317;
  --sheet: #F4F7F6;
  --paper: #FFFFFF;
  --text: #1B2124;
  --text-muted: #4A5357;
  --text-faint: #5E686D;
  --line: #DCE1DF;
  --font-display: "Archivo", "Arial Narrow", sans-serif;
  --font-body: "Manrope", "Segoe UI", system-ui, sans-serif;
  --font-mono: "IBM Plex Mono", ui-monospace, monospace;
  --gutter-l: max(16px, env(safe-area-inset-left, 0px));
  --gutter-r: max(16px, env(safe-area-inset-right, 0px));
}
html, body { background: var(--ink); }
body {
  font-family: var(--font-body);
  color: var(--text);
  font-size: 16px;
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
}
a { color: inherit; }
a:focus-visible, .store:focus-visible { outline: 3px solid var(--green-bright); outline-offset: 3px; }
img { display: block; }

/* ---------- shared type ---------- */
.label {
  font-family: var(--font-mono);
  font-weight: 500;
  font-size: 11.5px;
  letter-spacing: .09em;
  text-transform: uppercase;
}
.display {
  margin: 0;
  font-family: var(--font-display);
  font-stretch: 75%;
  font-weight: 800;
  line-height: .94;
  letter-spacing: -.01em;
  text-transform: uppercase;
  text-wrap: balance;
}
h2.display { font-size: clamp(30px, 7.4vw, 44px); }
.accent { color: var(--green); }

/* ---------- hero ---------- */
.hero { color: var(--on-ink); }
.hero-inner {
  max-width: 1040px;
  margin: 0 auto;
  padding-block: 20px 52px;
  padding-left: var(--gutter-l);
  padding-right: var(--gutter-r);
  display: grid;
  gap: 36px;
}
.bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.brand { display: flex; align-items: center; gap: 10px; }
.brand img { width: 30px; height: 30px; border-radius: 8px; }
.brand span { font-family: var(--font-display); font-weight: 800; font-size: 16px; letter-spacing: .06em; }
.city { color: var(--on-ink-label); display: flex; align-items: center; gap: 8px; }
.city::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: var(--green-bright); }
.hero-copy { display: grid; gap: 20px; align-content: start; min-width: 0; }
.hero-copy .label { color: var(--on-ink-label); }
.hero h1 { font-size: clamp(42px, 11.5vw, 72px); }
.hero h1 .accent { color: var(--green-bright); }
.lead { margin: 0; font-size: 17px; line-height: 1.55; color: var(--on-ink-muted); max-width: 34em; }
.stores { display: flex; flex-wrap: wrap; gap: 10px; }
.store {
  display: inline-flex; align-items: center; gap: 10px;
  min-height: 54px; padding: 0 20px; border-radius: 14px;
  font-weight: 700; font-size: 16px; text-decoration: none;
  flex: 1 1 210px; justify-content: center;
}
.store svg { flex: 0 0 20px; }
.store.primary { background: var(--green-bright); color: var(--green-ink); }
.store.secondary { background: transparent; color: var(--on-ink); border: 1.5px solid var(--ink-line); }
.terms { display: flex; flex-wrap: wrap; gap: 6px 14px; color: var(--on-ink-label); margin: 0; padding: 0; list-style: none; }
.terms li { display: flex; align-items: center; gap: 8px; }
.terms li + li::before { content: ""; width: 4px; height: 4px; border-radius: 50%; background: var(--ink-line); }

.phones { position: relative; display: flex; justify-content: center; padding: 10px 0 0; min-width: 0; }
.phone {
  position: relative;
  width: min(270px, 62vw);
  border-radius: 36px;
  border: 9px solid #0B0D0E;
  background: #0B0D0E;
  overflow: hidden;
  box-shadow: 0 30px 60px rgba(0,0,0,.45), 0 0 0 1px #2C3337;
}
.phone img { width: 100%; height: auto; }
.phones .back {
  position: absolute;
  width: min(220px, 50vw);
  left: calc(50% - min(250px, 56vw));
  top: 46px;
  transform: rotate(-7deg);
  opacity: .78;
}
.phones .front { transform: translateX(min(40px, 8vw)); }
.pin {
  position: absolute; z-index: 2;
  right: calc(50% - min(200px, 46vw));
  bottom: 22%;
  background: var(--paper); color: var(--text);
  border-radius: 14px; padding: 10px 14px;
  box-shadow: 0 12px 30px rgba(0,0,0,.35);
  display: grid; gap: 2px;
}
.pin .label { color: var(--text-faint); font-size: 10px; }
.pin b { font-family: var(--font-display); font-stretch: 75%; font-size: 22px; line-height: 1; text-transform: uppercase; }
.pin b i { font-style: normal; color: var(--green); }

@media (min-width: 860px) {
  .hero-inner { grid-template-columns: 1.1fr .9fr; align-items: center; column-gap: 48px; }
  .bar { grid-column: 1 / -1; }
  .phones { padding-top: 0; }
}

/* ---------- sheet ---------- */
.sheet { background: var(--sheet); border-radius: 28px 28px 0 0; }
.sheet-inner {
  max-width: 680px;
  margin: 0 auto;
  padding-block: 48px 64px;
  padding-left: var(--gutter-l);
  padding-right: var(--gutter-r);
  display: grid;
  gap: 64px;
}
section { display: grid; gap: 20px; min-width: 0; }
section > .label { color: var(--text-faint); }
section p { margin: 0; }
.body { color: var(--text-muted); max-width: 36em; }

/* three things */
.three { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--line); }
.three li {
  display: grid; grid-template-columns: 112px 1fr; gap: 16px;
  padding: 18px 0; border-bottom: 1px solid var(--line);
}
.three h3 {
  margin: 0; font-family: var(--font-display); font-stretch: 75%; font-weight: 800;
  font-size: 24px; line-height: 1; text-transform: uppercase;
}
.three p { color: var(--text-muted); }
.kicker { font-weight: 700; color: var(--text); }

/* results */
.shots { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; align-items: start; }
.shots figure { margin: 0; display: grid; gap: 10px; min-width: 0; }
.shots figcaption { color: var(--text-faint); }
.shot-phone { border-radius: 26px; border: 7px solid #0B0D0E; overflow: hidden; background: #0B0D0E; box-shadow: 0 16px 34px rgba(20,23,25,.18); }
.shot-card { border-radius: 18px; overflow: hidden; background: #111827; box-shadow: 0 16px 34px rgba(20,23,25,.18); }
.shot-phone img, .shot-card img { width: 100%; height: auto; }

/* day-one tools */
.tools { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }
.tools li {
  background: var(--paper); border: 1px solid var(--line); border-radius: 16px;
  padding: 16px 18px; display: grid; grid-template-columns: 24px 1fr; gap: 14px; align-items: start;
}
.tools svg { color: var(--green); margin-top: 2px; }
.tools b { display: block; margin-bottom: 2px; }
.tools p { color: var(--text-muted); font-size: 15px; }
/* steps */
.steps { list-style: none; margin: 0; padding: 0; display: grid; gap: 0; counter-reset: step; }
.steps li {
  counter-increment: step;
  display: grid; grid-template-columns: 44px 1fr; gap: 14px; padding: 16px 0;
  border-bottom: 1px solid var(--line);
}
.steps li::before {
  content: counter(step);
  font-family: var(--font-display); font-stretch: 75%; font-weight: 800; font-size: 34px; line-height: .9;
  color: var(--green);
}
.steps li:first-child { border-top: 1px solid var(--line); }
.note { color: var(--text-faint); font-size: 14.5px; }

/* faq */
.faq { margin: 0; display: grid; gap: 0; }
.faq div { padding: 16px 0; border-bottom: 1px solid var(--line); display: grid; gap: 4px; }
.faq div:first-child { border-top: 1px solid var(--line); }
.faq dt { font-weight: 700; }
.faq dd { margin: 0; color: var(--text-muted); }
.ig { font-family: var(--font-mono); font-weight: 500; color: var(--text); }
.price { color: var(--text); white-space: nowrap; }

/* final */
.final { background: var(--ink); color: var(--on-ink); }
.final-inner {
  max-width: 680px; margin: 0 auto;
  padding-block: 56px 28px;
  padding-left: var(--gutter-l);
  padding-right: var(--gutter-r);
  display: grid; gap: 22px;
}
.final h2 { font-size: clamp(34px, 8.6vw, 52px); }
.final h2 .accent { color: var(--green-bright); }
.foot {
  margin-top: 26px; padding-top: 18px; border-top: 1px solid var(--ink-line);
  display: flex; flex-wrap: wrap; justify-content: space-between; gap: 6px 14px; color: var(--on-ink-label);
}

@media (max-width: 420px) {
  .three li { grid-template-columns: 1fr; gap: 6px; }
}
@media (prefers-reduced-motion: no-preference) {
  .phones .front { animation: rise .7s cubic-bezier(.2,.7,.2,1) both; }
  .pin { animation: rise .7s .25s cubic-bezier(.2,.7,.2,1) both; }
  @keyframes rise { from { transform: translate(var(--tx, 0), 14px); } }
  .phones .front { --tx: min(40px, 8vw); }
}
`;

export const renderTrainerLanding = (data: TrainerLandingData): string => {
  const ogImage = data.publicBaseUrl
    ? `<meta property="og:image" content="${esc(`${data.publicBaseUrl}/antrenori/img/sala.jpg`)}">`
    : "";
  return `<!DOCTYPE html>
<html lang="ro">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Salvio pentru antrenori</title>
<meta name="description" content="${DESCRIPTION}">
<meta property="og:title" content="Fii primul antrenor din sala ta pe care îl văd membrii">
<meta property="og:description" content="${DESCRIPTION}">
<meta property="og:type" content="website">
${ogImage}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@75,700;75,800&family=IBM+Plex+Mono:wght@500&family=Manrope:wght@400;500;600;700&display=swap">
<style>${pageCss}</style>
</head>
<body>
<header class="hero">
  <div class="hero-inner">
    <div class="bar">
      <div class="brand"><img src="${SALVIO_LOGO_DATA_URI}" alt="" width="30" height="30"><span>SALVIO</span></div>
      <span class="label city">București</span>
    </div>

    <div class="hero-copy">
      <span class="label">Pentru antrenorii personali</span>
      <h1 class="display">Fii <span class="accent">primul</span> antrenor din sala ta pe care îl văd membrii</h1>
      <p class="lead">Salvio e harta sălilor din București: ce antrenori lucrează în fiecare sală, cu ce se ocupă și cât cer. Îți faci profilul în aplicație și apari pe harta sălii tale.</p>
${storeButtons(data, "top")}
      <ul class="terms label">
        <li>Plătești doar după primul client adus de Salvio</li>
        <li>Fără card</li>
        <li>Fără comision</li>
      </ul>
    </div>

    <div class="phones" aria-label="Capturi din aplicație: harta sălilor și sala World Class București at The Grand cu antrenorii de acolo">
      <div class="phone back"><img src="/antrenori/img/harta.jpg" alt="" width="600" height="1232"></div>
      <div class="phone front"><img src="/antrenori/img/sala.jpg" alt="" width="600" height="1232"></div>
      <div class="pin"><span class="label">Antrenori aici</span><b>Tu, <i>primul</i></b></div>
    </div>
  </div>
</header>

<main class="sheet">
  <div class="sheet-inner">

    <section>
      <span class="label">Ce caută un client</span>
      <h2 class="display">Clientul trebuie să știe <span class="accent">3 lucruri</span> despre tine</h2>
      <ul class="three">
        <li><h3>Că exiști</h3><p>Apari pe harta sălii tale, la „Antrenori aici”. Cine caută un antrenor acolo te vede.</p></li>
        <li><h3>Ce oferi</h3><p>Specializările, certificările și rezultatele clienților tăi, toate într-un singur profil.</p></li>
        <li><h3>Cât ceri</h3><p>Tariful și pachetele se văd de la început. Nimeni nu mai trebuie să-ți scrie doar ca să afle prețul.</p></li>
      </ul>
      <p class="kicker">Pe Instagram afli asta după zeci de postări. Pe Salvio, dintr-un profil, fără să postezi nimic.</p>
    </section>

    <section>
      <span class="label">Profilul tău</span>
      <h2 class="display">Arată ce ai făcut, nu doar cum arăți</h2>
      <p class="body">Un client nu te alege după o poză de profil. Te alege după ce au reușit alții cu tine. În profil ai secțiunea „Rezultate clienți”, cu poze înainte și după, lângă certificări și specializări. Dacă oferi prima ședință gratis, apare pe profil și clienții te pot găsi după ea.</p>
      <div class="shots">
        <figure>
          <div class="shot-phone"><img src="/antrenori/img/profil.jpg" alt="Profilul unui antrenor în Salvio: specializări, de la 50 lei o ședință, prima ședință gratis și trei pachete cu prețuri" width="600" height="1232"></div>
          <figcaption class="label">Tarif și pachete</figcaption>
        </figure>
        <figure>
          <div class="shot-card"><img src="/antrenori/img/rezultate-card.jpg" alt="Rezultate clienți: două poze, înainte și după, cu textul +20 kg în 3 ani" width="600" height="500"></div>
          <figcaption class="label">Rezultate clienți</figcaption>
        </figure>
      </div>
    </section>

    <section>
      <span class="label">Din prima zi</span>
      <h2 class="display">Te ajută chiar dacă nu vine niciun client nou</h2>
      <ul class="tools">
        <li>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
          <div><b>Programul săptămânii</b><p>Îți vezi săptămâna dintr-o privire și îți pui clienții pe ore.</p></div>
        </li>
        <li>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 8 12 3 3 8v8l9 5 9-5Z"/><path d="m3 8 9 5 9-5M12 13v8"/></svg>
          <div><b>Pachetele de ședințe</b><p>Știi câte ședințe mai are fiecare client. Dacă o ședință se anulează, revine în pachet.</p></div>
        </li>
        <li>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/></svg>
          <div><b>Recenzii adevărate</b><p>Clienții tăi se conectează cu codul tău și îți pot lăsa recenzie. Doar ei pot.</p></div>
        </li>
      </ul>
    </section>

    <section>
      <span class="label">Cum începi</span>
      <h2 class="display">Trei pași până pe harta sălii tale</h2>
      <ol class="steps">
        <li><p>Descarci Salvio și îți faci cont.</p></li>
        <li><p>Apeși „Devino antrenor” și completezi tariful, specializările, pozele și rezultatele clienților.</p></li>
        <li><p>Alegi sălile unde antrenezi, din „Sălile mele”, și apari pe harta lor.</p></li>
      </ol>
      <p class="note">Sala ta nu e pe hartă? Apeși „Solicită o sală” și o adaug eu.</p>
    </section>

    <section>
      <span class="label">Întrebări</span>
      <h2 class="display">Ce te întreabă alți antrenori</h2>
      <dl class="faq">
        <div><dt>Cât costă?</dt><dd>Nimic, până când Salvio îți aduce primul client. Din acel moment mai ai 30 de zile gratuite, apoi abonamentul e <b class="price">49,99 lei pe lună</b>, mai puțin decât o ședință. Dacă te contactează 15 persoane prin Salvio, abonamentul începe oricum, cu aceeași lună de preaviz. Nu-ți cer card și, când se termină perioada gratuită, nu ești taxat automat: îți scriu înainte și decizi tu.</dd></div>
        <div><dt>Iei comision din ședințe?</dt><dd>Nu. Banii îi primești direct de la client. Salvio nu intermediază plata ședințelor.</dd></div>
        <div><dt>Cum mă contactează clienții?</dt><dd>Pe WhatsApp sau Instagram, direct din profilul tău.</dd></div>
        <div><dt>Trebuie să postez sau să am mulți urmăritori?</dt><dd>Nu. Profilul arată ce faci, cât ceri și unde antrenezi.</dd></div>
        <div><dt>Clienții mei de acum trebuie să-și facă cont?</dt><dd>Nu e obligatoriu. Dacă vor, le dai codul tău și își văd ședințele în aplicație.</dd></div>
        <div><dt>Dacă nu-mi place?</dt><dd>Îți ștergi contul oricând, din profil.</dd></div>
      </dl>
      <p class="note">Altă întrebare? Scrie-ne pe Instagram la <a class="ig" href="${esc(landingGoUrl("instagram", "faq", data.source))}">@salviofit</a>.</p>
    </section>

  </div>
</main>

<footer class="final">
  <div class="final-inner">
    <h2 class="display">Când membrii sălii tale deschid Salvio, fii <span class="accent">primul</span> pe care îl văd</h2>
${storeButtons(data, "bottom")}
    <ul class="terms label">
      <li>Plătești doar după primul client adus de Salvio</li>
      <li>Fără card</li>
      <li>Fără comision</li>
    </ul>
    <div class="foot label"><span>Salvio · București</span><a href="${esc(landingGoUrl("instagram", "footer", data.source))}">@salviofit</a></div>
  </div>
</footer>
</body>
</html>`;
};
