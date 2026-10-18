import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  AllowNull,
  CreatedAt,
} from "sequelize-typescript";
import { Trainer } from "./trainer";
import { User } from "./user";

export type TrainerContactChannel = "whatsapp" | "instagram" | "facebook";

/**
 * One tap on a trainer's WhatsApp / Instagram / Facebook button in the app.
 * Every tap is kept; "distinct people" is computed when counting, by user id,
 * or by IP for a visitor who is not logged in.
 */
@Table({
  tableName: "trainer_contact_events",
  timestamps: true,
  updatedAt: false,
  indexes: [{ fields: ["trainer_id", "contact_user_id"] }],
})
export class TrainerContactEvent extends Model {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  id!: number;

  @ForeignKey(() => Trainer)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER, field: "trainer_id" })
  trainerId!: number;

  @ForeignKey(() => User)
  @AllowNull(true)
  @Column({ type: DataType.INTEGER, field: "contact_user_id" })
  contactUserId?: number | null;

  /** Only used to tell logged-out visitors apart. */
  @AllowNull(false)
  @Column({ type: DataType.STRING(64), field: "contact_ip" })
  contactIp!: string;

  @AllowNull(false)
  @Column({ type: DataType.ENUM("whatsapp", "instagram", "facebook"), field: "channel" })
  channel!: TrainerContactChannel;

  @CreatedAt
  @Column({ field: "created_at" })
  createdAt!: Date;

  @BelongsTo(() => Trainer)
  trainer?: Trainer;

  @BelongsTo(() => User)
  contactUser?: User;
}
