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
import { User } from "./user";

@Table({ tableName: "client_check_in_codes", timestamps: true })
export class ClientCheckInCode extends Model {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  id!: number;

  @ForeignKey(() => User)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER, field: "client_id" })
  clientId!: number;

  @AllowNull(false)
  @Column({ type: DataType.STRING(256), field: "code_hash" })
  codeHash!: string;

  @AllowNull(false)
  @Column({ type: DataType.DATE, field: "expires_at" })
  expiresAt!: Date;

  @AllowNull(true)
  @Column({ type: DataType.DATE, field: "consumed_at" })
  consumedAt?: Date | null;

  @ForeignKey(() => User)
  @AllowNull(true)
  @Column({ type: DataType.INTEGER, field: "consumed_by_user_id" })
  consumedByUserId?: number | null;

  @CreatedAt
  @Column({ field: "created_at" })
  createdAt!: Date;

  @UpdatedAt
  @Column({ field: "updated_at" })
  updatedAt!: Date;

  @BelongsTo(() => User, { as: "client" })
  client!: User;

  @BelongsTo(() => User, { as: "consumedByUser" })
  consumedByUser?: User;
}
