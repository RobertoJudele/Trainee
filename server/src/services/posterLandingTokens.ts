// GENERATED — do not edit by hand.
// Verbatim concatenation of design_handoff_salvio_trainer_landing/design_files/_ds/
// salvio-design-system-c7256cd1-c1cb-43e6-b866-f51d68ed085a/tokens/, @import first. Inlined rather than served because the
// server has no static-asset route and tsc copies no .css into dist/.
// Regenerate with the command in Task 4 of
// docs/superpowers/plans/2026-09-18-poster-qr-scan-counter.md
export const POSTER_TOKENS_CSS = `/* SUBSTITUTED FONTS — no brand font files were provided. Nearest Google Fonts matches.
   Display: Archivo (variable width+weight) used at ExtraCondensed / Black.
   UI/body: Manrope.  Meta/numeric labels: IBM Plex Mono.
   Replace with real licensed files when available. */
@import url("https://fonts.googleapis.com/css2?family=Archivo:ital,wdth,wght@0,62..125,100..900&family=Manrope:wght@400..800&family=IBM+Plex+Mono:wght@400;500;600&display=swap");
:root{
  /* base — brand */
  --green-900:#064C31;--green-800:#07603D;--green-700:#0A8054;--green-600:#0F9D66;
  --green-500:#12B177;--green-400:#3AC391;--green-300:#79D9B4;--green-200:#BCEDD8;--green-100:#E7F7EF;--green-050:#F2FBF7;
  /* base — ink / neutral */
  --ink-900:#14181A;--ink-800:#1E2427;--ink-700:#333B3F;--ink-600:#4C565B;--ink-500:#6B7680;
  --ink-400:#98A1A6;--ink-300:#C3CAC9;--ink-200:#E1E5E3;--ink-100:#EEF1EF;--ink-050:#F6F8F7;--white:#FFFFFF;
  /* base — semantic hues */
  --amber-500:#E8A317;--amber-100:#FDF1D8;
  --red-500:#D8402F;--red-100:#FBE5E1;
  --blue-500:#2E6BE6;--blue-100:#E4EBFC;

  /* semantic — text */
  --text-strong:var(--ink-900);--text-body:var(--ink-700);--text-muted:var(--ink-500);
  --text-faint:var(--ink-400);--text-on-brand:var(--white);--text-on-ink:var(--white);
  --text-brand:var(--green-700);--text-danger:var(--red-500);
  /* semantic — surfaces */
  --surface-canvas:var(--ink-050);--surface-card:var(--white);--surface-sunken:var(--ink-100);
  --surface-brand:var(--green-500);--surface-brand-soft:var(--green-100);--surface-ink:var(--ink-900);
  --surface-overlay:rgba(20,24,26,.48);--surface-sheet:var(--white);
  /* semantic — lines */
  --border-subtle:var(--ink-200);--border-strong:var(--ink-300);--border-brand:var(--green-500);
  --border-focus:var(--green-600);
  /* semantic — state */
  --state-brand-hover:var(--green-600);--state-brand-press:var(--green-700);
  --state-ghost-hover:var(--ink-100);--state-ghost-press:var(--ink-200);
  --state-disabled-bg:var(--ink-100);--state-disabled-fg:var(--ink-400);
  /* semantic — status */
  --status-open:var(--green-500);--status-open-soft:var(--green-100);
  --status-busy:var(--amber-500);--status-busy-soft:var(--amber-100);
  --status-closed:var(--red-500);--status-closed-soft:var(--red-100);
  --status-info:var(--blue-500);--status-info-soft:var(--blue-100);
}
:root{
  --font-display:"Archivo","Archivo Condensed",system-ui,sans-serif;
  --font-ui:"Manrope",system-ui,-apple-system,sans-serif;
  --font-mono:"IBM Plex Mono",ui-monospace,monospace;

  --display-stretch:75%;         /* Archivo width axis for display type */
  --weight-regular:400;--weight-medium:500;--weight-semibold:600;--weight-bold:700;--weight-black:800;

  /* sizes */
  --text-3xs:10px;--text-2xs:11px;--text-xs:12px;--text-sm:13px;--text-base:15px;--text-md:17px;
  --text-lg:20px;--text-xl:24px;--text-2xl:30px;--text-3xl:38px;--text-4xl:48px;--text-5xl:64px;
  /* line heights */
  --leading-tight:0.94;--leading-snug:1.12;--leading-normal:1.35;--leading-relaxed:1.55;
  /* tracking */
  --tracking-display:-0.015em;--tracking-tight:-0.01em;--tracking-normal:0;--tracking-label:0.08em;--tracking-wide:0.14em;

  /* semantic roles */
  --type-display:var(--weight-black) var(--text-4xl)/var(--leading-tight) var(--font-display);
  --type-title:var(--weight-black) var(--text-2xl)/var(--leading-snug) var(--font-display);
  --type-heading:var(--weight-bold) var(--text-lg)/var(--leading-snug) var(--font-ui);
  --type-body:var(--weight-medium) var(--text-base)/var(--leading-relaxed) var(--font-ui);
  --type-body-sm:var(--weight-medium) var(--text-sm)/var(--leading-normal) var(--font-ui);
  --type-label:var(--weight-semibold) var(--text-2xs)/1 var(--font-mono);
  --type-price:var(--weight-semibold) var(--text-md)/1 var(--font-mono);
}
:root{
  --space-0:0;--space-1:2px;--space-2:4px;--space-3:6px;--space-4:8px;--space-5:12px;
  --space-6:16px;--space-7:20px;--space-8:24px;--space-9:32px;--space-10:40px;--space-11:56px;--space-12:72px;
  /* semantic */
  --gutter-screen:20px;      /* left/right page padding on mobile */
  --gap-stack:12px;          /* between list rows */
  --gap-section:32px;        /* between screen sections */
  --pad-card:16px;--pad-card-lg:20px;--pad-control:14px;
  --tap-min:44px;            /* minimum hit target */
}
:root{
  --radius-xs:6px;--radius-sm:10px;--radius-md:14px;--radius-lg:20px;--radius-xl:28px;--radius-pill:999px;
  --radius-control:var(--radius-md);--radius-card:var(--radius-lg);--radius-sheet:var(--radius-xl);
  --radius-avatar:var(--radius-pill);--radius-media:var(--radius-lg);
  --border-width:1px;--border-width-strong:1.5px;--focus-ring-width:3px;
}
:root{
  --shadow-none:none;
  --shadow-xs:0 1px 2px rgba(20,24,26,.05);
  --shadow-sm:0 1px 2px rgba(20,24,26,.04),0 4px 12px -6px rgba(20,24,26,.10);
  --shadow-md:0 2px 4px rgba(20,24,26,.04),0 12px 28px -10px rgba(20,24,26,.14);
  --shadow-lg:0 24px 56px -16px rgba(20,24,26,.22);
  --shadow-brand:0 8px 20px -8px rgba(18,177,119,.45);
  --shadow-inset-top:inset 0 1px 0 rgba(255,255,255,.6);
  --ring-focus:0 0 0 var(--focus-ring-width) rgba(18,177,119,.28);
  /* protection gradient for text over photography */
  --scrim-bottom:linear-gradient(180deg,rgba(20,24,26,0) 0%,rgba(20,24,26,.10) 40%,rgba(20,24,26,.78) 100%); /* @kind other */
  --scrim-top:linear-gradient(180deg,rgba(20,24,26,.55) 0%,rgba(20,24,26,0) 70%); /* @kind other */
  --blur-chrome:saturate(140%) blur(14px); /* @kind other */
}
:root{
  --ease-standard:cubic-bezier(.2,.8,.2,1); /* @kind other */
  --ease-out:cubic-bezier(.16,1,.3,1); /* @kind other */
  --ease-in:cubic-bezier(.4,0,1,1); /* @kind other */
  --duration-instant:90ms; /* @kind other */--duration-fast:140ms; /* @kind other */--duration-base:180ms; /* @kind other */--duration-slow:260ms; /* @kind other */--duration-sheet:320ms; /* @kind other */
  --press-scale:.97; /* @kind other */
  --transition-control:background-color var(--duration-fast) var(--ease-standard),color var(--duration-fast) var(--ease-standard),border-color var(--duration-fast) var(--ease-standard),transform var(--duration-instant) var(--ease-standard),box-shadow var(--duration-fast) var(--ease-standard); /* @kind other */
}
/* minimal resets consumers inherit */
*,*::before,*::after{box-sizing:border-box}
body{margin:0;background:var(--surface-canvas);color:var(--text-body);font:var(--type-body);-webkit-font-smoothing:antialiased}
h1,h2,h3,h4{margin:0;color:var(--text-strong)}
h1{font:var(--type-display);text-transform:uppercase;letter-spacing:var(--tracking-display);font-stretch:var(--display-stretch)}
h2{font:var(--type-title);text-transform:uppercase;letter-spacing:var(--tracking-display);font-stretch:var(--display-stretch)}
h3{font:var(--type-heading);letter-spacing:var(--tracking-tight)}
p{margin:0 0 var(--space-5)}
a{color:var(--text-brand);text-decoration:none;font-weight:var(--weight-semibold)}
a:hover{color:var(--green-800);text-decoration:underline;text-underline-offset:3px}
button{font:inherit}
::selection{background:var(--green-200);color:var(--ink-900)}`;
