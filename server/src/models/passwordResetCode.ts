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
} from "sequelize-typescript";
import { User } from "./user";

/**
 * A 6-digit password reset code, emailed to the user and typed into the app.
 * Only an HMAC of the code is stored; see services/passwordResetCodes.ts.
 */
@Table({
  tableName: "password_reset_codes",
  timestamps: true,
  updatedAt: false,
  indexes: [{ fields: ["user_id", "created_at"] }],
})
export class PasswordResetCode extends Model {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  id!: number;

  @ForeignKey(() => User)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER, field: "user_id" })
  userId!: number;

  @AllowNull(false)
  @Column({ type: DataType.STRING(64), field: "code_hash" })
  codeHash!: string;

  @AllowNull(false)
  @Column({ type: DataType.DATE, field: "expires_at" })
  expiresAt!: Date;

  /** Wrong guesses against this code; it stops working at the limit. */
  @Default(0)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER, field: "attempts" })
  attempts!: number;

  /** Set when the code is used, or retired by a newer one. */
  @AllowNull(true)
  @Column({ type: DataType.DATE, field: "consumed_at" })
  consumedAt?: Date | null;

  @CreatedAt
  @Column({ field: "created_at" })
  createdAt!: Date;

  @BelongsTo(() => User, { onDelete: "CASCADE" })
  user?: User;
}
