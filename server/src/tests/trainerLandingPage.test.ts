import { describe, it, expect } from "@jest/globals";
import {
  landingGoUrl,
  renderTrainerLanding,
  storeButtons,
} from "../services/trainerLandingPage";
import { normalizePosition, normalizeSource } from "../services/landingCounting";
import { summarize } from "../services/landingStatsPage";

const render = (overrides: Partial<Parameters<typeof renderTrainerLanding>[0]> = {}) =>
  renderTrainerLanding({ platform: "unknown", source: null, publicBaseUrl: "", ...overrides });

describe("renderTrainerLanding", () => {
  it("states the offer and the price the preview approved", () => {
    const html = render();
    expect(html).toContain("Plătești doar după primul client adus de Salvio");
    expect(html).toContain("49,99 lei pe lună");
    expect(html).toContain("harta sălilor din București");
  });

  it("links out only through the counted redirect", () => {
    const html = render();
    expect(html).not.toContain("apps.apple.com");
    expect(html).not.toContain("play.google.com");
    expect(html).not.toContain("instagram.com");
    expect(html).toContain('href="/antrenori/go/ios?from=top"');
    expect(html).toContain('href="/antrenori/go/android?from=bottom"');
    expect(html).toContain('href="/antrenori/go/instagram?from=faq"');
    expect(html).toContain('href="/antrenori/go/instagram?from=footer"');
  });

  it("carries the source into every outbound link", () => {
    const html = render({ source: "ig" });
    expect(html).toContain('href="/antrenori/go/ios?from=top&amp;src=ig"');
    expect(html).toContain('href="/antrenori/go/instagram?from=footer&amp;src=ig"');
  });

  it("serves the screenshots from the app, not from relative paths", () => {
    const html = render();
    expect(html).toContain('src="/antrenori/img/sala.jpg"');
    expect(html).not.toMatch(/src="img\//);
  });

  it("adds an absolute og:image only when the public domain is known", () => {
    expect(render()).not.toContain("og:image");
    expect(render({ publicBaseUrl: "https://salvio.juroc.tech" })).toContain(
      'content="https://salvio.juroc.tech/antrenori/img/sala.jpg"'
    );
  });

  it("has no WhatsApp hand-off", () => {
    expect(render()).not.toContain("wa.me");
  });
});

describe("storeButtons", () => {
  const primaryOf = (html: string) => html.match(/class="store primary" href="([^"]+)"/)?.[1];

  it("puts the visitor's own store first", () => {
    const data = { source: null, publicBaseUrl: "" };
    expect(primaryOf(storeButtons({ ...data, platform: "ios" }, "top"))).toContain("/go/ios");
    expect(primaryOf(storeButtons({ ...data, platform: "android" }, "top"))).toContain("/go/android");
    expect(primaryOf(storeButtons({ ...data, platform: "unknown" }, "top"))).toContain("/go/ios");
  });
});

describe("landingGoUrl", () => {
  it("encodes the source", () => {
    expect(landingGoUrl("android", "top", "a b")).toBe("/antrenori/go/android?from=top&src=a%20b");
  });
});

describe("normalizeSource / normalizePosition", () => {
  it("keeps short tags and drops everything else", () => {
    expect(normalizeSource("IG")).toBe("ig");
    expect(normalizeSource(" tt ")).toBe("tt");
    expect(normalizeSource("<script>")).toBeNull();
    expect(normalizeSource("x".repeat(25))).toBeNull();
    expect(normalizeSource(["ig"])).toBeNull();
    expect(normalizeSource(undefined)).toBeNull();
  });

  it("accepts only the page's own positions", () => {
    expect(normalizePosition("top")).toBe("top");
    expect(normalizePosition("hero")).toBeNull();
  });
});

describe("summarize", () => {
  it("splits visits and store clicks by source, device and button", () => {
    const s = summarize([
      { kind: "visit", target: null, source: "ig", device: "ios", position: null, n: 10 },
      { kind: "visit", target: null, source: "direct", device: "android", position: null, n: 4 },
      { kind: "click", target: "ios", source: "ig", device: "ios", position: "top", n: 3 },
      { kind: "click", target: "android", source: "direct", device: "android", position: "bottom", n: 1 },
      { kind: "click", target: "instagram", source: "ig", device: "ios", position: "faq", n: 2 },
    ]);
    expect(s.visits).toBe(14);
    expect(s.ios).toBe(3);
    expect(s.android).toBe(1);
    expect(s.instagram).toBe(2);
    expect(s.bySource.get("ig")).toEqual({ visits: 10, store: 3 });
    expect(s.byDevice.get("android")).toEqual({ visits: 4, store: 1 });
    expect(s.storeByPosition.get("top")).toBe(3);
    expect(s.storeByPosition.get("bottom")).toBe(1);
  });
});
