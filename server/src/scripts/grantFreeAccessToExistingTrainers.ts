/**
 * One-off: moves every existing trainer onto free access until converted.
 *
 *   npm run free-access:backfill              # dry run: lists who would change
 *   npm run free-access:backfill -- --apply   # does it
 *
 * Covers trainers on the old 3-month founding grant and trainers with no access
 * at all. Trainers with a paid or store-trial subscription, and those already
 * open-ended, are left alone.
 *
 * Run it ONCE, before ending anyone's free access: a trainer whose access was
 * ended through the admin endpoint looks exactly like a lapsed one, and a rerun
 * would hand them free access again.
 */
import "reflect-metadata";
import dotenv from "dotenv";
import sequelize from "../db";
import { Trainer } from "../models/trainer";
import { billingService } from "../services/billing";

dotenv.config();

async function main() {
  const apply = process.argv.includes("--apply");

  (sequelize as unknown as { options: { logging: boolean } }).options.logging = false;
  await sequelize.authenticate({ logging: false });

  const trainers = await Trainer.findAll({ attributes: ["id", "userId"], order: [["id", "ASC"]] });
  let changed = 0;

  for (const trainer of trainers) {
    const entitlement = await billingService.getEntitlement(trainer.userId);
    const covered =
      entitlement.isActive && (!entitlement.isPromotional || entitlement.isOpenEnded);
    if (covered) continue;

    const before = entitlement.isActive
      ? `promo until ${entitlement.expiresAt?.toISOString().slice(0, 10)}`
      : `no access (${entitlement.status})`;

    if (apply) {
      await billingService.grantFreeAccess(trainer.userId);
    }
    changed += 1;
    console.log(`trainer ${trainer.id} (user ${trainer.userId}): ${before} -> open-ended`);
  }

  console.log(
    apply
      ? `\nDone: ${changed} of ${trainers.length} trainers now have open-ended free access.`
      : `\nDry run: ${changed} of ${trainers.length} trainers would change. Re-run with --apply.`,
  );

  // The RevenueCat pushes run in the background; give them time to land.
  if (apply && changed > 0) await new Promise((r) => setTimeout(r, 5000));
  await sequelize.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
