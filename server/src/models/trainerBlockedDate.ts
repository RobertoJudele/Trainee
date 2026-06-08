import {
  AllowNull,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  ForeignKey,
  Index,
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
  @Index({ name: "trainer_blocked_date_unique", unique: true })
  @Column({ type: DataType.INTEGER, field: "trainer_id" })
  trainerId!: number;

  // Calendar day only (no time / timezone ambiguity), serialized as "YYYY-MM-DD".
  @AllowNull(false)
  @Index({ name: "trainer_blocked_date_unique", unique: true })
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
