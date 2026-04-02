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
  UpdatedAt,
  Validate,
} from "sequelize-typescript";
import {
  SlotStatus,
  TrainerScheduleSlotAttributes,
  TrainerScheduleSlotCreationAttributes,
} from "../types/schedule";
import { Trainer } from "./trainer";
import { User } from "./user";
import { TrainerWorkingHour } from "./trainerWorkingHour";

@Table({ tableName: "trainer_schedule_slots", timestamps: true })
export class TrainerScheduleSlot extends Model<
  TrainerScheduleSlotAttributes,
  TrainerScheduleSlotCreationAttributes
> {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  id!: number;

  @ForeignKey(() => Trainer)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER, field: "trainer_id" })
  trainerId!: number;

  @ForeignKey(() => User)
  @AllowNull(true)
  @Column({ type: DataType.INTEGER, field: "client_id" })
  clientId?: number;

  @ForeignKey(() => TrainerWorkingHour)
  @AllowNull(true)
  @Column({ type: DataType.INTEGER, field: "working_hour_id" })
  workingHourId?: number;

  @AllowNull(false)
  @Column({ type: DataType.DATE, field: "starts_at" })
  startsAt!: Date;

  @AllowNull(false)
  @Column({ type: DataType.DATE, field: "ends_at" })
  endsAt!: Date;

  @Default(SlotStatus.AVAILABLE)
  @Validate({ isIn: [Object.values(SlotStatus)] })
  @Column({ type: DataType.ENUM(...Object.values(SlotStatus)) })
  status!: SlotStatus;

  @AllowNull(true)
  @Validate({ len: [0, 500] })
  @Column({ type: DataType.STRING(500) })
  note?: string;

  @AllowNull(true)
  @Column({ type: DataType.STRING(256), field: "check_in_code_hash" })
  checkInCodeHash?: string | null;

  @AllowNull(true)
  @Column({ type: DataType.DATE, field: "check_in_code_expires_at" })
  checkInCodeExpiresAt?: Date | null;

  @Default(0)
  @Column({ type: DataType.INTEGER, field: "check_in_attempts" })
  checkInAttempts!: number;

  @AllowNull(true)
  @Column({ type: DataType.DATE, field: "checked_in_at" })
  checkedInAt?: Date | null;

  @CreatedAt
  @Column({ field: "created_at" })
  createdAt!: Date;

  @UpdatedAt
  @Column({ field: "updated_at" })
  updatedAt!: Date;

  @BelongsTo(() => Trainer)
  trainer!: Trainer;

  @BelongsTo(() => User, { as: "client" })
  client?: User;

  @BelongsTo(() => TrainerWorkingHour)
  workingHour?: TrainerWorkingHour;
}
