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
  underscored: true,
})
export class TrainerSpecialization extends Model<
  TrainerSpecializationAttributes,
  TrainerSpecializationCreationAttributes
> {
  @Column({
    type: DataType.UUID,
    primaryKey: true,
    defaultValue: DataType.UUIDV4,
  })
  id!: string;

  @ForeignKey(() => Trainer)
  @Column(DataType.UUID)
  trainerId!: string;

  @ForeignKey(() => Specialization)
  @Column(DataType.UUID)
  specializationId!: string;

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
