/**
 * Server-rendered public trainer page — the link a trainer puts in their
 * Instagram bio, and the app's only indexable surface.
 *
 * Everything interpolated here is user input: names, bios, city, gym names,
 * specializations. It is escaped on the way in, without exception. There is no
 * template engine in this project to do it for us, so `esc` is the only thing
 * between a trainer's bio and stored XSS on a public page.
 */

export interface PublicProfileData {
  slug: string;
  fullName: string;
  photoUrl?: string | null;
  bio?: string | null;
  city?: string | null;
  experienceYears?: number | null;
  rating: number;
  reviewCount: number;
  specializations: string[];
  gyms: { name: string; city?: string | null }[];
  /** Public image URLs in display order; empty or absent hides the section. */
  galleryImages?: string[];
  credentialImages?: string[];
  priceLabel?: string | null;
  instagramUrl?: string | null;
  whatsappUrl?: string | null;
}

export interface PageOptions {
  /** Absolute base URL, e.g. https://salvio.ro — no trailing slash. */
  baseUrl: string;
  /**
   * Both store listings are rendered rather than one chosen from the
   * User-Agent: this page is served with Cache-Control: public, so a response
   * built for an iPhone would then be handed to an Android visitor. Detecting
   * server-side would need Vary: User-Agent, which throws the cache away.
   */
  appleStoreUrl?: string;
  playStoreUrl?: string;
}

/** HTML-escapes text. Covers the attribute-context characters too. */
export const esc = (value: unknown): string =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/**
 * Only http(s) URLs are allowed through into href/src. Blocks javascript: and
 * data: payloads that a trainer could otherwise store in their social links.
 */
export const safeUrl = (value: unknown): string | null => {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
};

const truncate = (value: string, max: number): string =>
  value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`;

export const renderPublicProfile = (
  data: PublicProfileData,
  options: PageOptions
): string => {
  // Omitted entirely when no public base URL is configured: a relative canonical
  // or og:url is worse than none — crawlers need absolute URLs, and a wrong one
  // tells them the page lives somewhere it doesn't.
  const canonical = options.baseUrl
    ? `${options.baseUrl}/t/${encodeURIComponent(data.slug)}`
    : null;
  const photo = safeUrl(data.photoUrl);
  const instagram = safeUrl(data.instagramUrl);
  const whatsapp = safeUrl(data.whatsappUrl);
  const appleUrl = safeUrl(options.appleStoreUrl);
  const playUrl = safeUrl(options.playStoreUrl);

  const subtitle = [
    data.experienceYears && data.experienceYears > 0
      ? `${data.experienceYears} ani experiență`
      : null,
    data.city,
  ]
    .filter(Boolean)
    .join(" · ");

  // Kept short: this is the snippet in search results and link previews.
  const description = truncate(
    data.bio?.trim() ||
      `Antrenor personal${data.city ? ` în ${data.city}` : ""} pe Salvio.`,
    155
  );

  return `<!DOCTYPE html>
