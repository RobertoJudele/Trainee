import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  Default,
  Unique,
  CreatedAt,
  UpdatedAt,
  Validate,
} from "sequelize-typescript";
import { User } from "./user";
import { Gym } from "./gym";
import {
  ClientPreferenceAttributes,
  ClientPreferenceCreationAttributes,
} from "../types/clientPreference";

@Table({
  tableName: "client_preferences",
  timestamps: true,
})
export class ClientPreference extends Model<
  ClientPreferenceAttributes,
  ClientPreferenceCreationAttributes
> {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  id!: number;

  @ForeignKey(() => User)
  @Unique
  @Column({ type: DataType.INTEGER, field: "user_id" })
  userId!: number;

  @Default([])
  @Column({ type: DataType.ARRAY(DataType.INTEGER), field: "preferred_specialization_ids" })
  preferredSpecializationIds!: number[];

  @Default([])
  @Column({ type: DataType.ARRAY(DataType.STRING), field: "goals" })
  goals!: string[];

  @Column({ type: DataType.ENUM("beginner", "intermediate", "expert"), field: "fitness_level" })
  fitnessLevel?: "beginner" | "intermediate" | "expert" | null;

  @Validate({ min: 0, max: 999.99 })
  @Column({ type: DataType.DECIMAL(5, 2), field: "budget_min" })
  budgetMin?: number | null;

  @Validate({ min: 0, max: 999.99 })
  @Column({ type: DataType.DECIMAL(5, 2), field: "budget_max" })
  budgetMax?: number | null;

  @Default("session")
  @Column({ type: DataType.ENUM("hourly", "session"), field: "preferred_rate_type" })
  preferredRateType!: "hourly" | "session";

  @Validate({ min: 0, max: 500 })
  @Column({ type: DataType.DECIMAL(6, 2), field: "max_distance_km" })
  maxDistanceKm?: number | null;

  @ForeignKey(() => Gym)
  @Column({ type: DataType.INTEGER, field: "preferred_gym_id" })
  preferredGymId?: number | null;

  @CreatedAt
  @Column({ field: "created_at" })
  createdAt!: Date;

  @UpdatedAt
  @Column({ field: "updated_at" })
  updatedAt!: Date;

  @BelongsTo(() => User)
  user!: User;

  @BelongsTo(() => Gym)
  gym?: Gym;
}
