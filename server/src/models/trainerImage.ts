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
  TrainerImageCategory,
} from "../types/trainerImage";

@Table({
  tableName: "trainer_images",
  timestamps: true,
  updatedAt: false,
  underscored: true,
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

  // Stored as VARCHAR (not a pg ENUM) so the column can be added with a plain
  // `ALTER TABLE ... ADD COLUMN` migration — the app boots with sync({alter:false})
  // and has no migration framework. Allowed values are guarded here.
  @AllowNull(false)
  @Default("gallery")
  @Column({
    type: DataType.STRING(20),
    validate: { isIn: [["gallery", "credential"]] },
  })
  category!: TrainerImageCategory;

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
