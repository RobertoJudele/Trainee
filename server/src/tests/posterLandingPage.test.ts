import { describe, it, expect } from "@jest/globals";
import {
  renderPosterLanding,
  trainerCountHtml,
  whatsappUrl,
} from "../services/posterLandingPage";

const render = (overrides: Partial<Parameters<typeof renderPosterLanding>[0]> = {}) =>
  renderPosterLanding({
    gymName: "World Class Dorobanți",
    trainerCount: 2,
    whatsappNumber: "40722123456",
    ...overrides,
  });

describe("trainerCountHtml", () => {
  it("invites the first trainer at 0", () => {
    expect(trainerCountHtml(0)).toContain("Încă nu e nimeni pe hartă. Poți fi primul.");
  });

  it("uses the singular for one trainer", () => {
    expect(trainerCountHtml(1)).toContain("<b>1</b> antrenor din 6");
  });

  it("counts towards 6 below the target", () => {
    expect(trainerCountHtml(3)).toContain("<b>3</b> antrenori din 6");
  });

  it("drops the target once it is reached", () => {
    expect(trainerCountHtml(7)).toContain("<b>7</b> antrenori pe hartă");
  });
});

describe("whatsappUrl", () => {
  it("prefills the gym in the message", () => {
    expect(whatsappUrl("40722123456", "Smart Fit")).toBe(
      "https://wa.me/40722123456?text=Salut%2C%20sunt%20antrenor%20la%20Smart%20Fit"
    );
  });

  it("still opens WhatsApp when no number is configured", () => {
    expect(whatsappUrl(null, null)).toBe("https://wa.me/?text=Salut%2C%20sunt%20antrenor");
  });
});

describe("renderPosterLanding", () => {
  it("puts the gym name in the headline, title and counter label", () => {
    const html = render();
    expect(html).toContain('Ești antrenor la <span class="gym">World Class Dorobanți</span>?');
    expect(html).toContain("<title>Salvio · Ești antrenor la World Class Dorobanți?</title>");
    expect(html).toContain('<div class="label">Harta World Class Dorobanți</div>');
  });

  it("escapes a gym name so it cannot inject markup", () => {
    const html = render({ gymName: "<script>alert(1)</script>" });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("never ships the design placeholder", () => {
    expect(render()).not.toContain("[Nume sală]");
    expect(render({ gymName: null })).not.toContain("[Nume sală]");
  });

  it("falls back to 'sala ta' with no counter for an unknown gym", () => {
    const html = render({ gymName: null });
    expect(html).toContain('Ești antrenor la <span class="gym">sala ta</span>?');
    expect(html).not.toContain('class="counter"');
  });

  it("fills one segment per trainer, capped at six", () => {
    const filled = (html: string) => (html.match(/<i class="on"><\/i>/g) ?? []).length;
    expect(filled(render({ trainerCount: 0 }))).toBe(0);
    expect(filled(render({ trainerCount: 3 }))).toBe(3);
    expect(filled(render({ trainerCount: 9 }))).toBe(6);
  });

  it("switches the status line once the map is full", () => {
    expect(render({ trainerCount: 5 })).toContain("Când suntem 6, încep s-o arăt membrilor sălii.");
    expect(render({ trainerCount: 6 })).toContain("Harta e gata. O arăt acum membrilor sălii.");
  });

  it("points the CTA at WhatsApp with the gym prefilled", () => {
    expect(render()).toContain(
      'href="https://wa.me/40722123456?text=Salut%2C%20sunt%20antrenor%20la%20World%20Class%20Doroban%C8%9Bi"'
    );
  });

  it("drops the old page's claims", () => {
    const html = render();
    for (const gone of [
      "luni gratis",
      "Oferta pentru primii membrii",
      "Locuri limitate",
      "Parteneriat oficial",
      "Începe în 90 de secunde",
      "Nu e o listă cu 700 de nume",
      "Clienții din sala ta te găsesc singuri",
      "Nu ești antrenor?",
      "Afiș pus cu acordul",
    ]) {
      expect(html.toLowerCase()).not.toContain(gone.toLowerCase());
    }
  });

  it("keeps crawlers out of the index", () => {
    expect(render()).toContain('<meta name="robots" content="noindex">');
  });
});
