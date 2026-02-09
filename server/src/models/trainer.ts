import {
  TrainerProfileAttributes,
  TrainerProfileCreationAttributes,
} from "../types/trainer";
import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  HasMany,
  BelongsToMany,
  Default,
  AllowNull,
  Validate,
  CreatedAt,
  UpdatedAt,
} from "sequelize-typescript";
import { User } from "./user";
import { TrainerSpecialization } from "./trainerSpecialization";
import { Specialization } from "./specialization";
import { TrainerImage } from "./trainerImage";
import { Review } from "./review";

@Table({
  tableName: "trainer_profiles",
  timestamps: true,
})
export class Trainer extends Model<
  TrainerProfileAttributes,
  TrainerProfileCreationAttributes
> {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  id!: number;

  @ForeignKey(() => User)
  @AllowNull(false)
  @Column({ type: DataType.INTEGER, field: "user_id" })
  userId!: number;

  @Column(DataType.STRING)
  bio?: string;

  @Validate({ min: 0, max: 50 })
  @Column({ type: DataType.INTEGER, field: "experience_years" })
  experienceYears?: number;

  @Validate({ min: 0, max: 999.99 })
  @Column({ type: DataType.DECIMAL(5, 2), field: "hourly_rate" })
  hourlyRate?: number;

  @Validate({ min: 0, max: 999.99 })
  @Column({ type: DataType.DECIMAL(5, 2), field: "session_rate" })
  sessionRate?: number;

  @Validate({ len: [2, 100] })
  @Column({ type: DataType.STRING(100), field: "location_city" })
  locationCity?: string;

  @Validate({ len: [2, 50] })
  @Column({ type: DataType.STRING(50), field: "location_state" })
  locationState?: string;

  @Validate({ len: [2, 50] })
  @Column({ type: DataType.STRING(50), field: "location_country" })
  locationCountry?: string;

  @Column({ type: DataType.DECIMAL(10, 8) })
  latitude?: number;

  @Column({ type: DataType.DECIMAL(11, 8) })
  longitude?: number;

  @Default(false)
  @Column({ type: DataType.BOOLEAN, field: "is_featured" })
  isFeatured!: boolean;

  @Default(true)
  @Column({ type: DataType.BOOLEAN, field: "is_available" })
  isAvailable!: boolean;

  @Default(0)
  @Column({ type: DataType.INTEGER, field: "profile_views" })
  profileViews!: number;

  @Default(0.0)
  @Column({ type: DataType.DECIMAL(3, 2), field: "total_rating" })
  totalRating!: number;

  @Default(0)
  @Column({ type: DataType.INTEGER, field: "review_count" })
  reviewCount!: number;

  @CreatedAt
  @Column({ field: "created_at" })
  createdAt!: Date;

  @UpdatedAt
  @Column({ field: "updated_at" })
  updatedAt!: Date;

  @BelongsTo(() => User) user!: User;

  @HasMany(() => TrainerImage) images!: TrainerImage[];

  @BelongsToMany(
    () => {
      const { Specialization } = require("./specialization");
      return Specialization;
    },
    () => {
      const { TrainerSpecialization } = require("./trainerSpecialization");
      return TrainerSpecialization;
    },
    "trainer_id"
  ) // Explicitly specify foreign key
  specializations!: any[];

  @HasMany(() => Review, { onDelete: "CASCADE", hooks: true })
  reviews!: Review[];

  @HasMany(() => TrainerSpecialization)
  trainerSpecializations!: TrainerSpecialization[];

  async incrementViews(): Promise<void> {
    this.profileViews += 1;
    await this.save();
  }

  get averageRating(): number {
    return this.reviewCount > 0 ? Number(this.totalRating) : 0;
  }

  get isComplete(): boolean {
    return !!(
      this.bio &&
      this.experienceYears !== null &&
      (this.hourlyRate || this.sessionRate) &&
      this.locationCity &&
      this.locationState
    );
  }
}
