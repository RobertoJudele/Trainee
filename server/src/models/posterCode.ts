import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  AllowNull,
  Default,
  Unique,
  CreatedAt,
  UpdatedAt,
} from "sequelize-typescript";
import { Gym } from "./gym";

/**
 * One printed poster campaign per gym. Counters are incremented in place and
 * there is deliberately no event log, so this table holds totals, not history —
 * see docs/superpowers/specs/2026-09-18-poster-qr-scan-counter-design.md.
 *
 * `lastScannedAt` is the one time signal kept: it costs nothing (written in the
 * same UPDATE as the increment) and is what separates a dead poster from a live
 * one.
 */
@Table({
  tableName: "poster_codes",
  timestamps: true,
})
export class PosterCode extends Model {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  id!: number;

  @Unique
  @AllowNull(false)
  @Column({ type: DataType.STRING(32), field: "code" })
  code!: string;

  /** Free-text gym name, so a gym with no `gyms` row can still be postered. */
  @AllowNull(false)
  @Column({ type: DataType.STRING(120), field: "label" })
  label!: string;

  @ForeignKey(() => Gym)
  @AllowNull(true)
  @Column({ type: DataType.INTEGER, field: "gym_id" })
  gymId?: number | null;

  @AllowNull(true)
  @Column({ type: DataType.STRING(500), field: "gym_logo_url" })
  gymLogoUrl?: string | null;

  @Default(0)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER, field: "scan_count" })
  scanCount!: number;

  @Default(0)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER, field: "apple_click_count" })
  appleClickCount!: number;

  @Default(0)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER, field: "play_click_count" })
  playClickCount!: number;

  @AllowNull(true)
  @Column({ type: DataType.DATE, field: "last_scanned_at" })
  lastScannedAt?: Date | null;

  @Default(true)
  @AllowNull(false)
  @Column({ type: DataType.BOOLEAN, field: "is_active" })
  isActive!: boolean;

  @CreatedAt
  @Column({ field: "created_at" })
  createdAt!: Date;

  @UpdatedAt
  @Column({ field: "updated_at" })
  updatedAt!: Date;

  @BelongsTo(() => Gym)
  gym?: Gym;
}
