import { describe, it, expect } from "@jest/globals";
import { PosterCode } from "../models/posterCode";

describe("PosterCode model", () => {
  it("creates a code with zeroed counters, active by default", async () => {
    const poster = await PosterCode.create({
      code: "abc234",
      label: "World Class Dorobanți",
    });

    expect(poster.scanCount).toBe(0);
    expect(poster.appleClickCount).toBe(0);
    expect(poster.playClickCount).toBe(0);
    expect(poster.isActive).toBe(true);
    expect(poster.lastScannedAt ?? null).toBeNull();
    expect(poster.gymId ?? null).toBeNull();
    expect(poster.gymLogoUrl ?? null).toBeNull();
  });

  it("rejects a duplicate code", async () => {
    await PosterCode.create({ code: "dup234", label: "Sala A" });

    await expect(
      PosterCode.create({ code: "dup234", label: "Sala B" })
    ).rejects.toThrow();
  });
});
