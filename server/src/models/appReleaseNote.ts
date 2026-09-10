import {
  Table,
  Column,
  Model,
  DataType,
  AllowNull,
  Default,
  UpdatedAt,
} from "sequelize-typescript";
import {
  AppReleaseNoteAttributes,
  AppReleaseNoteCreationAttributes,
} from "../types/appReleaseNote";

/**
 * "What's new" text for a released app version, shown once after a user updates.
 *
 * One row per version, shared by both platforms — the release text is the same
 * whichever store the build came from. Lives in the database for the same reason
 * app_min_version does: the notes get written once the build is actually live,
 * and a clumsy sentence can be fixed without a rebuild.
 */
@Table({
  tableName: "app_release_notes",
  timestamps: true,
  underscored: true,
  createdAt: false,
})
export class AppReleaseNote extends Model<
  AppReleaseNoteAttributes,
  AppReleaseNoteCreationAttributes
> {
  @Column({ type: DataType.STRING(20), primaryKey: true })
  version!: string;

  @AllowNull(false)
  @Column(DataType.STRING(120))
  title!: string;

  @AllowNull(false)
  @Column(DataType.TEXT)
  body!: string;

  /** Draft rows stay invisible until this is flipped. */
  @AllowNull(false)
  @Default(false)
  @Column({ type: DataType.BOOLEAN, field: "is_published" })
  isPublished!: boolean;

  @UpdatedAt
  @Column({ field: "updated_at" })
  updatedAt?: Date;
}
