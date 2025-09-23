// src/models/User.ts
import {
  Table,
  Column,
  Model,
  DataType,
  Unique,
  AllowNull,
  Default,
  Validate,
  CreatedAt,
  UpdatedAt,
} from "sequelize-typescript";
import bcrypt from "bcryptjs";
import { UserAttributes, UserCreationAttributes } from "../types/user";
import { UserRole } from "../types/common";

@Table({
  tableName: "users",
  timestamps: true,
  hooks: {
    beforeCreate: async (instance: User) => {
      if (instance.password) {
        const rounds = parseInt(process.env.BCRYPT_ROUNDS || "12");
        instance.password = await bcrypt.hash(instance.password, rounds);
      }
    },
    beforeUpdate: async (instance: User) => {
      if (instance.changed("password")) {
        const rounds = parseInt(process.env.BCRYPT_ROUNDS || "12");
        instance.password = await bcrypt.hash(instance.password, rounds);
      }
    },
  },
})
export class User extends Model<UserAttributes, UserCreationAttributes> {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
  id!: number;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    validate: {
      isEmail: true,
    },
  })
  email!: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    field: 'password_hash', // Map to actual database column
    validate: {
      len: [6, 100],
    },
  })
  password!: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    field: 'first_name', // Map to actual database column
    validate: {
      len: [2, 50],
    },
  })
  firstName!: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    field: 'last_name', // Map to actual database column
    validate: {
      len: [2, 50],
    },
  })
  lastName!: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    validate: {
      len: [10, 15],
    },
  })
  phone?: string;

  @Column({
    type: DataType.STRING, // Use STRING instead of ENUM since your DB has string
    allowNull: false,
    defaultValue: 'client',
  })
  role!: UserRole;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    field: 'profile_image_url', // Map to actual database column
    validate: {
      isUrl: true,
    },
  })
  profileImageUrl?: string;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'is_verified', // Map to actual database column
  })
  isVerified!: boolean;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: 'is_active', // Map to actual database column
  })
  isActive!: boolean;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'last_login_at', // Map to actual database column if it exists
  })
  lastLoginAt?: Date;

  @CreatedAt
  @Column({
    field: 'created_at', // Map to actual database column
  })
  createdAt!: Date;

  @UpdatedAt
  @Column({
    field: 'updated_at', // Map to actual database column
  })
  updatedAt!: Date;


  // Instance method to compare password
  async comparePassword(candidatePassword: string): Promise<boolean> {
    return bcrypt.compare(candidatePassword, this.password);
  }

  // Remove password from JSON output
  toJSON(): Omit<UserAttributes, "password"> {
    const values = Object.assign({}, this.get());
    delete values.password;
    return values;
  }
}
