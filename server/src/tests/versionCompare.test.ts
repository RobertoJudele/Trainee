import { describe, it, expect } from "@jest/globals";
import { isUpdateRequired } from "../utils/versionCompare";

describe("isUpdateRequired", () => {
  it("older current version → true", () => {
    expect(isUpdateRequired("1.0.0", "1.2.0")).toBe(true);
    expect(isUpdateRequired("1.2.9", "1.3.0")).toBe(true);
  });

  it("equal version → false", () => {
    expect(isUpdateRequired("1.2.0", "1.2.0")).toBe(false);
  });

  it("newer current version → false", () => {
    expect(isUpdateRequired("2.0.0", "1.9.9")).toBe(false);
  });

  it("differing segment lengths compare by value", () => {
    expect(isUpdateRequired("1.2", "1.2.0")).toBe(false); // 1.2 == 1.2.0
    expect(isUpdateRequired("1.2", "1.2.1")).toBe(true);
    expect(isUpdateRequired("1.2.0.0", "1.2")).toBe(false);
  });

  it("malformed input → false (fail-open)", () => {
    expect(isUpdateRequired("", "1.2.0")).toBe(false);
    expect(isUpdateRequired("abc", "1.2.0")).toBe(false);
    expect(isUpdateRequired("1.2.0", "")).toBe(false);
    expect(isUpdateRequired(undefined as unknown as string, "1.0.0")).toBe(false);
  });
});
