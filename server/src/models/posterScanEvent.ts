import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  AllowNull,
  CreatedAt,
} from "sequelize-typescript";
import { Gym } from "./gym";
import { PosterCode } from "./posterCode";

export type PosterScanDevice = "ios" | "android" | "other";

/**
 * One row per counted poster page view. `poster_codes.scan_count` keeps the
 * running total; this table adds the time and device dimension per gym.
 * Deliberately holds no IP, no raw user agent and no cookie.
 */
@Table({
  tableName: "poster_scan_events",
  timestamps: true,
  updatedAt: false,
  indexes: [{ fields: ["gym_id", "created_at"] }],
})
export class PosterScanEvent extends Model {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  id!: number;

  @ForeignKey(() => PosterCode)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER, field: "poster_code_id" })
  posterCodeId!: number;

  @ForeignKey(() => Gym)
  @AllowNull(true)
  @Column({ type: DataType.INTEGER, field: "gym_id" })
  gymId?: number | null;

  @AllowNull(false)
  @Column({ type: DataType.ENUM("ios", "android", "other"), field: "device" })
  device!: PosterScanDevice;

  @CreatedAt
  @Column({ field: "created_at" })
  createdAt!: Date;

  @BelongsTo(() => PosterCode)
  posterCode?: PosterCode;

  @BelongsTo(() => Gym)
  gym?: Gym;
}
