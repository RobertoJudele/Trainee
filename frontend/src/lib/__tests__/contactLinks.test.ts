import {
  normalizeSocialUrl,
  normalizeWhatsAppPhoneDigits,
  getWhatsAppContactUrls,
  openFirstAvailable,
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
  // The trainer page pre-fills the first message. Diacritics, spaces and "!"
  // have to survive the trip through both URL forms.
  it("adds an encoded message to both urls", () => {
    const message = "Bună, Andrei! Te-am găsit pe Salvio.";
    const encoded = encodeURIComponent(message);
    expect(getWhatsAppContactUrls("+40721234567", message)).toEqual({
      appUrl: `whatsapp://send?phone=40721234567&text=${encoded}`,
      webUrl: `https://wa.me/40721234567?text=${encoded}`,
    });
  });

  it("leaves the urls bare when the message is blank", () => {
    expect(getWhatsAppContactUrls("+40721234567", "   ")).toEqual({
      appUrl: "whatsapp://send?phone=40721234567",
      webUrl: "https://wa.me/40721234567",
    });
  });

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

describe("openFirstAvailable", () => {
  // iOS: canOpenURL *rejects* for a custom scheme missing from
  // LSApplicationQueriesSchemes instead of answering false. That used to abort
  // before the wa.me fallback was ever tried.
  it("moves on to the fallback when checking the first url throws", async () => {
    const opened: string[] = [];
    const linking = {
      canOpenURL: jest.fn(async (url: string) => {
        if (url.startsWith("whatsapp://")) throw new Error("Unable to open URL: add whatsapp to LSApplicationQueriesSchemes");
        return true;
      }),
      openURL: jest.fn(async (url: string) => { opened.push(url); }),
    };
    await expect(
      openFirstAvailable(["whatsapp://send?phone=40773880996", "https://wa.me/40773880996"], linking)
    ).resolves.toBe(true);
    expect(opened).toEqual(["https://wa.me/40773880996"]);
  });

  it("opens an https url even when canOpenURL says no", async () => {
    // Android 11+ answers false for anything not declared in <queries>.
    const opened: string[] = [];
    const linking = {
      canOpenURL: jest.fn(async () => false),
      openURL: jest.fn(async (url: string) => { opened.push(url); }),
    };
    await expect(
      openFirstAvailable(["whatsapp://send?phone=1", "https://wa.me/40773880996"], linking)
    ).resolves.toBe(true);
    expect(opened).toEqual(["https://wa.me/40773880996"]);
  });

  it("reports failure when nothing opens", async () => {
    const linking = {
      canOpenURL: jest.fn(async () => false),
      openURL: jest.fn(async () => { throw new Error("no handler"); }),
    };
    await expect(openFirstAvailable(["whatsapp://x", "https://wa.me/1"], linking)).resolves.toBe(false);
  });
});
