import { describe, it, expect } from "@jest/globals";
import {
  formatCountdown,
  formatDeadlineLabel,
  formatMonthsLabel,
  renderPosterLanding,
} from "../services/posterLandingPage";

const openOffer = {
  isOpen: true,
  months: 3,
  deadline: "2026-09-30T23:59:59+03:00",
};

const render = (overrides: Partial<Parameters<typeof renderPosterLanding>[0]> = {}) =>
  renderPosterLanding({
    gymName: "World Class Dorobanți",
    startUrl: "/p/k7fm2q/start",
    offer: openOffer,
    now: new Date("2026-09-19T17:17:59+03:00"),
    ...overrides,
  });

describe("formatCountdown", () => {
  it("formats days unpadded and time zero-padded", () => {
    const ms = 11 * 864e5 + 6 * 36e5 + 42 * 6e4;
    expect(formatCountdown(ms)).toBe("11z 06:42");
  });

  it("clamps at zero rather than going negative", () => {
    expect(formatCountdown(-5000)).toBe("0z 00:00");
  });
});

describe("formatMonthsLabel", () => {
  it("uses Romanian number agreement", () => {
    expect(formatMonthsLabel(1)).toBe("1 lună gratis");
    expect(formatMonthsLabel(3)).toBe("3 luni gratis");
    expect(formatMonthsLabel(24)).toBe("24 de luni gratis");
  });
});

describe("formatDeadlineLabel", () => {
  it("renders the deadline as a Romanian date in Bucharest time", () => {
    expect(formatDeadlineLabel("2026-09-30T23:59:59+03:00")).toBe("30 septembrie");
  });
});

describe("renderPosterLanding", () => {
  it("puts the gym name in the headline", () => {
    const html = render();
    expect(html).toContain("Ești antrenor la");
    expect(html).toContain("World Class Dorobanți");
  });

  it("escapes a gym name so it cannot inject markup", () => {
    const html = render({ gymName: '<script>alert(1)</script>' });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("falls back to a gym-neutral headline, never the placeholder", () => {
    const html = render({ gymName: null });
    expect(html).toContain("Ești antrenor în");
    expect(html).toContain("București");
    expect(html).not.toContain("[Nume Sală]");
  });

  it("steps the headline down for a long gym name instead of truncating", () => {
    expect(render({ gymName: "Sala" })).toContain("font-size:44px");
    expect(render({ gymName: "World Class Dorobanți" })).toContain("font-size:38px");
  });

  it("renders the offer card with a server-side first countdown frame", () => {
    const html = render();
    expect(html).toContain("OFERTA PENTRU PRIMII MEMBRII");
    expect(html).toContain("3 luni gratis");
    expect(html).toContain("30 septembrie");
    expect(html).toContain("11z 06:42");
    expect(html).toContain('data-deadline="2026-09-30T23:59:59+03:00"');
  });

  it("omits the offer entirely when the founding grant has closed", () => {
    const html = render({ offer: { isOpen: false, months: 0 } });
    expect(html).not.toContain("OFERTA PENTRU PRIMII MEMBRII");
    expect(html).not.toContain("Închis");
    expect(html).toContain("Începe în 90 de secunde");
  });

  it("points the single CTA at the start URL", () => {
    const html = render();
    expect(html).toContain('href="/p/k7fm2q/start"');
    expect(html.match(/Începe în 90 de secunde/g)).toHaveLength(1);
  });

  it("keeps the client's copy verbatim, missing diacritics included", () => {
    expect(render()).toContain(
      "Apari la toate salile la care antrenezi si lasa lumea sa te cunoasca."
    );
  });

  it("drops the two claims removed in review", () => {
    const html = render();
    expect(html).not.toContain("Locuri limitate");
    expect(html).not.toContain("Parteneriat oficial");
  });

  it("shows the gym logo only when one is set, and only over http(s)", () => {
    expect(render()).not.toContain("gym-logo");
    expect(render({ gymLogoUrl: "https://cdn.example.com/g.png" })).toContain(
      "https://cdn.example.com/g.png"
    );
    expect(render({ gymLogoUrl: "javascript:alert(1)" })).not.toContain("javascript:");
  });

  it("keeps crawlers out of the index", () => {
    expect(render()).toContain('<meta name="robots" content="noindex">');
  });
});
