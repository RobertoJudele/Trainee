// Deletes the S3/R2 objects belonging to the accounts that purge-accounts.sql
// removes. Run this FIRST — once the rows are gone the URLs are gone with them
// and the objects stay in the bucket forever, publicly fetchable.
//
//   docker exec trainee_api node dist/scripts/purgeAccountImages.js trainers
//   docker exec trainee_api node dist/scripts/purgeAccountImages.js trainers --yes
//
// Without --yes it only lists what it would delete.
//
// Modes match purge-accounts.sql: demo | trainers | all. Admins are never
// included, in any mode.
import { Op } from "sequelize";
import sequelize from "../db";
import { User } from "../models/user";
import { Trainer } from "../models/trainer";
import { TrainerImage } from "../models/trainerImage";
import { S3ImageService } from "../services/s3ImageService";

type Mode = "demo" | "trainers" | "all";

const whereForMode = (mode: Mode) => {
  const notAdmin = { role: { [Op.ne]: "admin" } };
  switch (mode) {
    case "demo":
      return {
        ...notAdmin,
        [Op.or]: [
          { email: { [Op.like]: "%.demo@salvio.app" } },
          { email: { [Op.like]: "%.demo@trainee.app" } },
        ],
      };
    case "trainers":
      return { role: "trainer" };
    case "all":
      return notAdmin;
  }
};

async function run(mode: Mode, confirmed: boolean): Promise<void> {
  await sequelize.authenticate();

  const users = await User.findAll({
    where: whereForMode(mode) as never,
    attributes: ["id", "email", "profileImageUrl"],
  });
  if (users.length === 0) {
    console.log(`No accounts match mode="${mode}" — nothing to delete.`);
    return;
  }

  const userIds = users.map((u) => u.id);
  const trainers = await Trainer.findAll({
    where: { userId: { [Op.in]: userIds } },
    attributes: ["id"],
  });
  const images = await TrainerImage.findAll({
    where: { trainerId: { [Op.in]: trainers.map((t) => t.id) } },
    attributes: ["imageUrl"],
  });

  const urls = [
    ...users.map((u) => u.profileImageUrl),
    ...images.map((i) => i.imageUrl),
  ].filter((u): u is string => Boolean(u));

  console.log(
    `mode="${mode}": ${users.length} accounts, ${trainers.length} trainer profiles, ` +
    `${urls.length} image URLs, plus the profile-picture/<id>/ prefix per account ` +
    `(catches superseded avatars the current URL no longer names).`
  );

  if (!confirmed) {
    console.log("\nDry run. Re-run with --yes to delete. Sample:");
    urls.slice(0, 5).forEach((u) => console.log(`  ${u}`));
    return;
  }

  // Same order as the account-deletion path in controllers/user.ts: both helpers
  // are best-effort and never throw, so one unreachable object does not strand
  // the rest.
  await S3ImageService.deleteImagesByUrl(urls);
  for (const id of userIds) {
    await S3ImageService.deleteImagesByPrefix(`profile-picture/${id}/`);
  }

  console.log(`✅ Storage purged for ${users.length} accounts. Now run purge-accounts.sql.`);
}

const mode = process.argv[2] as Mode;
if (!["demo", "trainers", "all"].includes(mode)) {
  console.error("Usage: node dist/scripts/purgeAccountImages.js <demo|trainers|all> [--yes]");
  process.exit(1);
}

run(mode, process.argv.includes("--yes"))
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Failed:", err);
    process.exit(1);
  });
