// src/models/index.ts
import sequelize from "../db";
import { Review } from "./review";
import { Specialization } from "./specialization";
import { Trainer } from "./trainer";
import { TrainerImage } from "./trainerImage";
import { TrainerSpecialization } from "./trainerSpecialization";
import { User } from "./user";

// Initialize models - Add ALL models you imported
sequelize.addModels([
  User,
  Review,
  Trainer,
  Specialization,
  TrainerImage,
  TrainerSpecialization,
]);

// Export ALL models so they can be used in controllers
export {
  User,
  Review,
  Trainer,
  Specialization,
  TrainerImage,
  TrainerSpecialization,
  sequelize,
};
