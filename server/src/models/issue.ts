import {
  AllowNull,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  ForeignKey,
  Model,
  Table,
  UpdatedAt,
  Validate,
} from "sequelize-typescript";
import {
  IssueAttributes,
  IssueCategory,
  IssueCreationAttributes,
  IssueStatus,
  IssueTargetType,
} from "../types/issue";
import { User } from "./user";
import { Trainer } from "./trainer";

@Table({ tableName: "issues", timestamps: true })
export class Issue extends Model<IssueAttributes, IssueCreationAttributes> {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  id!: number;

  @ForeignKey(() => User)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER, field: "reporter_id" })
  reporterId!: number;

  @ForeignKey(() => Trainer)
  @AllowNull(true)
  @Column({ type: DataType.INTEGER, field: "trainer_id" })
  trainerId?: number;

  @AllowNull(true)
  @Column({ type: DataType.INTEGER, field: "booking_id" })
  bookingId?: number;

  @AllowNull(false)
  @Validate({ isIn: [Object.values(IssueTargetType)] })
  @Column({
    type: DataType.ENUM(...Object.values(IssueTargetType)),
    field: "target_type",
  })
  targetType!: IssueTargetType;

  @AllowNull(false)
  @Validate({ isIn: [Object.values(IssueCategory)] })
  @Column({ type: DataType.ENUM(...Object.values(IssueCategory)) })
  category!: IssueCategory;

  @AllowNull(false)
  @Validate({ len: [5, 140] })
  @Column({ type: DataType.STRING(140) })
  title!: string;

  @AllowNull(false)
  @Validate({ len: [10, 2000] })
  @Column({ type: DataType.TEXT })
  description!: string;

  @AllowNull(true)
  @Column({ type: DataType.JSONB })
  metadata?: Record<string, unknown>;

  @Default(IssueStatus.OPEN)
  @Validate({ isIn: [Object.values(IssueStatus)] })
  @Column({ type: DataType.ENUM(...Object.values(IssueStatus)) })
  status!: IssueStatus;

  @AllowNull(true)
  @Validate({ len: [0, 1000] })
  @Column({ type: DataType.TEXT, field: "resolution_note" })
  resolutionNote?: string;

  @AllowNull(true)
  @Column({ type: DataType.DATE, field: "resolved_at" })
  resolvedAt?: Date;

  @ForeignKey(() => User)
  @AllowNull(true)
  @Column({ type: DataType.INTEGER, field: "resolved_by" })
  resolvedBy?: number;

  @CreatedAt
  @Column({ field: "created_at" })
  createdAt!: Date;

  @UpdatedAt
  @Column({ field: "updated_at" })
  updatedAt!: Date;

  @BelongsTo(() => User, { as: "reporter" })
  reporter!: User;

  @BelongsTo(() => User, { as: "resolver" })
  resolver?: User;

  @BelongsTo(() => Trainer)
  trainer?: Trainer;
}
