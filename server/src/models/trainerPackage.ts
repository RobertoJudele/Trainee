import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  AllowNull,
  Default,
  Validate,
  CreatedAt,
  UpdatedAt,
} from "sequelize-typescript";
import { Trainer } from "./trainer";
import {
  TrainerPackageAttributes,
  TrainerPackageCreationAttributes,
} from "../types/trainerPackage";

@Table({
  tableName: "trainer_packages",
  timestamps: true,
  underscored: true,
})
export class TrainerPackage extends Model<
  TrainerPackageAttributes,
  TrainerPackageCreationAttributes
> {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
  id!: number;

  @ForeignKey(() => Trainer)
  @AllowNull(false)
  @Column(DataType.INTEGER)
  trainerId!: number;

  @AllowNull(false)
  @Validate({ len: [1, 100] })
  @Column(DataType.STRING(100))
  name!: string;

  @AllowNull(false)
  @Validate({ min: 0.01 })
  @Column(DataType.DECIMAL(7, 2))
  price!: number;

  @AllowNull(false)
  @Validate({ min: 1 })
  @Column(DataType.INTEGER)
  sessionCount!: number;

  @Default(0)
  @Column(DataType.INTEGER)
  sortOrder!: number;

  @CreatedAt
  createdAt!: Date;

  @UpdatedAt
  updatedAt!: Date;

  @BelongsTo(() => Trainer)
  trainer!: Trainer;
}
