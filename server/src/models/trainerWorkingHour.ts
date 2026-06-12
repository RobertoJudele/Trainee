import {
  AllowNull,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  ForeignKey,
  Model,
  Table,
  Unique,
  UpdatedAt,
  Validate,
} from "sequelize-typescript";
import {
  TrainerWorkingHourAttributes,
  TrainerWorkingHourCreationAttributes,
} from "../types/schedule";
import { Trainer } from "./trainer";

@Table({ tableName: "trainer_working_hours", timestamps: true })
export class TrainerWorkingHour extends Model<
  TrainerWorkingHourAttributes,
  TrainerWorkingHourCreationAttributes
> {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  id!: number;

  @ForeignKey(() => Trainer)
  @AllowNull(false)
  @Unique("trainer_day_unique")
  @Column({ type: DataType.INTEGER, field: "trainer_id" })
  trainerId!: number;

  @AllowNull(false)
  @Validate({ min: 0, max: 6 })
  @Unique("trainer_day_unique")
  @Column({ type: DataType.INTEGER, field: "day_of_week" })
  dayOfWeek!: number;

  @AllowNull(false)
  @Validate({ is: /^([01]\d|2[0-3]):([0-5]\d)$/ })
  @Column({ type: DataType.STRING(5), field: "start_time" })
  startTime!: string;

  @AllowNull(false)
  @Validate({ is: /^([01]\d|2[0-3]):([0-5]\d)$/ })
  @Column({ type: DataType.STRING(5), field: "end_time" })
  endTime!: string;

  @Default(60)
  @Validate({ min: 15, max: 240 })
  @Column({ type: DataType.INTEGER, field: "slot_duration_min" })
  slotDurationMin!: number;

  @Default(true)
  @Column({ type: DataType.BOOLEAN, field: "is_active" })
  isActive!: boolean;

  @CreatedAt
  @Column({ field: "created_at" })
  createdAt!: Date;

  @UpdatedAt
  @Column({ field: "updated_at" })
  updatedAt!: Date;

  @BelongsTo(() => Trainer)
  trainer!: Trainer;
}
