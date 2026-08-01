import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  AllowNull,
  Unique,
  CreatedAt,
  UpdatedAt,
} from "sequelize-typescript";
import { Trainer } from "./trainer";
import {
  TrainerInviteCodeAttributes,
  TrainerInviteCodeCreationAttributes,
} from "../types/trainerInvite";

@Table({
  tableName: "trainer_invite_codes",
  timestamps: true,
  underscored: true,
})
export class TrainerInviteCode extends Model<
  TrainerInviteCodeAttributes,
  TrainerInviteCodeCreationAttributes
> {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
  id!: number;

  @ForeignKey(() => Trainer)
  @AllowNull(false)
  @Unique
  @Column(DataType.INTEGER)
  trainerId!: number;

  @AllowNull(false)
  @Unique
  @Column(DataType.STRING(12))
  code!: string;

  @CreatedAt
  createdAt!: Date;

  @UpdatedAt
  updatedAt!: Date;

  @BelongsTo(() => Trainer)
  trainer!: Trainer;
}
