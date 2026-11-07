import { summarizePrices, roCount, contactButtonLabel, formatLei } from "../trainerPage";

describe("summarizePrices", () => {
  // Three packs, the biggest the cheapest per session: "de la 50 lei o ședință",
  // with the pack that gets you there named under it.
  it("quotes the cheapest pack rate and the pack it comes from", () => {
    const summary = summarizePrices(null, [
      { name: "1 ședință", price: 80, sessionCount: 1 },
      { name: "Pachet 5", price: "300.00", sessionCount: 5 },
      { name: "Pachet 10", price: 500, sessionCount: 10 },
    ]);
    expect(summary?.lowest).toBe(50);
    expect(summary?.showFrom).toBe(true);
    expect(summary?.lowestPackSessions).toBe(10);
    expect(summary?.options.map((o) => o.perSession)).toEqual([80, 60, 50]);
  });

  // The session rate is a leftover trainers can't edit any more. With packages it
  // must not appear as a "one session" price, even when it is the lowest number.
  it("ignores the old session rate once there are packages", () => {
    const summary = summarizePrices(50, [
      { name: "4", price: 440, sessionCount: 4 },
      { name: "8", price: 800, sessionCount: 8 },
    ]);
    expect(summary?.options.every((o) => o.kind === "package")).toBe(true);
    expect(summary?.lowest).toBe(100);
    expect(summary?.lowestPackSessions).toBe(8);
  });

  it("falls back to the session rate when there are no packages", () => {
    expect(summarizePrices(140, [])).toEqual({
      lowest: 140,
      showFrom: false,
      lowestPackSessions: null,
      options: [{ kind: "single", sessions: 1, total: 140, perSession: 140 }],
    });
  });

  it("drops 'de la' when every pack costs the same per session", () => {
    const summary = summarizePrices(null, [
      { name: "5", price: 500, sessionCount: 5 },
      { name: "10", price: 1000, sessionCount: 10 },
    ]);
    expect(summary?.showFrom).toBe(false);
    expect(summary?.lowestPackSessions).toBeNull();
  });

  it("skips broken packages", () => {
    const summary = summarizePrices(null, [
      { name: "ok", price: 300, sessionCount: 3 },
      { name: "zero sessions", price: 100, sessionCount: 0 },
      { name: "no price", price: "abc", sessionCount: 2 },
    ]);
    expect(summary?.options).toHaveLength(1);
    expect(summary?.lowest).toBe(100);
  });

  it("returns null when there is no price at all", () => {
    expect(summarizePrices(0, [])).toBeNull();
  });
});

describe("roCount", () => {
  it("follows the Romanian 'de' rule", () => {
    expect(roCount(1, "recenzie", "recenzii")).toBe("1 recenzie");
    expect(roCount(5, "recenzie", "recenzii")).toBe("5 recenzii");
    expect(roCount(19, "recenzie", "recenzii")).toBe("19 recenzii");
    expect(roCount(23, "recenzie", "recenzii")).toBe("23 de recenzii");
    expect(roCount(101, "recenzie", "recenzii")).toBe("101 recenzii");
    expect(roCount(120, "recenzie", "recenzii")).toBe("120 de recenzii");
  });
});

describe("formatLei", () => {
  it("drops trailing zeros and uses a comma in Romanian", () => {
    expect(formatLei(120, "ro")).toBe("120");
    expect(formatLei(112.5, "ro")).toBe("112,5");
    expect(formatLei(112.5, "en")).toBe("112.5");
  });
});

describe("contactButtonLabel", () => {
  it("uses the dative name typed in at onboarding", () => {
    expect(contactButtonLabel("whatsapp", "ro", "Andrei", "lui Andrei")).toBe(
      "Scrie-i lui Andrei pe WhatsApp"
    );
    expect(contactButtonLabel("instagram", "ro", "Elena", "Elenei")).toBe(
      "Scrie-i Elenei pe Instagram"
    );
  });

  it("drops the name instead of guessing the grammar", () => {
    expect(contactButtonLabel("whatsapp", "ro", "Alex", null)).toBe("Scrie pe WhatsApp");
    expect(contactButtonLabel("whatsapp", "ro", "Alex", "  ")).toBe("Scrie pe WhatsApp");
  });

  it("uses the first name in English", () => {
    expect(contactButtonLabel("facebook", "en", "Andrei")).toBe("Message Andrei on Facebook");
  });
});
