import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  AllowNull,
  CreatedAt,
  UpdatedAt,
} from "sequelize-typescript";
import { Trainer } from "./trainer";
import { User } from "./user";
import {
  TrainerClientAttributes,
  TrainerClientCreationAttributes,
} from "../types/trainerInvite";

@Table({
  tableName: "trainer_clients",
  timestamps: true,
  underscored: true,
  indexes: [{ unique: true, fields: ["trainer_id", "client_id"] }],
})
export class TrainerClient extends Model<
  TrainerClientAttributes,
  TrainerClientCreationAttributes
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

  @ForeignKey(() => User)
  @AllowNull(false)
  @Column(DataType.INTEGER)
  clientId!: number;

  @CreatedAt
  createdAt!: Date;

  @UpdatedAt
  updatedAt!: Date;

  @BelongsTo(() => Trainer)
  trainer!: Trainer;

  @BelongsTo(() => User)
  client!: User;
}
