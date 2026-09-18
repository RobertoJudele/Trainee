import { esc, safeUrl } from "./publicProfilePage";
import { POSTER_TOKENS_CSS } from "./posterLandingTokens";
import { SALVIO_LOGO_DATA_URI } from "./posterLandingLogo";
import { POSTER_ICONS } from "./posterLandingIcons";

/**
 * The QR poster landing page: a trainer scans a code off a gym wall and gets
 * roughly ten seconds of attention, so the page has one CTA and no navigation.
 *
 * Visual spec: design_handoff_salvio_trainer_landing/README.md. Rebuilt rather
 * than ported — the handoff's streaming-component runtime is not shipped.
 */

export interface PosterLandingOffer {
  isOpen: boolean;
  months: number;
  deadline?: string;
}

export interface PosterLandingData {
  /** Gym name for the headline, or null for the gym-neutral fallback. */
  gymName: string | null;
  gymLogoUrl?: string | null;
  /** Where the single CTA points — the counted store redirect. */
  startUrl: string;
  offer: PosterLandingOffer;
  /** Injectable clock, so the first countdown frame is testable. */
  now?: Date;
}

const FALLBACK_CITY = "București";
/** Past this, a headline would wrap to four lines on a 360px screen. */
const LONG_GYM_NAME = 16;

const pad = (value: number): string => (value < 10 ? `0${value}` : String(value));

export const formatCountdown = (msLeft: number): string => {
  const ms = Math.max(0, msLeft);
  const days = Math.floor(ms / 864e5);
  const hours = Math.floor(ms / 36e5) % 24;
  const minutes = Math.floor(ms / 6e4) % 60;
  // Seconds are deliberately not shown: a ticking seconds digit reads as
  // pressure, which is off-register for the design system.
  return `${days}z ${pad(hours)}:${pad(minutes)}`;
};

export const formatDeadlineLabel = (deadlineIso: string): string =>
  new Intl.DateTimeFormat("ro-RO", {
    timeZone: "Europe/Bucharest",
    day: "numeric",
    month: "long",
  }).format(new Date(deadlineIso));

export const formatMonthsLabel = (months: number): string => {
  if (months === 1) return "1 lună gratis";
  // Romanian takes "de" before the noun from 20 upwards.
  return months >= 20 ? `${months} de luni gratis` : `${months} luni gratis`;
};

const pageCss = `
.wrap{min-height:100%;background:var(--ink-900);display:flex;justify-content:center}
.col{width:100%;max-width:430px;background:var(--surface-canvas);display:flex;flex-direction:column}
.hero{background:var(--ink-900);padding:16px 20px 24px;display:flex;flex-direction:column;gap:20px}
.brand{display:flex;align-items:center;gap:10px}
.brand img{width:32px;height:32px;border-radius:8px;display:block}
.brand-word{font:var(--weight-black) 17px/1 var(--font-display);font-stretch:75%;text-transform:uppercase;letter-spacing:-0.01em;color:var(--white)}
.brand-div{width:1px;height:18px;background:var(--ink-700)}
.hero h1{margin:0;font-family:var(--font-display);font-weight:var(--weight-black);line-height:0.94;font-stretch:75%;text-transform:uppercase;letter-spacing:-0.015em;color:var(--white);text-wrap:balance}
.hero h1 span{color:var(--green-400)}
.sub{margin:0;font:var(--weight-medium) 16px/1.5 var(--font-ui);color:var(--ink-300);max-width:34ch}
.offer-wrap{background:var(--ink-900);padding:0 20px 20px}
.offer{background:var(--green-500);border-radius:var(--radius-card);padding:20px;display:flex;flex-direction:column;gap:14px}
.offer-eyebrow{font:var(--type-label);letter-spacing:var(--tracking-label);text-transform:uppercase;color:var(--green-900)}
.offer-head{font:var(--weight-black) 30px/1.0 var(--font-display);font-stretch:75%;text-transform:uppercase;letter-spacing:-0.015em;color:var(--ink-900)}
.offer-row{display:flex;align-items:center;gap:10px;border-top:1px solid rgba(6,76,49,.22)}
.countdown{font:var(--weight-semibold) 22px/1 var(--font-mono);color:var(--ink-900);font-variant-numeric:tabular-nums;padding-top:12px}
.deadline{font:var(--weight-semibold) 11px/1.3 var(--font-mono);letter-spacing:var(--tracking-label);text-transform:uppercase;color:var(--green-900);padding-top:12px}
.action{background:var(--surface-canvas);padding:20px;display:flex;flex-direction:column;gap:16px;border-radius:var(--radius-xl) var(--radius-xl) 0 0;margin-top:-4px}
.cta{display:flex;align-items:center;justify-content:center;gap:8px;height:56px;border-radius:var(--radius-control);background:var(--green-500);color:var(--white);font:var(--weight-bold) 17px/1 var(--font-ui);text-decoration:none;box-shadow:var(--shadow-brand);transition:background-color var(--duration-fast) var(--ease-standard),transform var(--duration-fast) var(--ease-standard)}
.cta:hover{background:var(--green-600);color:var(--white);text-decoration:none}
.cta:active{background:var(--green-700);transform:scale(var(--press-scale))}
.cta:focus-visible{outline:none;box-shadow:var(--ring-focus)}
.explainer{margin:0;font:var(--weight-medium) 15px/1.55 var(--font-ui);color:var(--text-body)}
.proofs{display:flex;flex-direction:column;gap:12px;padding-top:4px}
.proof{display:flex;align-items:center;gap:10px;color:var(--text-body)}
.proof span{font:var(--type-body-sm);color:var(--text-body)}
.trust{background:var(--surface-canvas);padding:8px 20px 32px;display:flex;flex-direction:column;gap:12px}
.lockup{background:var(--surface-card);border:1px solid var(--border-subtle);border-radius:var(--radius-card);padding:16px;display:flex;align-items:center;gap:14px}
.lockup img{border-radius:9px;display:block;flex:none}
.lockup-div{width:1px;height:28px;background:var(--border-subtle);flex:none}
.lockup-text{display:flex;flex-direction:column;gap:3px;min-width:0}
.lockup-name{font:var(--weight-bold) 13px/1.2 var(--font-ui);color:var(--text-strong)}
.lockup-meta{font:var(--type-label);letter-spacing:var(--tracking-label);text-transform:uppercase;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bottom{display:flex;align-items:center;gap:12px;padding:0 4px}
.ig{display:flex;align-items:center;gap:6px;font:var(--weight-semibold) 13px/1 var(--font-mono);color:var(--text-muted);text-decoration:none}
.ig:hover{color:var(--green-700);text-decoration:none}
`;

