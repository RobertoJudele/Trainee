// server/src/seeds/trainerSpecializationSeed.ts
// Run with: npm run seed:trainer-specializations

import sequelize from "../db";
import { TrainerSpecialization } from "../models/trainerSpecialization";
import { Trainer } from "../models/trainer";
import { Specialization } from "../models/specialization";
import {
  ensureDatabaseExtensions,
  ensureSpatialAndSearchInfrastructure,
} from "../services/databaseBootstrap";

const trainerSpecializations = [
  // Trainer 1 specializations
  {
    trainerId: 1,
    specializationIds: [1, 2, 5], // Strength Training, Weight Loss, HIIT
    levels: ["expert", "intermediate", "advanced"],
  },
  // Trainer 2 specializations
  {
    trainerId: 2,
    specializationIds: [3, 4, 9], // Bodybuilding, Functional Training, Sports Performance
    levels: ["expert", "intermediate", "advanced"],
  },
  // Trainer 3 specializations
  {
    trainerId: 3,
    specializationIds: [6, 7, 8], // Powerlifting, Rehabilitation, Mobility & Flexibility
    levels: ["expert", "intermediate", "expert"],
  },
  // Trainer 4 specializations
  {
    trainerId: 4,
    specializationIds: [1, 5, 9], // Strength Training, HIIT, Sports Performance
    levels: ["intermediate", "expert", "intermediate"],
  },
  // Trainer 5 specializations
  {
    trainerId: 5,
    specializationIds: [2, 8, 10], // Weight Loss, Mobility & Flexibility, Prenatal & Postnatal
    levels: ["expert", "intermediate", "beginner"],
  },
];

async function seed() {
  try {
    await sequelize.authenticate();
    console.log("✅ DB connected");

    await ensureDatabaseExtensions();
    await sequelize.sync({ alter: true });
    await ensureSpatialAndSearchInfrastructure();
    console.log("✅ Models synced");

    // Get all trainers and specializations
    const trainers = await Trainer.findAll();
    const specializations = await Specialization.findAll();

    console.log(`Found ${trainers.length} trainers and ${specializations.length} specializations`);

    let created = 0;
    let skipped = 0;

    for (const trainerSpec of trainerSpecializations) {
      const trainer = trainers.find((t) => t.id === trainerSpec.trainerId);

      if (!trainer) {
        console.log(
          `⏭️  Skip: Trainer ${trainerSpec.trainerId} not found`
        );
        skipped++;
        continue;
      }

      for (let i = 0; i < trainerSpec.specializationIds.length; i++) {
        const specializationId = trainerSpec.specializationIds[i];
        const specialization = specializations.find((s) => s.id === specializationId);

        if (!specialization) {
          console.log(`⏭️  Skip: Specialization ${specializationId} not found`);
          skipped++;
          continue;
        }

        const experienceLevel = trainerSpec.levels[i] as
          | "beginner"
          | "intermediate"
          | "expert";

        const [instance, isCreated] =
          await TrainerSpecialization.findOrCreate({
            where: {
              trainerId: trainer.id,
              specializationId: specialization.id,
            },
            defaults: {
              specializationId: specialization.id,
              experienceLevel,
              certification: `Certified ${specialization.name} Specialist`,
            },
          });

        if (isCreated) {
          console.log(
            `✅ Created: Trainer ${trainer.id} + ${specialization.name} (${experienceLevel})`
          );
          created++;
        } else {
          console.log(
            `⏭️  Exists: Trainer ${trainer.id} + ${specialization.name}`
          );
        }
      }
    }

    console.log(
      `\n✅ Trainer Specialization seed complete. Created: ${created}, Skipped: ${skipped}`
    );
    process.exit(0);
  } catch (error) {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  }
}

seed();
