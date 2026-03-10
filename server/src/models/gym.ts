import {
  Table,
  Column,
  Model,
  DataType,
  AllowNull,
  Default,
  Validate,
  CreatedAt,
  UpdatedAt,
  HasMany,
  BelongsToMany,
} from "sequelize-typescript";
import { GymAttributes, GymCreationAttributes } from "../types/gym";
import { TrainerGym } from "./trainerGym";
import { Trainer } from "./trainer";

@Table({
  tableName: "gyms",
  timestamps: true,
})
export class Gym extends Model<GymAttributes, GymCreationAttributes> {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  id!: number;

  @AllowNull(false)
  @Validate({ len: [2, 100] })
  @Column(DataType.STRING(100))
  name!: string;

  @AllowNull(false)
  @Column(DataType.STRING(200))
  address!: string;

  @AllowNull(false)
  @Column({ type: DataType.STRING(100), field: "city" })
  city!: string;

  @Column({ type: DataType.STRING(50), field: "state" })
  state?: string;

  @Column({ type: DataType.STRING(50), field: "country" })
  country?: string;

  @AllowNull(false)
  @Column({ type: DataType.DECIMAL(10, 8), field: "latitude" })
  latitude!: number;

  @AllowNull(false)
  @Column({ type: DataType.DECIMAL(11, 8), field: "longitude" })
  longitude!: number;

  @Column({ type: DataType.STRING(20), field: "phone" })
  phone?: string;

  // Free-text hours e.g. "Mon-Fri 6:00-22:00, Sat-Sun 8:00-20:00"
  @Column({ type: DataType.STRING(300), field: "opening_hours" })
  openingHours?: string;

  @Column({ type: DataType.STRING(500), field: "image_url" })
  imageUrl?: string;

  @Default(0)
  @Column({ type: DataType.DECIMAL(3, 2), field: "rating" })
  rating!: number;

  @Default(0)
  @Column({ type: DataType.INTEGER, field: "review_count" })
  reviewCount!: number;

  @Default(true)
  @Column({ type: DataType.BOOLEAN, field: "is_active" })
  isActive!: boolean;

  @CreatedAt
  @Column({ field: "created_at" })
  createdAt!: Date;

  @UpdatedAt
  @Column({ field: "updated_at" })
  updatedAt!: Date;

  // Associations
  @HasMany(() => TrainerGym)
  trainerGyms!: TrainerGym[];

  @BelongsToMany(() => Trainer, () => TrainerGym)
  trainers!: Trainer[];
}