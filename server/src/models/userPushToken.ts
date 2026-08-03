import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  AllowNull,
  Unique,
  Default,
  CreatedAt,
  UpdatedAt,
} from "sequelize-typescript";
import { User } from "./user";
import {
  UserPushTokenAttributes,
  UserPushTokenCreationAttributes,
} from "../types/notification";

// ponytail: one row per user (last device wins); multi-device tokens when someone asks.
@Table({
  tableName: "user_push_tokens",
  timestamps: true,
  underscored: true,
})
export class UserPushToken extends Model<
  UserPushTokenAttributes,
  UserPushTokenCreationAttributes
> {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
  id!: number;

  @ForeignKey(() => User)
  @AllowNull(false)
  @Unique
  @Column(DataType.INTEGER)
  userId!: number;

  @AllowNull(true)
  @Column(DataType.STRING(200))
  expoPushToken!: string | null;

  @AllowNull(false)
  @Default(true)
  @Column(DataType.BOOLEAN)
  remindersEnabled!: boolean;

  @AllowNull(false)
  @Default("en")
  @Column(DataType.STRING(5))
  locale!: string;

  @CreatedAt
  createdAt!: Date;

  @UpdatedAt
  updatedAt!: Date;

  @BelongsTo(() => User, { onDelete: "CASCADE" })
  user!: User;
}
