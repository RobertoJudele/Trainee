import { describe, it, expect } from "@jest/globals";
import {
  esc,
  safeUrl,
  renderPublicProfile,
  PublicProfileData,
} from "../services/publicProfilePage";

const baseData: PublicProfileData = {
  slug: "andrei-popescu",
  fullName: "Andrei Popescu",
  photoUrl: "https://cdn.example.com/a.jpg",
  bio: "Te ajut să îți atingi obiectivele.",
  city: "Cluj-Napoca",
  experienceYears: 5,
  rating: 4.8,
  reviewCount: 32,
  specializations: ["Forță", "HIIT"],
  gyms: [{ name: "World Class", city: "Cluj-Napoca" }],
  priceLabel: "De la 120 lei/ședință",
  instagramUrl: "https://instagram.com/andrei",
  whatsappUrl: "https://wa.me/40721234567",
};

const options = {
  baseUrl: "https://salvio.ro",
  appleStoreUrl: "https://apps.apple.com/app/id6775085258",
  playStoreUrl: "https://play.google.com/store/apps/details?id=com.juroctech.frontend",
};

describe("esc", () => {
  it("escapes the characters that break out of HTML and attributes", () => {
    expect(esc(`<script>`)).toBe("&lt;script&gt;");
    expect(esc(`" onload="x`)).toBe("&quot; onload=&quot;x");
    expect(esc(`'`)).toBe("&#39;");
    expect(esc(`a & b`)).toBe("a &amp; b");
  });

  it("escapes the ampersand first, so entities are not double-decoded", () => {
    expect(esc("&lt;")).toBe("&amp;lt;");
  });

  it("renders null and undefined as empty rather than the literal words", () => {
    expect(esc(null)).toBe("");
    expect(esc(undefined)).toBe("");
  });
});

describe("safeUrl", () => {
  it("passes http and https through", () => {
    expect(safeUrl("https://instagram.com/andrei")).toBe("https://instagram.com/andrei");
    expect(safeUrl("http://example.com/")).toBe("http://example.com/");
  });

  it("rejects javascript: and data: payloads", () => {
    // A trainer can type anything into their social link fields; these must never
    // reach an href.
    expect(safeUrl("javascript:alert(1)")).toBeNull();
    expect(safeUrl("data:text/html;base64,PHNjcmlwdD4=")).toBeNull();
    expect(safeUrl("JaVaScRiPt:alert(1)")).toBeNull();
  });

  it("rejects junk and empties", () => {
    expect(safeUrl("not a url")).toBeNull();
    expect(safeUrl("")).toBeNull();
    expect(safeUrl(null)).toBeNull();
  });
});

