import { esc } from "./publicProfilePage";
import { SALVIO_LOGO_DATA_URI } from "./posterLandingLogo";

/**
 * The QR poster landing page: a trainer scans a sticker or poster in a gym.
 * The ask is a WhatsApp message to Robi, who builds the profile for them.
 *
 * Visual spec and copy: the "qr-landing-handoff" design (design.html /
 * README.md). Copy is final Romanian, used verbatim. Server-rendered, no JS.
 */

/** How many trainers a gym's map needs before it is shown to members. */
export const MAP_TARGET = 6;

/** Stands in for the gym name when the poster is not linked to a gym. */
const UNKNOWN_GYM = "sala ta";

export interface PosterLandingData {
  /** Gym display name, or null when the poster resolves to no gym. */
  gymName: string | null;
  /** Visible trainers linked to the gym. Ignored when gymName is null. */
  trainerCount: number;
  /** Digits only, no "+": wa.me rejects anything else. */
  whatsappNumber: string | null;
  /** The counted store redirect (/p/:code/start): App Store on iOS, Play otherwise. */
  startUrl: string;
}

export const trainerCountHtml = (count: number): string => {
  if (count <= 0) {
    return `<div class="count count-empty">Încă nu e nimeni pe hartă. Poți fi primul.</div>`;
  }
  if (count >= MAP_TARGET) {
    return `<div class="count"><b>${count}</b> antrenori pe hartă</div>`;
  }
  const noun = count === 1 ? "antrenor" : "antrenori";
  return `<div class="count"><b>${count}</b> ${noun} din ${MAP_TARGET}</div>`;
};

export const whatsappUrl = (number: string | null, gymName: string | null): string => {
  const text = gymName ? `Salut, sunt antrenor la ${gymName}` : "Salut, sunt antrenor";
  // With no number configured wa.me still opens WhatsApp with the text, and the
  // trainer picks the contact. Worse than a direct chat, better than a dead button.
  return `https://wa.me/${number ?? ""}?text=${encodeURIComponent(text)}`;
};

/** A long gym name would push the headline to five lines on a 320px screen. */
const headlineSize = (gymName: string): string => {
  if (gymName.length > 28) return "34px";
  if (gymName.length > 16) return "38px";
  return "44px";
};

const ICON_ATTRS =
  'width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"';

const ICONS = {
  download: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/></svg>`,
  chat: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>`,
  tag: `<svg ${ICON_ATTRS}><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r="0.5"/></svg>`,
  calendarCheck: `<svg ${ICON_ATTRS}><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M9 16l2 2 4-4"/></svg>`,
} as const;

const pageCss = `
:root{
  --ink-dark:#141719;--card-dark:#1D2225;--card-dark-line:#2C3337;--seg-off:#343C40;
  --text-on-dark:#F4F7F6;--muted-on-dark:#B9C0C3;--label-on-dark:#9AA4A9;
  --green:#00A970;--green-bright:#00BC89;--green-ink:#052317;
  --sheet:#F4F7F6;--text:#1B2124;--text-muted:#4A5357;--text-faint:#5E686D;
  --line:#DCE1DF;--input-line:#C9D0CD;--white:#FFFFFF;--error:#B42318;
  --font-display:"Archivo","Arial Narrow",sans-serif;
  --font-body:"Manrope","Segoe UI",system-ui,sans-serif;
  --font-mono:"IBM Plex Mono",ui-monospace,monospace;
}
*{box-sizing:border-box}
html,body{margin:0;background:var(--ink-dark)}
body{font-family:var(--font-body);color:var(--text);-webkit-font-smoothing:antialiased}
.page{max-width:480px;min-height:100vh;margin:0 auto;display:flex;flex-direction:column;background:var(--ink-dark)}
.top{padding:22px 20px 28px;display:flex;flex-direction:column;gap:18px;color:var(--text-on-dark)}
.brand{display:flex;align-items:center;gap:10px}
.brand img{width:30px;height:30px;border-radius:7px;display:block}
.brand span{font-family:var(--font-display);font-weight:800;font-size:16px;letter-spacing:.04em}
h1{margin:0;font-family:var(--font-display);font-stretch:75%;font-weight:800;line-height:.94;letter-spacing:-.01em;text-transform:uppercase;overflow-wrap:break-word}
h1 .gym{color:var(--green-bright)}
.lead{margin:0;font-size:15px;line-height:1.55;color:var(--muted-on-dark)}
.honest{margin:0;font-size:15px;line-height:1.5;font-weight:700}
.counter{background:var(--card-dark);border:1px solid var(--card-dark-line);border-radius:20px;padding:18px;display:flex;flex-direction:column;gap:12px}
.label{font-family:var(--font-mono);font-weight:500;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--label-on-dark)}
.count{font-family:var(--font-display);font-stretch:75%;font-weight:800;font-size:34px;line-height:1}
.count-empty{font-size:30px}
.count b{color:var(--green-bright);font-weight:800}
.segments{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:6px}
.segments i{height:6px;border-radius:3px;background:var(--seg-off);display:block}
.segments i.on{background:var(--green-bright)}
.counter p{margin:0;font-size:13.5px;line-height:1.45;color:var(--muted-on-dark)}
.sheet{flex-grow:1;background:var(--sheet);border-radius:24px 24px 0 0;padding:26px 20px 24px;display:flex;flex-direction:column;gap:16px}
.free{margin:0;font-size:16px;line-height:1.5;font-weight:700;color:var(--ink-dark)}
.cta{display:flex;align-items:center;justify-content:center;gap:10px;min-height:56px;border-radius:14px;background:var(--ink-dark);color:var(--text-on-dark);font-weight:700;font-size:17px;text-decoration:none}
.store{display:flex;align-items:center;justify-content:center;gap:10px;min-height:52px;border-radius:14px;background:var(--green);color:var(--green-ink);font-weight:700;font-size:16px;text-decoration:none}
.cta:focus-visible,.store:focus-visible{outline:3px solid rgba(0,169,112,.35);outline-offset:2px}
.under{margin:0;font-size:14px;line-height:1.45;color:var(--text-muted);text-align:center}
.me{display:flex;align-items:center;gap:12px;padding-block:4px}
.me .avatar{flex:0 0 40px;height:40px;border-radius:50%;background:var(--ink-dark);color:var(--green-bright);display:flex;align-items:center;justify-content:center;font-family:var(--font-display);font-stretch:75%;font-weight:800;font-size:20px}
.me p{margin:0;font-size:14px;line-height:1.4}
.points{list-style:none;margin:0;padding:16px 0 0;border-top:1px solid var(--line);display:flex;flex-direction:column;gap:12px}
.points li{display:flex;gap:12px;align-items:flex-start;font-size:14px;line-height:1.45}
.points svg{flex:0 0 20px;margin-top:1px;color:var(--text)}
.foot{margin-top:auto;display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px 12px;font-family:var(--font-mono);font-weight:500;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--text-faint)}
`;

