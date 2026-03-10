import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  Default,
  CreatedAt,
  UpdatedAt,
} from "sequelize-typescript";
import { Trainer } from "./trainer";
import { Gym } from "./gym";
import { TrainerGymAttributes, TrainerGymCreationAttributes } from "../types/gym";

@Table({
  tableName: "trainer_gyms",
  timestamps: true,
  underscored: true,
})
export class TrainerGym extends Model<
  TrainerGymAttributes,
  TrainerGymCreationAttributes
> {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  id!: number;

  @ForeignKey(() => Trainer)
  @Column({ type: DataType.INTEGER, field: "trainer_id" })
  trainerId!: number;

  @ForeignKey(() => Gym)
  @Column({ type: DataType.INTEGER, field: "gym_id" })
  gymId!: number;

  @Default(true)
  @Column({ type: DataType.BOOLEAN, field: "is_available" })
  isAvailable!: boolean;

  @CreatedAt
  @Column({ field: "created_at" })
  createdAt!: Date;

  @UpdatedAt
  @Column({ field: "updated_at" })
  updatedAt!: Date;

  // Associations
  @BelongsTo(() => Trainer)
  trainer!: Trainer;

  @BelongsTo(() => Gym)
  gym!: Gym;
}