describe("renderPublicProfile", () => {
  it("renders the trainer's details", () => {
    const html = renderPublicProfile(baseData, options);
    expect(html).toContain("Andrei Popescu");
    expect(html).toContain("Cluj-Napoca");
    expect(html).toContain("5 ani experiență");
    expect(html).toContain("4.8");
    expect(html).toContain("32 recenzii");
    expect(html).toContain("Forță");
    expect(html).toContain("World Class");
    expect(html).toContain("De la 120 lei/ședință");
  });

  it("sets canonical and Open Graph tags for link previews", () => {
    const html = renderPublicProfile(baseData, options);
    expect(html).toContain('<link rel="canonical" href="https://salvio.ro/t/andrei-popescu">');
    expect(html).toContain('property="og:title"');
    expect(html).toContain('content="https://cdn.example.com/a.jpg"');
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
  });

  it("offers both stores, since the page is cached and cannot sniff the platform", () => {
    // A response built for an iPhone gets served to the next Android visitor,
    // so one link chosen from the User-Agent would be wrong half the time.
    const html = renderPublicProfile(baseData, options);
    expect(html).toContain("Descarcă aplicația");
    expect(html).toContain("apps.apple.com");
    expect(html).toContain("play.google.com");
  });

  it("renders only the store that is configured", () => {
    const appleOnly = renderPublicProfile(baseData, {
      baseUrl: "https://salvio.ro",
      appleStoreUrl: "https://apps.apple.com/app/id6775085258",
    });
    expect(appleOnly).toContain("apps.apple.com");
    expect(appleOnly).not.toContain("play.google.com");
  });

  it("omits canonical and og:url when no public domain is configured", () => {
    // Before a consumer domain exists PUBLIC_WEB_URL is unset. A relative
    // canonical would point crawlers at the wrong host.
    const html = renderPublicProfile(baseData, { baseUrl: "" });
    expect(html).not.toContain("rel=\"canonical\"");
    expect(html).not.toContain("og:url");
    expect(html).toContain("Andrei Popescu");
  });

  it("escapes a bio containing a script tag", () => {
    const html = renderPublicProfile(
      { ...baseData, bio: "<script>alert('xss')</script>" },
      options
    );
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapes a name that tries to break out of the title attribute", () => {
    const html = renderPublicProfile(
      { ...baseData, fullName: `x" onerror="alert(1)` },
      options
    );
    expect(html).not.toContain(`onerror="alert(1)"`);
    expect(html).toContain("&quot;");
  });

  it("escapes specialization and gym names too", () => {
    const html = renderPublicProfile(
      {
        ...baseData,
        specializations: ["<img src=x onerror=alert(1)>"],
        gyms: [{ name: "<b>Gym</b>", city: "<i>Cluj</i>" }],
      },
      options
    );
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<b>Gym</b>");
    expect(html).toContain("&lt;img");
  });

  it("drops a javascript: social link instead of rendering it", () => {
    const html = renderPublicProfile(
      { ...baseData, instagramUrl: "javascript:alert(1)", whatsappUrl: null },
      options
    );
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("Vezi pe Instagram");
  });

  it("falls back to initials when there is no photo", () => {
    const html = renderPublicProfile({ ...baseData, photoUrl: null }, options);
    expect(html).toContain(">AP<");
    expect(html).toContain('name="twitter:card" content="summary"');
    expect(html).not.toContain("og:image");
  });

  it("omits empty sections rather than rendering bare headings", () => {
    const html = renderPublicProfile(
      {
        ...baseData,
        bio: null,
        specializations: [],
        gyms: [],
        priceLabel: null,
        reviewCount: 0,
      },
      options
    );
    expect(html).not.toContain("Despre mine");
    expect(html).not.toContain("Specializări");
    expect(html).not.toContain("Săli disponibile");
    expect(html).not.toContain("Prețuri");
    expect(html).not.toContain("recenzii");
  });

  it("keeps the meta description within a sensible snippet length", () => {
    const html = renderPublicProfile({ ...baseData, bio: "x".repeat(400) }, options);
    const match = html.match(/<meta name="description" content="([^"]*)"/);
    expect(match).not.toBeNull();
    expect(match![1].length).toBeLessThanOrEqual(155);
  });
});

describe("renderPublicProfile images", () => {
  it("renders the gallery and credential grids", () => {
    const html = renderPublicProfile(
      {
        ...baseData,
        galleryImages: ["https://cdn.example.com/g1.jpg", "https://cdn.example.com/g2.jpg"],
        credentialImages: ["https://cdn.example.com/c1.jpg"],
      },
      options
    );
    expect(html).toContain("Galerie");
    expect(html).toContain('src="https://cdn.example.com/g1.jpg"');
    expect(html).toContain('src="https://cdn.example.com/g2.jpg"');
    expect(html).toContain("Certificări");
    expect(html).toContain('src="https://cdn.example.com/c1.jpg"');
  });

  it("omits a section with no usable images and drops non-http urls", () => {
    const html = renderPublicProfile(
      { ...baseData, galleryImages: ["javascript:alert(1)", ""], credentialImages: [] },
      options
    );
    expect(html).not.toContain("Galerie");
    expect(html).not.toContain("Certificări");
    expect(html).not.toContain("javascript:");
  });
});
