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
  @Column({ type: DataType.NUMBER })
  trainerId!: number;

  @ForeignKey(() => User)
  @Column({ type: DataType.NUMBER })
  clientId!: number;

  @AllowNull(false)
  @Validate({ min: 1, max: 5, isInt: true })
  @Column(DataType.NUMBER)
  rating!: number;

  @Validate({ len: [10, 100] })
  @Column(DataType.STRING)
  reviewText!: string;

  @Default(false)
  @Column(DataType.BOOLEAN)
  isVerified!: boolean;

  @Table({ tableName: "reviews", timestamps: true })
  @Column(DataType.BOOLEAN)
  isReported!: boolean;

  @CreatedAt createdAt?: Date;

  @UpdatedAt updatedAt?: Date;

  @BelongsTo(() => Trainer)
  trainer!: Trainer;

  @BelongsTo(() => User)
  user!: User;

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
          trainer_id: trainerId,
          review_text: { [Op.ne]: "" },
        },
      });
      const reviews = await Review.findAll({
        where: { trainer_id: trainerId },
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
