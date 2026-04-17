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
import { User } from "./user";

export type ProfileViewSourceType = "search" | "map" | "direct" | "other";

@Table({
  tableName: "profile_view_events",
  timestamps: true,
})
export class ProfileViewEvent extends Model {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  id!: number;

  @ForeignKey(() => Trainer)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER, field: "trainer_id" })
  trainerId!: number;

  @ForeignKey(() => User)
  @AllowNull(true)
  @Column({ type: DataType.INTEGER, field: "viewer_user_id" })
  viewerUserId?: number | null;

  @AllowNull(false)
  @Column({ type: DataType.STRING(64), field: "viewer_ip_address" })
  viewerIpAddress!: string;

  @AllowNull(true)
  @Column({ type: DataType.STRING(512), field: "viewer_user_agent" })
  viewerUserAgent?: string | null;

  @AllowNull(true)
  @Column({ type: DataType.STRING(1024), field: "referrer_url" })
  referrerUrl?: string | null;

  @Default("other")
  @Column({
    type: DataType.ENUM("search", "map", "direct", "other"),
    field: "source_type",
  })
  sourceType!: ProfileViewSourceType;

  @AllowNull(true)
  @Column({ type: DataType.DATE, field: "viewed_at" })
  viewedAt?: Date | null;

  @CreatedAt
  @Column({ field: "created_at" })
  createdAt!: Date;

  @UpdatedAt
  @Column({ field: "updated_at" })
  updatedAt!: Date;

  @BelongsTo(() => Trainer)
  trainer!: Trainer;

  @BelongsTo(() => User)
  viewerUser?: User;
}
