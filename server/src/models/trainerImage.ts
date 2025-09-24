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
  UpdatedAt,
} from "sequelize-typescript";
import { Trainer } from "./trainer";
import {
  TrainerImageAttributes,
  TrainerImageCreationAttributes,
} from "../types/trainerImage";

@Table({
  tableName: "trainer_images",
  timestamps: true,
})
export class TrainerImage extends Model<
  TrainerImageAttributes,
  TrainerImageCreationAttributes
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
  imageUrl!: string;

  @Column(DataType.STRING(200))
  altText?: string;

  @Default(false)
  @Column(DataType.BOOLEAN)
  isPrimary!: boolean;

  @Default(0)
  @Column(DataType.INTEGER)
  displayOrder!: number;

  @CreatedAt
  createdAt!: Date;

  @UpdatedAt
  updatedAt!: Date;

  // Associations
  @BelongsTo(() => Trainer)
  trainer!: Trainer;
}