const counterBlock = (gym: string, trainers: number): string => {
  const filled = Math.min(Math.max(trainers, 0), MAP_TARGET);
  const segments = Array.from({ length: MAP_TARGET }, (_, i) =>
    i < filled ? `<i class="on"></i>` : `<i></i>`
  ).join("");
  const status =
    trainers >= MAP_TARGET
      ? "Harta e gata. O arăt acum membrilor sălii."
      : `Când suntem ${MAP_TARGET}, încep s-o arăt membrilor sălii.`;

  return `
    <div class="counter">
      <div class="label">Harta ${esc(gym)}</div>
      ${trainerCountHtml(trainers)}
      <div class="segments" aria-hidden="true">${segments}</div>
      <p>${status}</p>
    </div>`;
};

export const renderPosterLanding = (data: PosterLandingData): string => {
  const knownGym = data.gymName?.trim() ? data.gymName.trim() : null;
  const gym = knownGym ?? UNKNOWN_GYM;

  return `<!DOCTYPE html>
<html lang="ro">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
<meta name="description" content="Salvio e harta sălii tale: ce antrenori lucrează aici, cu ce se ocupă și cât cer.">
<title>Salvio · Ești antrenor la ${esc(gym)}?</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@75,700;75,800&family=IBM+Plex+Mono:wght@500&family=Manrope:wght@400;500;600;700&display=swap">
<style>${pageCss}</style>
</head>
<body>
<main class="page">

  <section class="top">
    <div class="brand"><img src="${SALVIO_LOGO_DATA_URI}" alt="Salvio" width="30" height="30"><span>SALVIO</span></div>

    <h1 style="font-size:${headlineSize(gym)}">Ești antrenor la <span class="gym">${esc(gym)}</span>?</h1>

    <p class="lead">Salvio e harta sălii tale: ce antrenori lucrează aici, cu ce se ocupă și cât cer. Cine e prea timid să te abordeze pe podea te poate găsi acolo.</p>

    <p class="honest">Aplicația e nouă. N-are încă clienți și nu-ți promit cereri.</p>
${knownGym ? counterBlock(knownGym, data.trainerCount) : ""}
    <a class="store" href="${esc(data.startUrl)}">${ICONS.download}<span>Descarcă aplicația</span></a>
  </section>

  <section class="sheet">
    <!-- TODO(billing): billing does not start on first client contact yet, and
         the trigger (logging contact-button taps in the app) is not built. -->
    <p class="free">Nu plătești nimic până nu te contactează primul client prin Salvio. Dacă nu-ți place, ștergi contul.</p>

    <a class="cta" href="${esc(whatsappUrl(data.whatsappNumber, knownGym))}">${ICONS.chat}<span>Scrie-mi pe WhatsApp</span></a>

    <!-- TODO(admin-profiles): no admin route can create a trainer profile on
         someone's behalf yet; until one exists this is done by hand. -->
    <p class="under">Îți fac eu profilul. Îmi trimiți două poze și tariful, restul e treaba mea.</p>

    <div class="me">
      <div class="avatar" aria-hidden="true">R</div>
      <p>Sunt Robi, am fost antrenor. Îți răspund eu, personal.</p>
    </div>

    <ul class="points">
      <li>${ICONS.tag}<span>Tariful îl stabilești tu și se vede de la început.</span></li>
      <li>${ICONS.calendarCheck}<span>Îți programezi clienții de acum și vezi câte ședințe mai are fiecare. Merge din prima zi.</span></li>
    </ul>

    <div class="foot"><span>@salvio</span><span>Gratuit în App Store și Google Play</span></div>
  </section>

</main>
</body>
</html>`;
};