<html lang="ro">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(data.fullName)} — Antrenor personal${data.city ? ` în ${esc(data.city)}` : ""} | Salvio</title>
<meta name="description" content="${esc(description)}">
${canonical ? `<link rel="canonical" href="${esc(canonical)}">` : ""}
<meta property="og:type" content="profile">
<meta property="og:title" content="${esc(data.fullName)} — Antrenor personal">
<meta property="og:description" content="${esc(description)}">
${canonical ? `<meta property="og:url" content="${esc(canonical)}">` : ""}
${photo ? `<meta property="og:image" content="${esc(photo)}">` : ""}
<meta name="twitter:card" content="${photo ? "summary_large_image" : "summary"}">
<style>
:root{--green:#10B981;--dark:#0F172A;--muted:#64748B;--line:#EEF2F6;--bg:#F8FAFC}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;background:var(--bg);color:var(--dark);line-height:1.5}
.wrap{max-width:560px;margin:0 auto;background:#fff;min-height:100vh}
.hero{height:min(52vw,300px);background:linear-gradient(135deg,#10B981,#059669);position:relative;overflow:hidden}
.hero img{width:100%;height:100%;object-fit:cover;display:block}
.hero .initials{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:56px;font-weight:800}
.sheet{background:#fff;border-radius:26px 26px 0 0;margin-top:-26px;position:relative;padding:22px 18px 40px}
h1{font-size:24px;font-weight:800;letter-spacing:-.4px}
.sub{color:var(--muted);font-size:14px;margin-top:5px}
.rating{margin-top:10px;font-size:14px}
.rating b{font-weight:800}.rating span{color:var(--muted)}
hr{border:0;height:1px;background:var(--line);margin:20px 0}
h2{font-size:15px;font-weight:800;margin-bottom:10px}
.chips{display:flex;flex-wrap:wrap;gap:8px}
.chip{background:#F1F5F9;color:#334155;font-size:12.5px;font-weight:600;padding:7px 13px;border-radius:999px}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.grid img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:12px;display:block;background:#F1F5F9}
p.bio{color:var(--muted);font-size:14px;white-space:pre-wrap}
ul{list-style:none}
li{padding:10px 0;border-bottom:1px solid var(--line);font-size:14px}
li:last-child{border-bottom:0}
li span{display:block;color:var(--muted);font-size:12px;margin-top:2px}
.cta{display:block;text-align:center;background:linear-gradient(135deg,#10B981,#059669);color:#fff;text-decoration:none;font-weight:700;padding:15px;border-radius:999px;margin-top:22px}
.cta.alt{background:#fff;color:var(--dark);border:1px solid #E2E8F0}
.foot{text-align:center;color:var(--muted);font-size:12px;padding:22px 18px 34px}
.foot a{color:var(--green);font-weight:600}
.foot .stores{display:inline-block;margin-top:4px}
</style>
</head>
<body>
<div class="wrap">
  <div class="hero">
    ${
      photo
        ? `<img src="${esc(photo)}" alt="${esc(data.fullName)}">`
        : `<div class="initials">${esc(initialsOf(data.fullName))}</div>`
    }
  </div>
  <main class="sheet">
    <h1>${esc(data.fullName)}</h1>
    ${subtitle ? `<p class="sub">${esc(subtitle)}</p>` : ""}
    ${
      data.reviewCount > 0
        ? `<p class="rating">★ <b>${esc(data.rating.toFixed(1))}</b> <span>(${esc(data.reviewCount)} recenzii)</span></p>`
        : ""
    }
    ${
      data.specializations.length
        ? `<hr><h2>Specializări</h2><div class="chips">${data.specializations
            .map((s) => `<span class="chip">${esc(s)}</span>`)
            .join("")}</div>`
        : ""
    }
    ${data.bio ? `<hr><h2>Despre mine</h2><p class="bio">${esc(data.bio)}</p>` : ""}
    ${data.priceLabel ? `<hr><h2>Prețuri</h2><p class="bio">${esc(data.priceLabel)}</p>` : ""}
    ${
      data.gyms.length
        ? `<hr><h2>Săli disponibile</h2><ul>${data.gyms
            .map(
              (g) =>
                `<li>${esc(g.name)}${g.city ? `<span>${esc(g.city)}</span>` : ""}</li>`
            )
            .join("")}</ul>`
        : ""
    }
    ${imageSection("Galerie", data.galleryImages)}
    ${imageSection("Certificări", data.credentialImages)}
    ${
      whatsapp
        ? `<a class="cta" href="${esc(whatsapp)}" rel="nofollow noopener">Contactează-l pe WhatsApp</a>`
        : ""
    }
    ${
      instagram
        ? `<a class="cta${whatsapp ? " alt" : ""}" href="${esc(instagram)}" rel="nofollow noopener">Vezi pe Instagram</a>`
        : ""
    }
  </main>
  <p class="foot">
    ${esc(data.fullName)} își gestionează programul pe <strong>Salvio</strong>.<br>
    Descarcă aplicația:
    ${
      appleUrl || playUrl
        ? `<span class="stores">${[
            appleUrl ? `<a href="${esc(appleUrl)}" rel="nofollow noopener">iPhone</a>` : "",
            playUrl ? `<a href="${esc(playUrl)}" rel="nofollow noopener">Android</a>` : "",
          ]
            .filter(Boolean)
            .join(" · ")}</span>`
        : "Salvio"
    }
  </p>
</div>
</body>
</html>`;
};

/**
 * Image grid for gallery / credential photos. Every URL goes through safeUrl:
 * these come from S3 today, but the column is a plain VARCHAR the trainer's
 * uploads write into, so it is treated as untrusted like every other field here.
 */
const imageSection = (title: string, urls?: string[] | null): string => {
  const safe = (urls ?? []).map(safeUrl).filter((url): url is string => Boolean(url));
  if (!safe.length) return "";
  return `<hr><h2>${esc(title)}</h2><div class="grid">${safe
    .map((url) => `<img src="${esc(url)}" alt="${esc(title)}" loading="lazy">`)
    .join("")}</div>`;
};

const initialsOf = (fullName: string): string =>
  fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?";

/** Minimal 404, same shell, so a dead link doesn't look broken. */
export const renderNotFound = (options: PageOptions): string => `<!DOCTYPE html>
<html lang="ro">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Profil inexistent | Salvio</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;background:#F8FAFC;color:#0F172A;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;text-align:center}
h1{font-size:20px;margin-bottom:8px}p{color:#64748B;font-size:14px}
a{color:#10B981}
</style>
</head>
<body>
<div>
  <h1>Profilul nu există</h1>
  <p>Linkul e greșit sau antrenorul și-a șters profilul.</p>
  ${
    safeUrl(options.appleStoreUrl) || safeUrl(options.playStoreUrl)
      ? `<p>Descarcă Salvio: ${[
          safeUrl(options.appleStoreUrl)
            ? `<a href="${esc(safeUrl(options.appleStoreUrl))}" rel="nofollow noopener">iPhone</a>`
            : "",
          safeUrl(options.playStoreUrl)
            ? `<a href="${esc(safeUrl(options.playStoreUrl))}" rel="nofollow noopener">Android</a>`
            : "",
        ]
          .filter(Boolean)
          .join(" · ")}</p>`
      : ""
  }
</div>
</body>
</html>`;
