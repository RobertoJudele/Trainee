import { esc } from "./publicProfilePage";
import type { LandingCountRow, LandingDayRow } from "./landingCounting";

/**
 * /antrenori/stats: the landing page's numbers for whoever holds
 * LANDING_STATS_KEY. Plain server-rendered tables, Romanian labels.
 */

export interface LandingSummary {
  visits: number;
  ios: number;
  android: number;
  instagram: number;
  bySource: Map<string, { visits: number; store: number }>;
  byDevice: Map<string, { visits: number; store: number }>;
  storeByPosition: Map<string, number>;
}

const bump = (
  map: Map<string, { visits: number; store: number }>,
  key: string,
  field: "visits" | "store",
  n: number
): void => {
  const entry = map.get(key) ?? { visits: 0, store: 0 };
  entry[field] += n;
  map.set(key, entry);
};

export const summarize = (rows: LandingCountRow[]): LandingSummary => {
  const summary: LandingSummary = {
    visits: 0,
    ios: 0,
    android: 0,
    instagram: 0,
    bySource: new Map(),
    byDevice: new Map(),
    storeByPosition: new Map(),
  };
  for (const row of rows) {
    if (row.kind === "visit") {
      summary.visits += row.n;
      bump(summary.bySource, row.source, "visits", row.n);
      bump(summary.byDevice, row.device, "visits", row.n);
      continue;
    }
    if (row.target === "instagram") {
      summary.instagram += row.n;
      continue;
    }
    if (row.target === "ios") summary.ios += row.n;
    if (row.target === "android") summary.android += row.n;
    bump(summary.bySource, row.source, "store", row.n);
    bump(summary.byDevice, row.device, "store", row.n);
    const position = row.position ?? "necunoscut";
    summary.storeByPosition.set(position, (summary.storeByPosition.get(position) ?? 0) + row.n);
  }
  return summary;
};

const rate = (clicks: number, visits: number): string =>
  visits > 0 ? `${Math.round((clicks / visits) * 100)}%` : "–";

const SOURCE_LABEL: Record<string, string> = {
  ig: "Instagram",
  tt: "TikTok",
  fb: "Facebook",
  direct: "Direct / fără sursă",
};
const DEVICE_LABEL: Record<string, string> = { ios: "iPhone", android: "Android", other: "Altele" };
const POSITION_LABEL: Record<string, string> = {
  top: "Butonul de sus",
  bottom: "Butonul de jos",
  necunoscut: "Necunoscut",
};

const splitTable = (
  title: string,
  map: Map<string, { visits: number; store: number }>,
  labels: Record<string, string>
): string => {
  const rows = [...map.entries()]
    .sort((a, b) => b[1].visits - a[1].visits)
    .map(
      ([key, v]) =>
        `<tr><td>${esc(labels[key] ?? key)}</td><td>${v.visits}</td><td>${v.store}</td><td>${rate(v.store, v.visits)}</td></tr>`
    )
    .join("");
  return `<h3>${title}</h3><table><thead><tr><th></th><th>Vizite</th><th>Clicuri magazin</th><th>Rată</th></tr></thead><tbody>${
    rows || `<tr><td colspan="4" class="empty">Nimic încă</td></tr>`
  }</tbody></table>`;
};

const windowBlock = (label: string, s: LandingSummary): string => {
  const store = s.ios + s.android;
  const positions = [...s.storeByPosition.entries()]
    .map(([key, n]) => `<tr><td>${esc(POSITION_LABEL[key] ?? key)}</td><td>${n}</td></tr>`)
    .join("");
  return `<section>
  <h2>${label}</h2>
  <div class="tiles">
    <div><span>Vizite</span><b>${s.visits}</b></div>
    <div><span>Clicuri magazin</span><b>${store}</b><small>${rate(store, s.visits)} din vizite</small></div>
    <div><span>App Store</span><b>${s.ios}</b></div>
    <div><span>Google Play</span><b>${s.android}</b></div>
    <div><span>Instagram</span><b>${s.instagram}</b></div>
  </div>
  ${splitTable("După sursă", s.bySource, SOURCE_LABEL)}
  ${splitTable("După telefon", s.byDevice, DEVICE_LABEL)}
  <h3>Clicuri magazin după buton</h3>
  <table><tbody>${positions || `<tr><td class="empty">Nimic încă</td></tr>`}</tbody></table>
</section>`;
};

export const renderLandingStats = (input: {
  week: LandingSummary;
  month: LandingSummary;
  daily: LandingDayRow[];
}): string => {
  const days = input.daily
    .map(
      (d) =>
        `<tr><td>${esc(d.day)}</td><td>${d.visits}</td><td>${d.storeClicks}</td><td>${rate(d.storeClicks, d.visits)}</td></tr>`
    )
    .join("");
  return `<!DOCTYPE html>
<html lang="ro">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Salvio · statistici landing page</title>
<style>
body{margin:0;background:#F4F7F6;color:#1B2124;font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:720px;margin:0 auto;padding:24px 16px 48px;display:grid;gap:32px}
h1{margin:0;font-size:22px}h2{margin:0 0 12px;font-size:18px}h3{margin:18px 0 6px;font-size:14px;color:#4A5357}
.note{margin:4px 0 0;color:#5E686D;font-size:13px}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px}
.tiles div{background:#fff;border:1px solid #DCE1DF;border-radius:12px;padding:12px;display:grid;gap:2px}
.tiles span{font-size:12px;color:#5E686D}.tiles b{font-size:26px;font-variant-numeric:tabular-nums}.tiles small{color:#00A970;font-weight:600}
table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #DCE1DF;border-radius:12px;overflow:hidden}
th,td{padding:8px 10px;text-align:left;border-bottom:1px solid #DCE1DF;font-variant-numeric:tabular-nums}
th{font-size:12px;color:#5E686D;font-weight:600}tr:last-child td{border-bottom:0}.empty{color:#5E686D}
</style>
</head>
<body>
<main>
  <header>
    <h1>Landing page antrenori</h1>
    <p class="note">Vizitele și clicurile repetate de pe aceeași adresă în 30 de minute se numără o singură dată. Roboții de preview nu se numără. Un clic pe magazin nu înseamnă o instalare.</p>
  </header>
  ${windowBlock("Ultimele 7 zile", input.week)}
  ${windowBlock("Ultimele 30 de zile", input.month)}
  <section>
    <h2>Pe zile (ultimele 14)</h2>
    <table><thead><tr><th>Zi</th><th>Vizite</th><th>Clicuri magazin</th><th>Rată</th></tr></thead><tbody>${
      days || `<tr><td colspan="4" class="empty">Nimic încă</td></tr>`
    }</tbody></table>
  </section>
</main>
</body>
</html>`;
};
