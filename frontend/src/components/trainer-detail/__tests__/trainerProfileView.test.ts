import {
  resolveHeroImageUrl,
  buildFullName,
  buildInitials,
  buildIdentitySubtitle,
} from "../trainerProfileView";

describe("resolveHeroImageUrl", () => {
  it("prefers the trainer's profile photo", () => {
    expect(
      resolveHeroImageUrl({
        profileImageUrl: "https://cdn/profile.jpg",
        routeImageUrl: "https://cdn/route.jpg",
        galleryImageUrls: ["https://cdn/gallery.jpg"],
      })
    ).toBe("https://cdn/profile.jpg");
  });

  it("falls back to the route param so a push from search paints with no flash", () => {
    expect(
      resolveHeroImageUrl({
        routeImageUrl: "https://cdn/route.jpg",
        galleryImageUrls: ["https://cdn/gallery.jpg"],
      })
    ).toBe("https://cdn/route.jpg");
  });

  it("falls back to the first gallery image", () => {
    expect(
      resolveHeroImageUrl({
        galleryImageUrls: ["https://cdn/gallery-1.jpg", "https://cdn/gallery-2.jpg"],
      })
    ).toBe("https://cdn/gallery-1.jpg");
  });

  it("skips a blank gallery entry rather than rendering an empty image", () => {
    expect(
      resolveHeroImageUrl({
        galleryImageUrls: ["", "   ", "https://cdn/gallery-2.jpg"],
      })
    ).toBe("https://cdn/gallery-2.jpg");
  });

  it("returns null when there is no usable image, so the caller can show initials", () => {
    expect(resolveHeroImageUrl({})).toBeNull();
    expect(
      resolveHeroImageUrl({
        profileImageUrl: null,
        routeImageUrl: undefined,
        galleryImageUrls: [],
      })
    ).toBeNull();
  });

  it("resolves the deep-link case the old screen got wrong", () => {
    // A deep link passes no route params. The screen used to read only the
    // param, so a trainer with a photo still rendered as initials.
    expect(
      resolveHeroImageUrl({
        profileImageUrl: "https://cdn/profile.jpg",
        routeImageUrl: undefined,
      })
    ).toBe("https://cdn/profile.jpg");
  });
});

describe("buildFullName", () => {
  it("joins first and last name", () => {
    expect(buildFullName("Andrei", "Popescu")).toBe("Andrei Popescu");
  });

  it("tolerates a missing last name", () => {
    expect(buildFullName("Andrei", undefined)).toBe("Andrei");
  });

  it("falls back when both parts are missing", () => {
    expect(buildFullName(undefined, null)).toBe("Trainer");
  });

  it("treats a whitespace-only name as missing", () => {
    expect(buildFullName("   ", "  ")).toBe("Trainer");
  });
});

describe("buildInitials", () => {
  it("takes the first letter of each name, uppercased", () => {
    expect(buildInitials("andrei", "popescu")).toBe("AP");
  });

  it("handles a single name", () => {
    expect(buildInitials("Andrei", null)).toBe("A");
  });

  it("falls back to a question mark", () => {
    expect(buildInitials(undefined, undefined)).toBe("?");
  });

  it("ignores leading whitespace when picking the letter", () => {
    expect(buildInitials("  andrei", "  popescu")).toBe("AP");
  });
});

describe("buildIdentitySubtitle", () => {
  const template = "{n} ani experiență";

  it("joins experience and city", () => {
    expect(
      buildIdentitySubtitle({
        experienceYears: 5,
        locationCity: "București",
        yearsExperienceTemplate: template,
      })
    ).toBe("5 ani experiență · București");
  });

  it("drops experience when it is zero", () => {
    expect(
      buildIdentitySubtitle({
        experienceYears: 0,
        locationCity: "Cluj-Napoca",
        yearsExperienceTemplate: template,
      })
    ).toBe("Cluj-Napoca");
  });

  it("drops the city when it is missing, with no trailing separator", () => {
    expect(
      buildIdentitySubtitle({
        experienceYears: 3,
        locationCity: null,
        yearsExperienceTemplate: template,
      })
    ).toBe("3 ani experiență");
  });

  it("treats a whitespace-only city as missing", () => {
    expect(
      buildIdentitySubtitle({
        experienceYears: 3,
        locationCity: "   ",
        yearsExperienceTemplate: template,
      })
    ).toBe("3 ani experiență");
  });

  it("returns null when there is nothing to say", () => {
    expect(
      buildIdentitySubtitle({
        experienceYears: 0,
        locationCity: undefined,
        yearsExperienceTemplate: template,
      })
    ).toBeNull();
  });

  it("works with the English template too", () => {
    expect(
      buildIdentitySubtitle({
        experienceYears: 1,
        locationCity: "Cluj-Napoca",
        yearsExperienceTemplate: "{n} years experience",
      })
    ).toBe("1 years experience · Cluj-Napoca");
  });
});
