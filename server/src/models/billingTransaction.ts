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
import { Trainer } from "./trainer";

export interface BillingTransactionAttributes {
  id: number;
  trainerId: number;
  amount: number;
  currency: string;
  status: string;
  provider: string;
  transactionId: string;
  productId: string;
  paidAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface BillingTransactionCreationAttributes {
  trainerId: number;
  amount: number;
  currency: string;
  status: string;
  provider: string;
  transactionId: string;
  productId: string;
  paidAt: Date;
}

@Table({
  tableName: "billing_transactions",
  timestamps: true,
  underscored: true,
})
export class BillingTransaction extends Model<
  BillingTransactionAttributes,
  BillingTransactionCreationAttributes
> {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
  id!: number;

  @ForeignKey(() => Trainer)
  @AllowNull(false)
  @Column({
    type: DataType.INTEGER,
    field: "trainer_id",
  })
  trainerId!: number;

  @AllowNull(false)
  @Column(DataType.DECIMAL(10, 2))
  amount!: number;

  @AllowNull(false)
  @Column(DataType.STRING(10))
  currency!: string;

  @AllowNull(false)
  @Column(DataType.STRING(32))
  status!: string;

  @AllowNull(false)
  @Column(DataType.STRING(32))
  provider!: string;

  @AllowNull(false)
  @Column({
    type: DataType.STRING(120),
    field: "transaction_id",
  })
  transactionId!: string;

  @AllowNull(false)
  @Column({
    type: DataType.STRING(120),
    field: "product_id",
  })
  productId!: string;

  @AllowNull(false)
  @Column({
    type: DataType.DATE,
    field: "paid_at",
  })
  paidAt!: Date;

  @CreatedAt
  createdAt!: Date;

  @UpdatedAt
  updatedAt!: Date;

  // Associations
  @BelongsTo(() => Trainer)
  trainer!: Trainer;
}
