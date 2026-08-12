import {
  normalizeSocialUrl,
  normalizeWhatsAppPhoneDigits,
  getWhatsAppContactUrls,
} from "../contactLinks";

describe("normalizeSocialUrl", () => {
  it("keeps an already-absolute url", () => {
    expect(normalizeSocialUrl("https://instagram.com/andrei")).toBe(
      "https://instagram.com/andrei"
    );
  });

  it("adds https to a bare host, which is how trainers actually type it", () => {
    expect(normalizeSocialUrl("instagram.com/andrei")).toBe(
      "https://instagram.com/andrei"
    );
  });

  it("preserves http rather than forcing https", () => {
    expect(normalizeSocialUrl("http://facebook.com/andrei")).toBe(
      "http://facebook.com/andrei"
    );
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeSocialUrl("  instagram.com/andrei  ")).toBe(
      "https://instagram.com/andrei"
    );
  });

  it.each([null, undefined, "", "   "])("returns null for %p", (value) => {
    expect(normalizeSocialUrl(value as string | null | undefined)).toBeNull();
  });

  it("returns null when the value cannot be parsed as a url", () => {
    expect(normalizeSocialUrl("http://")).toBeNull();
  });
});

describe("normalizeWhatsAppPhoneDigits", () => {
  it("strips formatting from a Romanian mobile number", () => {
    expect(normalizeWhatsAppPhoneDigits("+40 721 234 567")).toBe("40721234567");
  });

  it("converts a 00 international prefix to digits", () => {
    expect(normalizeWhatsAppPhoneDigits("0040721234567")).toBe("40721234567");
  });

  it("strips dashes and parentheses", () => {
    expect(normalizeWhatsAppPhoneDigits("+40-(721)-234-567")).toBe("40721234567");
  });

  it("rejects a number that is too short", () => {
    expect(normalizeWhatsAppPhoneDigits("12345")).toBeNull();
  });

  it("rejects a number that is too long", () => {
    expect(normalizeWhatsAppPhoneDigits("1234567890123456")).toBeNull();
  });

  it("rejects a number whose first digit is zero", () => {
    // A local Romanian number (0721…) is not dialable internationally, and
    // WhatsApp needs the country code.
    expect(normalizeWhatsAppPhoneDigits("0721234567")).toBeNull();
  });

  it("rejects a value with no digits at all", () => {
    expect(normalizeWhatsAppPhoneDigits("not a phone")).toBeNull();
  });
});

describe("getWhatsAppContactUrls", () => {
  it("builds both urls from a raw phone number", () => {
    expect(getWhatsAppContactUrls("+40721234567")).toEqual({
      appUrl: "whatsapp://send?phone=40721234567",
      webUrl: "https://wa.me/40721234567",
    });
  });

  it("extracts the number from a wa.me link", () => {
    expect(getWhatsAppContactUrls("https://wa.me/40721234567")).toEqual({
      appUrl: "whatsapp://send?phone=40721234567",
      webUrl: "https://wa.me/40721234567",
    });
  });

  it("extracts the number from a wa.me link with no protocol", () => {
    expect(getWhatsAppContactUrls("wa.me/40721234567")).toEqual({
      appUrl: "whatsapp://send?phone=40721234567",
      webUrl: "https://wa.me/40721234567",
    });
  });

  it("extracts the phone query param from an api.whatsapp.com link", () => {
    expect(
      getWhatsAppContactUrls("https://api.whatsapp.com/send?phone=40721234567")
    ).toEqual({
      appUrl: "whatsapp://send?phone=40721234567",
      webUrl: "https://wa.me/40721234567",
    });
  });

  it("handles www.whatsapp.com as well", () => {
    expect(
      getWhatsAppContactUrls("https://www.whatsapp.com/send?phone=40721234567")
    ).toEqual({
      appUrl: "whatsapp://send?phone=40721234567",
      webUrl: "https://wa.me/40721234567",
    });
  });

  it("ignores a wa.me link carrying no usable number", () => {
    expect(getWhatsAppContactUrls("https://wa.me/")).toBeNull();
  });

  it("ignores an unrelated host even when it has a phone param", () => {
    expect(
      getWhatsAppContactUrls("https://example.com/send?phone=40721234567")
    ).toBeNull();
  });

  it("does not mine digits out of a non-WhatsApp link", () => {
    // A trainer pasting the wrong link into the WhatsApp field used to produce
    // a working-looking button that opened WhatsApp on the Facebook profile id.
    expect(
      getWhatsAppContactUrls("facebook.com/profile.php?id=100012345678")
    ).toBeNull();
    expect(getWhatsAppContactUrls("instagram.com/andrei.popescu")).toBeNull();
  });

  it.each([null, undefined, "", "   "])("returns null for %p", (value) => {
    expect(getWhatsAppContactUrls(value as string | null | undefined)).toBeNull();
  });
});
