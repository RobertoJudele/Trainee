import { describe, it, expect } from "@jest/globals";
import { slugify, trainerSlugBase, makeUniqueSlug } from "../utils/slug";

describe("slugify", () => {
  it("lowercases and hyphenates a plain name", () => {
    expect(slugify("Andrei Popescu")).toBe("andrei-popescu");
  });

  it("folds Romanian diacritics", () => {
    expect(slugify("Ștefan Mărgineanu")).toBe("stefan-margineanu");
    expect(slugify("Țîru Ana")).toBe("tiru-ana");
    expect(slugify("Îngrid Câmpeanu")).toBe("ingrid-campeanu");
  });

  it("treats the Windows cedilla lookalikes as the comma-below letters", () => {
    // ş U+015F / ţ U+0163 (cedilla, what Windows keyboards emit) must slug the
    // same as ș U+0219 / ț U+021B (comma-below, the correct characters) —
    // otherwise the same trainer gets two different URLs depending on device.
    expect(slugify("Ştefan Ţiriac")).toBe(slugify("ștefan țiriac"));
    expect(slugify("Ştefan")).toBe("stefan");
  });

  it("keeps hyphenated surnames readable", () => {
    expect(slugify("Ana-Maria Popescu-Ionescu")).toBe("ana-maria-popescu-ionescu");
  });

  it("collapses punctuation and repeated separators", () => {
    expect(slugify("  Andrei   ,,, Popescu!!  ")).toBe("andrei-popescu");
    expect(slugify("O'Brien  Ionescu")).toBe("o-brien-ionescu");
  });

  it("drops emoji and other junk without leaving stray hyphens", () => {
    expect(slugify("Andrei 💪 Popescu")).toBe("andrei-popescu");
    expect(slugify("Andrei Popescu 🏋️")).toBe("andrei-popescu");
  });

  it("returns an empty string when nothing usable survives", () => {
    expect(slugify("💪")).toBe("");
    expect(slugify("   ")).toBe("");
  });

  it("truncates without leaving a trailing hyphen", () => {
    const long = slugify(`${"Alexandru".repeat(9)} Popescu`);
    expect(long.length).toBeLessThanOrEqual(60);
    expect(long.endsWith("-")).toBe(false);
  });
});

describe("trainerSlugBase", () => {
  const publicId = "30f823f8-bf37-408f-8b65-1afa9cdc08d1";

  it("builds from the trainer's name", () => {
    expect(trainerSlugBase("Andrei", "Popescu", publicId)).toBe("andrei-popescu");
  });

  it("copes with a missing surname", () => {
    expect(trainerSlugBase("Andrei", null, publicId)).toBe("andrei");
  });

  it("falls back to the public id when the name slugs to nothing", () => {
    // A name in a non-Latin script would otherwise produce an empty slug and a
    // URL that 404s.
    expect(trainerSlugBase("Ω", "💪", publicId)).toBe("antrenor-30f823f8");
    expect(trainerSlugBase(null, null, publicId)).toBe("antrenor-30f823f8");
  });
});

describe("makeUniqueSlug", () => {
  const takenSet = (...taken: string[]) => async (candidate: string) =>
    taken.includes(candidate);

  it("returns the base when it is free", async () => {
    expect(await makeUniqueSlug("andrei-popescu", takenSet())).toBe("andrei-popescu");
  });

  it("suffixes the second trainer with the same name", async () => {
    expect(await makeUniqueSlug("andrei-popescu", takenSet("andrei-popescu"))).toBe(
      "andrei-popescu-2"
    );
  });

  it("keeps counting past several collisions", async () => {
    expect(
      await makeUniqueSlug(
        "andrei-popescu",
        takenSet("andrei-popescu", "andrei-popescu-2", "andrei-popescu-3")
      )
    ).toBe("andrei-popescu-4");
  });

  it("gives up on a pathological dataset instead of looping forever", async () => {
    const alwaysTaken = async () => true;
    const slug = await makeUniqueSlug("andrei-popescu", alwaysTaken, 3);
    expect(slug.startsWith("andrei-popescu-")).toBe(true);
    // Not one of the numbered attempts — the timestamped escape hatch.
    expect(["andrei-popescu-2", "andrei-popescu-3"]).not.toContain(slug);
  });
});