/**
 * Ticks the countdown from the fixed ISO deadline in the markup — never from the
 * visitor's local midnight — and renders over a server-rendered first frame, so
 * the block never flashes empty.
 */
const countdownScript = `
(function(){
  var el=document.getElementById("poster-countdown");
  if(!el)return;
  var deadline=new Date(el.getAttribute("data-deadline")).getTime();
  if(isNaN(deadline))return;
  function pad(n){return n<10?"0"+n:""+n}
  function tick(){
    var ms=Math.max(0,deadline-Date.now());
    var d=Math.floor(ms/864e5),h=Math.floor(ms/36e5)%24,m=Math.floor(ms/6e4)%60;
    el.textContent=d+"z "+pad(h)+":"+pad(m);
  }
  tick();
  setInterval(tick,1000);
})();
`;

const offerBlock = (offer: PosterLandingOffer, now: Date): string => {
  // Closed offers drop the card rather than rendering "Închis" on a poster that
  // is still hanging on a wall.
  if (!offer.isOpen || !offer.deadline) return "";

  const msLeft = new Date(offer.deadline).getTime() - now.getTime();

  return `
  <div class="offer-wrap">
    <div class="offer">
      <span class="offer-eyebrow">OFERTA PENTRU PRIMII MEMBRII</span>
      <div class="offer-head">${esc(formatMonthsLabel(offer.months))}</div>
      <div class="offer-row">
        <div class="countdown" id="poster-countdown" data-deadline="${esc(offer.deadline)}">${esc(
    formatCountdown(msLeft)
  )}</div>
        <div class="deadline">până pe<br>${esc(formatDeadlineLabel(offer.deadline))}</div>
      </div>
    </div>
  </div>`;
};

export const renderPosterLanding = (data: PosterLandingData): string => {
  const now = data.now ?? new Date();
  const gymName = data.gymName?.trim() ? data.gymName.trim() : null;
  const headlineSize = gymName && gymName.length > LONG_GYM_NAME ? "38px" : "44px";
  const headline = gymName
    ? `Ești antrenor la <span>${esc(gymName)}</span>?`
    : `Ești antrenor în <span>${esc(FALLBACK_CITY)}</span>?`;
  const gymLogo = safeUrl(data.gymLogoUrl);
  const offer = offerBlock(data.offer, now);

  return `<!DOCTYPE html>
<html lang="ro">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Devino antrenor pe Salvio</title>
<style>${POSTER_TOKENS_CSS}
body{margin:0;background:var(--ink-900)}
${pageCss}</style>
</head>
<body>
<div class="wrap">
<div class="col">

  <div class="hero">
    <div class="brand">
      <img src="${SALVIO_LOGO_DATA_URI}" alt="Salvio" width="32" height="32">
      <span class="brand-word">Salvio</span>
      <span class="brand-div"></span>
    </div>
    <h1 style="font-size:${headlineSize}">${headline}</h1>
    <p class="sub">Nu e o listă cu 700 de nume. E harta sălii în care ești acum.</p>
  </div>
${offer}
  <div class="action">
    <a class="cta" href="${esc(data.startUrl)}">Începe în 90 de secunde ${
    POSTER_ICONS.chevronRight
  }</a>
    <p class="explainer">Clienții din sala ta te găsesc singuri: îți văd specializarea și tariful înainte să scrie un mesaj. Tu nu abordezi pe nimeni.</p>
    <div class="proofs">
      <div class="proof">${
        POSTER_ICONS.mapPin
      }<span>Apari la toate salile la care antrenezi si lasa lumea sa te cunoasca.</span></div>
      <div class="proof">${
        POSTER_ICONS.tag
      }<span>Tariful tău, stabilit de tine, vizibil de la început.</span></div>
    </div>
  </div>

  <div class="trust">
    <div class="lockup">
      <img src="${SALVIO_LOGO_DATA_URI}" alt="Salvio" width="36" height="36">
      <span class="lockup-div"></span>${
        gymLogo
          ? `\n      <img class="gym-logo" src="${esc(
              gymLogo
            )}" alt="" width="36" height="36">`
          : ""
      }
      <div class="lockup-text">
        <span class="lockup-name">Salvio</span>
        <span class="lockup-meta">${esc((gymName ?? FALLBACK_CITY).toUpperCase())}</span>
      </div>
    </div>
    <div class="bottom">
      <a class="ig" href="https://instagram.com/salvio" rel="nofollow noopener">${
        POSTER_ICONS.badgeCheck
      }@salvio</a>
    </div>
  </div>

</div>
</div>
<script>${countdownScript}</script>
</body>
</html>`;
};
