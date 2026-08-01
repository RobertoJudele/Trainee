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
  AppMinVersionAttributes,
  AppMinVersionCreationAttributes,
} from "../types/appMinVersion";

@Table({
  tableName: "app_min_version",
  timestamps: true,
  underscored: true,
  createdAt: false,
})
export class AppMinVersion extends Model<
  AppMinVersionAttributes,
  AppMinVersionCreationAttributes
> {
  @Column({
    type: DataType.STRING(20),
    primaryKey: true,
  })
  platform!: string;

  @AllowNull(false)
  @Column(DataType.STRING(20))
  minVersion!: string;

  @AllowNull(false)
  @Column(DataType.STRING(500))
  storeUrl!: string;

  @AllowNull(false)
  @Default("")
  @Column(DataType.TEXT)
  message!: string;

  @UpdatedAt
  updatedAt!: Date;
}
