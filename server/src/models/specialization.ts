import {
  Table,
  Column,
  Model,
  DataType,
  Unique,
  AllowNull,
  Default,
  BelongsToMany,
  CreatedAt,
  UpdatedAt,
} from "sequelize-typescript";
import { Trainer } from "../models/trainer";
import {
  SpecializationAttributes,
  SpecializationCreationAttributes,
} from "../types/specialization";
import { TrainerSpecialization } from "./trainerSpecialization";

@Table({
  tableName: "specializations",
  timestamps: true,
  underscored: true,
  updatedAt: false,
})
export class Specialization extends Model<
  SpecializationAttributes,
  SpecializationCreationAttributes
> {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
  id!: number;

  @Unique
  @AllowNull(false)
  @Column(DataType.STRING(100))
  name!: string;

  @Column(DataType.TEXT)
  description?: string;

  @Column(DataType.STRING(500))
  iconUrl?: string;

  @Default(true)
  @Column(DataType.BOOLEAN)
  isActive!: boolean;

  @CreatedAt
  createdAt!: Date;

  @UpdatedAt
  updatedAt!: Date;

  // Associations
  @BelongsToMany(() => Trainer, () => TrainerSpecialization)
  trainers!: Trainer[];
}
