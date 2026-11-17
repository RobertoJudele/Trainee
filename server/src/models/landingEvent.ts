import { Table, Column, Model, DataType, AllowNull, CreatedAt } from "sequelize-typescript";

export type LandingEventKind = "visit" | "click";
export type LandingEventTarget = "ios" | "android" | "instagram";
export type LandingEventDevice = "ios" | "android" | "other";

/**
 * One row per counted view of, or click on, the trainer landing page
 * (/antrenori). Like poster_scan_events it holds no IP, no raw user agent and
 * no cookie: repeat filtering happens in memory (services/landingCounting.ts).
 */
@Table({
  tableName: "landing_events",
  timestamps: true,
  updatedAt: false,
  indexes: [{ fields: ["created_at"] }],
})
export class LandingEvent extends Model {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  id!: number;

  @AllowNull(false)
  @Column({ type: DataType.ENUM("visit", "click"), field: "kind" })
  kind!: LandingEventKind;

  /** What was clicked; null for a visit. */
  @AllowNull(true)
  @Column({ type: DataType.ENUM("ios", "android", "instagram"), field: "target" })
  target?: LandingEventTarget | null;

  /** Where on the page the click came from: top, bottom, faq or footer. */
  @AllowNull(true)
  @Column({ type: DataType.STRING(16), field: "position" })
  position?: string | null;

  /** The ?src= tag of the link that brought the visitor (ig, tt, ...). */
  @AllowNull(true)
  @Column({ type: DataType.STRING(24), field: "source" })
  source?: string | null;

  @AllowNull(false)
  @Column({ type: DataType.ENUM("ios", "android", "other"), field: "device" })
  device!: LandingEventDevice;

  @CreatedAt
  @Column({ field: "created_at" })
  createdAt!: Date;
}
