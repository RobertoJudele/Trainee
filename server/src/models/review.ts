import {
  AfterCreate,
  AfterDestroy,
  AfterUpdate,
  AllowNull,
  BeforeCreate,
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
import { ReviewAttributes, ReviewCreationAttributes } from "../types/review";
import { Trainer } from "./trainer";
import { User } from "./user";
import { sendError } from "../utils/response";
import { Op } from "sequelize";

@Table({ tableName: "reviews", timestamps: true })
export class Review extends Model<ReviewAttributes, ReviewCreationAttributes> {
  @Column({ type: DataType.INTEGER, primaryKey: true, autoIncrement: true })
  id!: number;

  @ForeignKey(() => Trainer)
  @Column({ type: DataType.INTEGER, field: "trainer_id" }) // Map to snake_case DB column
  trainerId!: number;

  @ForeignKey(() => User)
  @Column({ type: DataType.INTEGER, field: "client_id" }) // Map to snake_case DB column
  clientId!: number;

  @AllowNull(false)
  @Validate({ min: 1, max: 5, isInt: true })
  @Column(DataType.INTEGER) // Changed from NUMBER to INTEGER
  rating!: number;

  @Validate({ len: [10, 100] })
  @Column({ type: DataType.STRING, field: "review_text" }) // Map to snake_case DB column
  reviewText!: string;

  @Default(false)
  @Column({ type: DataType.BOOLEAN, field: "is_verified" }) // Map to snake_case DB column
  isVerified!: boolean;

  @Default(false) // Add default value
  @Column({ type: DataType.BOOLEAN, field: "is_reported" }) // Map to snake_case DB column
  isReported!: boolean;

  @CreatedAt
  @Column({ field: "created_at" }) // Map to snake_case DB column
  createdAt!: Date;

  @UpdatedAt
  @Column({ field: "updated_at" }) // Map to snake_case DB column
  updatedAt!: Date;

  @BelongsTo(() => Trainer)
  trainer!: Trainer;

  @BelongsTo(() => User, { as: "client" })
  client!: User;

  @AfterCreate
  static async updateTrainerRatingAfterCreate(instance: Review) {
    await Review.updateTrainerRating(instance.trainerId);
  }

  @AfterUpdate
  static async updateTrainerRatingAfterUpdate(instance: Review) {
    await Review.updateTrainerRating(instance.trainerId);
  }

  @AfterDestroy
  static async updateTrainerRatingAfterDestroy(instance: Review) {
    await Review.updateTrainerRating(instance.trainerId);
  }

  static async updateTrainerRating(trainerId: number) {
    try {
      const trainer = await Trainer.findByPk(trainerId);
      const rating = await Review.findAll({
        where: {
          trainerId: trainerId,
          reviewText: { [Op.ne]: "" },
        },
      });
      const reviews = await Review.findAll({
        where: { trainerId: trainerId },
      });
      if (!trainer) {
        return false;
      }
      trainer.reviewCount = reviews.length;
      trainer.totalRating = rating.length;
      await trainer.save();

      console.log("Updated Trainer after reviews");
    } catch (error) {}
  }
}
