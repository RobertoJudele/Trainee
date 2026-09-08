import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  Default,
  CreatedAt,
  UpdatedAt,
} from "sequelize-typescript";
import { Trainer } from "./trainer";
import { Gym } from "./gym";
import { User } from "./user";
import {
  GymStaffStatus,
  TrainerGymAttributes,
  TrainerGymCreationAttributes,
} from "../types/gym";

@Table({
  tableName: "trainer_gyms",
  timestamps: true,
  underscored: true,
})
export class TrainerGym extends Model<
  TrainerGymAttributes,
  TrainerGymCreationAttributes
> {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  id!: number;

  @ForeignKey(() => Trainer)
  @Column({ type: DataType.INTEGER, field: "trainer_id" })
  trainerId!: number;

  @ForeignKey(() => Gym)
  @Column({ type: DataType.INTEGER, field: "gym_id" })
  gymId!: number;

  @Default(true)
  @Column({ type: DataType.BOOLEAN, field: "is_available" })
  isAvailable!: boolean;

  // Gym-staff affiliation. The trainer requests it; an admin approves.
  // Only "approved" affects ordering or client-visible rendering.
  @Default("none")
  @Column({
    type: DataType.ENUM("none", "pending", "approved", "rejected"),
    field: "staff_status",
  })
  staffStatus!: GymStaffStatus;

  @Column({ type: DataType.DATE, field: "staff_requested_at", allowNull: true })
  staffRequestedAt!: Date | null;

  @Column({ type: DataType.DATE, field: "staff_reviewed_at", allowNull: true })
  staffReviewedAt!: Date | null;

  @ForeignKey(() => User)
  @Column({ type: DataType.INTEGER, field: "staff_reviewed_by", allowNull: true })
  staffReviewedBy!: number | null;

  @CreatedAt
  @Column({ field: "created_at" })
  createdAt!: Date;

  @UpdatedAt
  @Column({ field: "updated_at" })
  updatedAt!: Date;

  // Associations
  @BelongsTo(() => Trainer)
  trainer!: Trainer;

  @BelongsTo(() => Gym)
  gym!: Gym;
}