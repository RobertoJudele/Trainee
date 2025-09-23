// src/models/index.ts
import sequelize from "../db";
import { User } from "./user";

// Initialize models
sequelize.addModels([User]);

export { User, sequelize };
