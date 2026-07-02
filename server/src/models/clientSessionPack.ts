import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  AllowNull,
  Default,
  Validate,
  CreatedAt,
  UpdatedAt,
} from "sequelize-typescript";
import { Trainer } from "./trainer";
import { User } from "./user";
import {
  ClientSessionPackAttributes,
  ClientSessionPackCreationAttributes,
} from "../types/clientSessionPack";

@Table({
  tableName: "client_session_packs",
  timestamps: true,
  underscored: true,
})
export class ClientSessionPack extends Model<
  ClientSessionPackAttributes,
  ClientSessionPackCreationAttributes
> {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
  id!: number;

  @ForeignKey(() => Trainer)
  @AllowNull(false)
  @Column(DataType.INTEGER)
  trainerId!: number;

  @ForeignKey(() => User)
  @AllowNull(false)
  @Column(DataType.INTEGER)
  clientId!: number;

  @AllowNull(true)
  @Validate({ len: [1, 100] })
  @Column(DataType.STRING(100))
  name!: string | null;

  @AllowNull(false)
  @Validate({ min: 1 })
  @Column(DataType.INTEGER)
  totalSessions!: number;

  @AllowNull(false)
  @Default(0)
  @Validate({ min: 0 })
  @Column(DataType.INTEGER)
  usedSessions!: number;

  @CreatedAt
  createdAt!: Date;

  @UpdatedAt
  updatedAt!: Date;

  @BelongsTo(() => Trainer)
  trainer!: Trainer;

  @BelongsTo(() => User)
  client!: User;
}
