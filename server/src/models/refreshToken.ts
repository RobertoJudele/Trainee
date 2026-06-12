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
import { User } from "./user";

export interface RefreshTokenAttributes {
  id: number;
  token: string;
  userId: number;
  expiresAt: Date;
  isRevoked: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface RefreshTokenCreationAttributes {
  token: string;
  userId: number;
  expiresAt: Date;
  isRevoked?: boolean;
}

@Table({
  tableName: "refresh_tokens",
  timestamps: true,
})
export class RefreshToken extends Model<RefreshTokenAttributes, RefreshTokenCreationAttributes> {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
  id!: number;

  @Column({
    type: DataType.STRING(255),
    allowNull: false,
    unique: true,
  })
  token!: string;

  @ForeignKey(() => User)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: "user_id",
  })
  userId!: number;

  @BelongsTo(() => User, { onDelete: "CASCADE" })
  user!: User;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    field: "expires_at",
  })
  expiresAt!: Date;

  @Default(false)
  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    field: "is_revoked",
  })
  isRevoked!: boolean;

  @CreatedAt
  @Column({
    field: "created_at",
  })
  createdAt!: Date;

  @UpdatedAt
  @Column({
    field: "updated_at",
  })
  updatedAt!: Date;
}
