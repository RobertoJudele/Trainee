import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  AllowNull,
  CreatedAt,
  UpdatedAt,
} from "sequelize-typescript";
import { User } from "./user";

export interface UserBlockAttributes {
  id: number;
  blockerId: number;
  blockedId: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserBlockCreationAttributes {
  blockerId: number;
  blockedId: number;
}

@Table({ tableName: "user_blocks", timestamps: true })
export class UserBlock extends Model<UserBlockAttributes, UserBlockCreationAttributes> {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  id!: number;

  @ForeignKey(() => User)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER, field: "blocker_id" })
  blockerId!: number;

  @ForeignKey(() => User)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER, field: "blocked_id" })
  blockedId!: number;

  @CreatedAt
  @Column({ field: "created_at" })
  createdAt!: Date;

  @UpdatedAt
  @Column({ field: "updated_at" })
  updatedAt!: Date;

  @BelongsTo(() => User, { as: "blocker", foreignKey: "blockerId" })
  blocker!: User;

  @BelongsTo(() => User, { as: "blocked", foreignKey: "blockedId" })
  blocked!: User;
}
