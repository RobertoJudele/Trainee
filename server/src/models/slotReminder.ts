import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  AllowNull,
  Unique,
  CreatedAt,
  UpdatedAt,
} from "sequelize-typescript";
import { TrainerScheduleSlot } from "./trainerScheduleSlot";
import {
  SlotReminderAttributes,
  SlotReminderCreationAttributes,
} from "../types/notification";

// Dedup log: one row per slot whose reminder has been sent.
@Table({
  tableName: "slot_reminders",
  timestamps: true,
  underscored: true,
})
export class SlotReminder extends Model<
  SlotReminderAttributes,
  SlotReminderCreationAttributes
> {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
  id!: number;

  @ForeignKey(() => TrainerScheduleSlot)
  @AllowNull(false)
  @Unique
  @Column(DataType.INTEGER)
  slotId!: number;

  @CreatedAt
  createdAt!: Date;

  @UpdatedAt
  updatedAt!: Date;
}
