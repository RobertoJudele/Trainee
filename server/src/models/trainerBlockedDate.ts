import {
  AllowNull,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  ForeignKey,
  Model,
  Table,
  UpdatedAt,
} from "sequelize-typescript";
import {
  TrainerBlockedDateAttributes,
  TrainerBlockedDateCreationAttributes,
} from "../types/schedule";
import { Trainer } from "./trainer";

@Table({ tableName: "trainer_blocked_dates", timestamps: true })
export class TrainerBlockedDate extends Model<
  TrainerBlockedDateAttributes,
  TrainerBlockedDateCreationAttributes
> {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  id!: number;

  @ForeignKey(() => Trainer)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER, field: "trainer_id" })
  trainerId!: number;

  // Calendar day only (no time / timezone ambiguity), serialized as "YYYY-MM-DD".
  // The composite unique index (trainer_id, date) is created in databaseBootstrap.ts
  // with the correct snake_case column names.
  @AllowNull(false)
  @Column({ type: DataType.DATEONLY })
  date!: string;

  @AllowNull(true)
  @Column({ type: DataType.STRING(255) })
  reason?: string | null;

  @CreatedAt
  @Column({ field: "created_at" })
  createdAt!: Date;

  @UpdatedAt
  @Column({ field: "updated_at" })
  updatedAt!: Date;

  @BelongsTo(() => Trainer, { onDelete: "CASCADE" })
  trainer!: Trainer;
}
