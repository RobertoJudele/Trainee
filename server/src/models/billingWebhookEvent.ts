import {
  AllowNull,
  Column,
  CreatedAt,
  DataType,
  Model,
  Table,
  UpdatedAt,
} from "sequelize-typescript";

interface BillingWebhookEventAttributes {
  id: number;
  source: string;
  eventId: string;
  eventType: string;
  appUserId?: string;
  eventTimestampMs?: number;
  payload: Record<string, unknown>;
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface BillingWebhookEventCreationAttributes {
  source: string;
  eventId: string;
  eventType: string;
  appUserId?: string;
  eventTimestampMs?: number;
  payload: Record<string, unknown>;
  processedAt?: Date;
}

@Table({
  tableName: "billing_webhook_events",
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ["source", "event_id"],
    },
  ],
})
export class BillingWebhookEvent extends Model<
  BillingWebhookEventAttributes,
  BillingWebhookEventCreationAttributes
> {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  id!: number;

  @AllowNull(false)
  @Column({ type: DataType.STRING(32) })
  source!: string;

  @AllowNull(false)
  @Column({ type: DataType.STRING(120), field: "event_id" })
  eventId!: string;

  @AllowNull(false)
  @Column({ type: DataType.STRING(80), field: "event_type" })
  eventType!: string;

  @AllowNull(true)
  @Column({ type: DataType.STRING(120), field: "app_user_id" })
  appUserId?: string;

  @AllowNull(true)
  @Column({ type: DataType.BIGINT, field: "event_timestamp_ms" })
  eventTimestampMs?: number;

  @AllowNull(false)
  @Column({ type: DataType.JSONB })
  payload!: Record<string, unknown>;

  @AllowNull(true)
  @Column({ type: DataType.DATE, field: "processed_at" })
  processedAt?: Date;

  @CreatedAt
  @Column({ field: "created_at" })
  createdAt!: Date;

  @UpdatedAt
  @Column({ field: "updated_at" })
  updatedAt!: Date;
}
