import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  AllowNull,
  Default,
  CreatedAt,
} from "sequelize-typescript";
import { Trainer } from "./trainer";
import {
  TrainerTransformationAttributes,
  TrainerTransformationCreationAttributes,
} from "../types/trainerTransformation";

export const TRANSFORMATION_DESCRIPTION_MAX = 200;

// A whole new table, so sequelize.sync({ alter: false }) creates it on boot —
// no migration step needed.
@Table({
  tableName: "trainer_transformations",
  timestamps: true,
  updatedAt: false,
  underscored: true,
})
export class TrainerTransformation extends Model<
  TrainerTransformationAttributes,
  TrainerTransformationCreationAttributes
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
  @Column(DataType.STRING(500))
  beforeImageUrl!: string;

  @AllowNull(false)
  @Column(DataType.STRING(500))
  afterImageUrl!: string;

  @AllowNull(false)
  @Column({
    type: DataType.STRING(TRANSFORMATION_DESCRIPTION_MAX),
    validate: { len: [1, TRANSFORMATION_DESCRIPTION_MAX] },
  })
  description!: string;

  @Default(0)
  @Column(DataType.INTEGER)
  displayOrder!: number;

  @CreatedAt
  createdAt!: Date;

  @BelongsTo(() => Trainer)
  trainer!: Trainer;
}
