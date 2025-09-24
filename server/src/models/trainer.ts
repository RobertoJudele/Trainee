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
  @Column({ type: DataType.INTEGER })
  userId!: number;

  @Column(DataType.STRING) bio?: string;
  @Validate({
    min: 0,
    max: 50,
  })
  @Column(DataType.INTEGER)
  experienceYears?: number;

  @Validate({
    min: 0,
    max: 999.99,
  })
  @Column(DataType.DECIMAL(5, 2))
  hourlyRate?: number;

  @Validate({
    min: 0,
    max: 999.99,
  })
  @Column(DataType.DECIMAL(5, 2))
  sessionRate?: number;

  @Validate({
    len: [2, 100],
  })
  @Column(DataType.STRING(100))
  locationCity?: string;

  @Validate({
    len: [2, 50],
  })
  @Column(DataType.STRING(50))
  locationState?: string;

  @Validate({
    len: [2, 50],
  })
  @Column(DataType.STRING(50))
  locationCountry?: string;

  @Validate({
    min: -90,
    max: 90,
  })
  @Column(DataType.DECIMAL(10, 8))
  latitude?: number;

  @Validate({
    min: -180,
    max: 180,
  })
  @Column(DataType.DECIMAL(11, 8))
  longitude?: number;

  @Default(true)
  @Column(DataType.BOOLEAN)
  isActive!: boolean;

  @Default(false)
  @Column(DataType.BOOLEAN)
  isFeatured!: boolean;

  @Default(true)
  @Column(DataType.BOOLEAN)
  isAvailable!: boolean;

  @Default(0)
  @Column(DataType.INTEGER)
  profileViews!: number;

  @Default(0.0)
  @Column(DataType.DECIMAL(3, 2))
  totalRating!: number;

  @Default(0)
  @Column(DataType.INTEGER)
  reviewCount!: number;

  @CreatedAt
  createdAt!: Date;

  @UpdatedAt
  updatedAt!: Date;

  @BelongsTo(() => User) user!: User;

  @HasMany(() => TrainerImage) image!: TrainerImage[];

  @BelongsToMany(() => Specialization, () => TrainerSpecialization)
  specializations!: Specialization[];

  @HasMany(() => Review) reviews!: Review[];

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
