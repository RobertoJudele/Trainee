import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  CreatedAt,
} from "sequelize-typescript";
import { Trainer } from "./trainer";
import { Specialization } from "./specialization";
import {
  TrainerSpecializationAttributes,
  TrainerSpecializationCreationAttributes,
} from "../types/trainerSpecialization";

@Table({
  tableName: "trainer_specializations",
  timestamps: true,
  updatedAt: false,
})
export class TrainerSpecialization extends Model<
  TrainerSpecializationAttributes,
  TrainerSpecializationCreationAttributes
> {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
  id!: number;

  @ForeignKey(() => Trainer)
  @Column(DataType.INTEGER)
  trainerId!: number;

  @ForeignKey(() => Specialization)
  @Column(DataType.INTEGER)
  specializationId!: number;

  @Column(DataType.ENUM("beginner", "intermediate", "expert"))
  experienceLevel!: "beginner" | "intermediate" | "expert";

  @Column(DataType.STRING(200))
  certification?: string;

  @CreatedAt
  createdAt!: Date;

  // Associations
  @BelongsTo(() => Trainer)
  trainer!: Trainer;

  @BelongsTo(() => Specialization)
  specialization!: Specialization;
}
