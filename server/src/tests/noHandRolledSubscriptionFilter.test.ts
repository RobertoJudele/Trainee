import { describe, it, expect } from "@jest/globals";
import { readFileSync } from "fs";
import { join } from "path";
import { globSync } from "glob";

// The active-subscription rule must exist in exactly one SQL form:
// activeSubscriptionScope.ts. Anywhere else, pairing a `subscriptionStatus`
// filter with a `trialEndsAt` comparison is the old divergent hand-rolled
// filter — ban it so it can't silently come back.
describe("no hand-rolled subscription filter", () => {
  it("only activeSubscriptionScope.ts pairs subscriptionStatus with trialEndsAt in a where", () => {
    const root = join(__dirname, "..");
    const files = globSync("**/*.ts", {
      cwd: root,
      ignore: ["tests/**", "services/billing/activeSubscriptionScope.ts"],
      absolute: true,
    });

    // Whole-file substring checks would false-positive on files where
    // `subscriptionStatus`/`trialEndsAt` and an unrelated `[Op.or]` (e.g. a
    // bio/name text search) happen to coexist far apart. Require the four
    // markers to appear near each other (i.e. actually paired in one where
    // fragment), not just anywhere in the same file.
    const WINDOW = 500;
    const hasHandRolledFilter = (src: string): boolean => {
      let idx = src.indexOf("subscriptionStatus");
      while (idx !== -1) {
        const chunk = src.slice(Math.max(0, idx - WINDOW), idx + WINDOW);
        if (
          /trialEndsAt/.test(chunk) &&
          /\[Op\.or\]/.test(chunk) &&
          /subStatus\.(ACTIVE|TRIAL)/.test(chunk)
        ) {
          return true;
        }
        idx = src.indexOf("subscriptionStatus", idx + 1);
      }
      return false;
    };

    const offenders = files.filter((f) => hasHandRolledFilter(readFileSync(f, "utf8")));

    expect(offenders).toEqual([]);
  });
});
