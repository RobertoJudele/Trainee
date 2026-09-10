import { describe, it, expect, beforeAll } from "@jest/globals";
import sequelize from "../db";
import { ensureSpatialAndSearchInfrastructure } from "../services/databaseBootstrap";

/**
 * sequelize.sync({ alter: false }) never touches an existing table, so the
 * columns Google/Apple sign-in needs are added by raw SQL in databaseBootstrap.
 * The rest of the suite builds its tables fresh from the models and therefore
 * never exercises that path -- this rewinds the schema to how production looks
 * today and checks the migration actually lands.
 */

interface ColumnRow {
  column_name: string;
  is_nullable: "YES" | "NO";
}

const usersColumns = async (): Promise<Record<string, string>> => {
  const [rows] = await sequelize.query(`
    SELECT column_name, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'users'
      AND column_name IN ('google_id', 'apple_id', 'password_hash');
  `);
  return Object.fromEntries(
    (rows as ColumnRow[]).map((r) => [r.column_name, r.is_nullable])
  );
};

const userIndexes = async (): Promise<string[]> => {
  const [rows] = await sequelize.query(`
    SELECT indexname FROM pg_indexes
    WHERE tablename = 'users'
      AND indexname IN ('idx_users_google_id', 'idx_users_apple_id');
  `);
  return (rows as Array<{ indexname: string }>).map((r) => r.indexname).sort();
};

/** Put the table back the way it looked before this feature. */
const rewindSchema = async (): Promise<void> => {
  await sequelize.query("DROP INDEX IF EXISTS idx_users_google_id;");
  await sequelize.query("DROP INDEX IF EXISTS idx_users_apple_id;");
  await sequelize.query("ALTER TABLE users DROP COLUMN IF EXISTS google_id;");
  await sequelize.query("ALTER TABLE users DROP COLUMN IF EXISTS apple_id;");
  await sequelize.query(
    "UPDATE users SET password_hash = 'legacy' WHERE password_hash IS NULL;"
  );
  await sequelize.query(
    "ALTER TABLE users ALTER COLUMN password_hash SET NOT NULL;"
  );
};

describe("social sign-in schema migration", () => {
  beforeAll(async () => {
    await rewindSchema();
  });

  it("adds the provider columns and relaxes password_hash on an existing table", async () => {
    const before = await usersColumns();
    expect(before.google_id).toBeUndefined();
    expect(before.apple_id).toBeUndefined();
    expect(before.password_hash).toBe("NO");

    await ensureSpatialAndSearchInfrastructure();

    const after = await usersColumns();
    expect(after.google_id).toBe("YES");
    expect(after.apple_id).toBe("YES");
    // Social-only accounts have no password at all.
    expect(after.password_hash).toBe("YES");
    expect(await userIndexes()).toEqual([
      "idx_users_apple_id",
      "idx_users_google_id",
    ]);
  });

  // The bootstrap runs on every boot, so a second pass must be a no-op.
  it("is idempotent across repeated boots", async () => {
    await expect(ensureSpatialAndSearchInfrastructure()).resolves.not.toThrow();
    await expect(ensureSpatialAndSearchInfrastructure()).resolves.not.toThrow();

    const after = await usersColumns();
    expect(after.google_id).toBe("YES");
    expect(after.apple_id).toBe("YES");
    expect(after.password_hash).toBe("YES");
  });

  it("keeps the provider ids unique so two accounts cannot claim one identity", async () => {
    await sequelize.query(`
      INSERT INTO users (email, first_name, last_name, role, is_verified, is_active, google_id, created_at, updated_at)
      VALUES ('dupe-a@test.com', 'A', 'One', 'client', true, true, 'shared-sub', NOW(), NOW());
    `);

    await expect(
      sequelize.query(`
        INSERT INTO users (email, first_name, last_name, role, is_verified, is_active, google_id, created_at, updated_at)
        VALUES ('dupe-b@test.com', 'B', 'Two', 'client', true, true, 'shared-sub', NOW(), NOW());
      `)
    ).rejects.toThrow();
  });

  it("allows many accounts with no provider id at all", async () => {
    // A partial-looking unique index must still permit multiple NULLs, or every
    // password-only signup after the first would fail.
    for (const email of ["null-a@test.com", "null-b@test.com"]) {
      await sequelize.query(`
        INSERT INTO users (email, first_name, last_name, role, is_verified, is_active, created_at, updated_at)
        VALUES ('${email}', 'N', 'Null', 'client', true, true, NOW(), NOW());
      `);
    }

    const [rows] = await sequelize.query(
      "SELECT COUNT(*)::int AS n FROM users WHERE google_id IS NULL AND email LIKE 'null-%';"
    );
    expect((rows as Array<{ n: number }>)[0].n).toBe(2);
  });

  it("lets a row exist with no password, which the old schema forbade", async () => {
    await sequelize.query(`
      INSERT INTO users (email, first_name, last_name, role, is_verified, is_active, apple_id, created_at, updated_at)
      VALUES ('nopassword@test.com', 'No', 'Pass', 'client', true, true, 'apple-sub-1', NOW(), NOW());
    `);

    const [rows] = await sequelize.query(
      "SELECT password_hash FROM users WHERE email = 'nopassword@test.com';"
    );
    expect((rows as Array<{ password_hash: string | null }>)[0].password_hash).toBeNull();
  });
});
