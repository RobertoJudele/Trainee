import { describeFoundingOffer, romanianNeedsDe } from "../foundingOffer";

const openOffer = {
  isOpen: true,
  months: 3,
  deadline: "2026-09-30T23:59:59.999Z",
};

const at = (iso: string) => new Date(iso);

describe("describeFoundingOffer", () => {
  it("counts the days remaining, rounding up", () => {
    const view = describeFoundingOffer(openOffer, at("2026-09-27T10:00:00Z"));
    expect(view).not.toBeNull();
    expect(view!.daysLeft).toBe(4);
    expect(view!.months).toBe(3);
  });

  it("still shows on the final evening", () => {
    const view = describeFoundingOffer(openOffer, at("2026-09-30T22:00:00Z"));
    expect(view!.daysLeft).toBe(1);
  });

  it("disappears the moment the deadline passes", () => {
    expect(describeFoundingOffer(openOffer, at("2026-10-01T00:00:01Z"))).toBeNull();
  });

  it("shows nothing when the server says the promo is closed", () => {
    expect(
      describeFoundingOffer({ isOpen: false, months: 0 }, at("2026-08-13T10:00:00Z"))
    ).toBeNull();
  });

  it("shows nothing when the offer is missing entirely", () => {
    // An older server, or a request that failed — render nothing rather than
    // guessing a deadline.
    expect(describeFoundingOffer(undefined, at("2026-08-13T10:00:00Z"))).toBeNull();
  });

  it("shows nothing when the deadline is absent or unparseable", () => {
    expect(
      describeFoundingOffer({ isOpen: true, months: 3 }, at("2026-08-13T10:00:00Z"))
    ).toBeNull();
    expect(
      describeFoundingOffer(
        { isOpen: true, months: 3, deadline: "not-a-date" },
        at("2026-08-13T10:00:00Z")
      )
    ).toBeNull();
  });

  it("reports the served month count rather than assuming three", () => {
    const view = describeFoundingOffer(
      { isOpen: true, months: 12, deadline: "2026-12-31T23:59:59.999Z" },
      at("2026-08-13T10:00:00Z")
    );
    expect(view!.months).toBe(12);
  });
});

describe("romanianNeedsDe", () => {
  // "3 zile" but "49 de zile"; "101 zile" but "120 de zile".
  it.each([1, 2, 3, 15, 19, 101, 119])("no 'de' for %i", (n) => {
    expect(romanianNeedsDe(n)).toBe(false);
  });

  it.each([20, 21, 49, 99, 100, 120, 200])("needs 'de' for %i", (n) => {
    expect(romanianNeedsDe(n)).toBe(true);
  });

  it("flags the real 30-September countdown correctly", () => {
    // 49 days out — "Mai sunt 49 de zile", not "49 zile".
    const view = describeFoundingOffer(openOffer, at("2026-08-13T10:00:00Z"));
    expect(view!.daysLeft).toBe(49);
    expect(view!.needsDe).toBe(true);
  });
});
