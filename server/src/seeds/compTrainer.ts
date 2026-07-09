// server/src/seeds/compTrainer.ts
// Grant a demo/review trainer active access without a real purchase.
// Usage: npx ts-node src/seeds/compTrainer.ts trainer.demo@example.com
//
// Sets a long-running trial on the trainer profile. The entitlement rule
// (services/billing/activeSubscriptionScope.ts) treats status 'trial' with a
// future trialEndsAt as active regardless of billing provider — so this unlocks
// gated trainer features and makes the trainer show in search.
import sequelize from "../db";
import { User } from "../models/user";
import { Trainer } from "../models/trainer";

const COMP_UNTIL = new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000); // ~10 years

async function comp(email: string): Promise<void> {
  await sequelize.authenticate();

  const user = await User.findOne({ where: { email } });
  if (!user) throw new Error(`No user with email ${email}`);

  const trainer = await Trainer.findOne({ where: { userId: user.id } });
  if (!trainer) throw new Error(`User ${email} is not a trainer (no trainer profile)`);

  await trainer.update({
    subscriptionStatus: "trial",
    trialEndsAt: COMP_UNTIL,
    billingProvider: "none",
  } as any);

  console.log(`✅ Comped trainer ${email} (trainer id=${trainer.id}) — active until ${COMP_UNTIL.toISOString()}`);
}

const email = process.argv[2];
if (!email) {
  console.error("Usage: npx ts-node src/seeds/compTrainer.ts <trainer-email>");
  process.exit(1);
}

comp(email)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Comp failed:", err.message);
    process.exit(1);
  });
