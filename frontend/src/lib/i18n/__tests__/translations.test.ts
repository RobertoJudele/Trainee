import { translations } from "../translations";

/**
 * A key missing from one language fails silently at runtime — `t()` falls back
 * to returning the key itself, so the UI renders "contactTrainer" instead of
 * "Contactează antrenorul". Romanian is the default language, which makes a gap
 * on the RO side the more likely one to ship unnoticed.
 */
describe("translations", () => {
  const enKeys = Object.keys(translations.en);
  const roKeys = Object.keys(translations.ro);

  it("has every English key in Romanian", () => {
    const missing = enKeys.filter((key) => !(key in translations.ro));
    expect(missing).toEqual([]);
  });

  it("has every Romanian key in English", () => {
    const missing = roKeys.filter((key) => !(key in translations.en));
    expect(missing).toEqual([]);
  });

  it("has no blank values", () => {
    const blank = [
      ...enKeys.filter((key) => translations.en[key].trim() === ""),
      ...roKeys.filter((key) => translations.ro[key].trim() === ""),
    ];
    expect(blank).toEqual([]);
  });

  it("keeps the %s placeholder in both languages for fromPerSession", () => {
    expect(translations.en.fromPerSession).toContain("%s");
    expect(translations.ro.fromPerSession).toContain("%s");
  });
});
