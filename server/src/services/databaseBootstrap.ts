import sequelize from "../db";

export const ensureDatabaseExtensions = async (): Promise<void> => {
  await sequelize.query('CREATE EXTENSION IF NOT EXISTS "postgis";');
  await sequelize.query('CREATE EXTENSION IF NOT EXISTS "pg_trgm";');
};

export const ensureSpatialAndSearchInfrastructure = async (): Promise<void> => {
  // Drop erroneous old unique constraint on working hours
  await sequelize.query(
    "ALTER TABLE trainer_working_hours DROP CONSTRAINT IF EXISTS trainer_working_hours_day_of_week_key;"
  ).catch((err) => console.warn("Could not drop constraint, it may not exist:", err.message));

  // Spatial columns
  await sequelize.query(
    "ALTER TABLE gyms ADD COLUMN IF NOT EXISTS location geometry(Point, 4326);"
  );
  await sequelize.query(
    "ALTER TABLE trainer_profiles ADD COLUMN IF NOT EXISTS location geometry(Point, 4326);"
  );

  // Backfill PostGIS geometry from legacy decimal columns
  await sequelize.query(`
    UPDATE gyms
    SET location = ST_SetSRID(ST_MakePoint(longitude::double precision, latitude::double precision), 4326)
    WHERE location IS NULL
      AND latitude IS NOT NULL
      AND longitude IS NOT NULL;
  `);

  await sequelize.query(`
    UPDATE trainer_profiles
    SET location = ST_SetSRID(ST_MakePoint(longitude::double precision, latitude::double precision), 4326)
    WHERE location IS NULL
      AND latitude IS NOT NULL
      AND longitude IS NOT NULL;
  `);

  // Keep legacy decimal columns filled if location already exists
  await sequelize.query(`
    UPDATE gyms
    SET latitude = ROUND(ST_Y(location)::numeric, 8),
        longitude = ROUND(ST_X(location)::numeric, 8)
    WHERE location IS NOT NULL
      AND (latitude IS NULL OR longitude IS NULL);
  `);

  await sequelize.query(`
    UPDATE trainer_profiles
    SET latitude = ROUND(ST_Y(location)::numeric, 8),
        longitude = ROUND(ST_X(location)::numeric, 8)
    WHERE location IS NOT NULL
      AND (latitude IS NULL OR longitude IS NULL);
  `);

  // Spatial proximity indexes
  await sequelize.query(
    "CREATE INDEX IF NOT EXISTS idx_gyms_location_gist ON gyms USING GIST (location);"
  );
  await sequelize.query(
    "CREATE INDEX IF NOT EXISTS idx_trainer_profiles_location_gist ON trainer_profiles USING GIST (location);"
  );

  // ILIKE acceleration via trigram GIN indexes
  await sequelize.query(
    "CREATE INDEX IF NOT EXISTS idx_trainer_profiles_bio_trgm ON trainer_profiles USING GIN (bio gin_trgm_ops);"
  );
  await sequelize.query(
    "CREATE INDEX IF NOT EXISTS idx_trainer_profiles_public_id_trgm ON trainer_profiles USING GIN ((public_id::text) gin_trgm_ops);"
  );
  await sequelize.query(
    "CREATE INDEX IF NOT EXISTS idx_trainer_profiles_location_city_trgm ON trainer_profiles USING GIN (location_city gin_trgm_ops);"
  );
  await sequelize.query(
    "CREATE INDEX IF NOT EXISTS idx_trainer_profiles_location_state_trgm ON trainer_profiles USING GIN (location_state gin_trgm_ops);"
  );
  await sequelize.query(
    "CREATE INDEX IF NOT EXISTS idx_trainer_profiles_location_country_trgm ON trainer_profiles USING GIN (location_country gin_trgm_ops);"
  );
  await sequelize.query(
    "CREATE INDEX IF NOT EXISTS idx_users_email_trgm ON users USING GIN (email gin_trgm_ops);"
  );
  await sequelize.query(
    "CREATE INDEX IF NOT EXISTS idx_users_first_name_trgm ON users USING GIN (first_name gin_trgm_ops);"
  );
  await sequelize.query(
    "CREATE INDEX IF NOT EXISTS idx_users_last_name_trgm ON users USING GIN (last_name gin_trgm_ops);"
  );

  // Create billing_transactions table if not exists
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS billing_transactions (
      id SERIAL PRIMARY KEY,
      trainer_id INTEGER NOT NULL REFERENCES trainer_profiles(id) ON DELETE CASCADE,
      amount DECIMAL(10, 2) NOT NULL,
      currency VARCHAR(10) NOT NULL,
      status VARCHAR(32) NOT NULL,
      provider VARCHAR(32) NOT NULL,
      transaction_id VARCHAR(120) NOT NULL,
      product_id VARCHAR(120) NOT NULL,
      paid_at TIMESTAMP WITH TIME ZONE NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL
    );
  `);

  await sequelize.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_transactions_provider_tx_id 
    ON billing_transactions (provider, transaction_id);
  `);

  // Create refresh_tokens table if not exists
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id SERIAL PRIMARY KEY,
      token VARCHAR(255) NOT NULL UNIQUE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL
    );
  `);

  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens (token);
  `);

  // Create trainer_blocked_dates table if not exists
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS trainer_blocked_dates (
      id SERIAL PRIMARY KEY,
      trainer_id INTEGER NOT NULL REFERENCES trainer_profiles(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      reason VARCHAR(255),
      created_at TIMESTAMP WITH TIME ZONE NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL
    );
  `);

  await sequelize.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_trainer_blocked_dates_trainer_date
    ON trainer_blocked_dates (trainer_id, date);
  `);

  // client_preferences: replace legacy lat/lng columns with a preferred gym reference
  await sequelize.query(`
    ALTER TABLE client_preferences
    ADD COLUMN IF NOT EXISTS preferred_gym_id INTEGER REFERENCES gyms(id) ON DELETE SET NULL;
  `);
  await sequelize.query(
    "ALTER TABLE client_preferences DROP COLUMN IF EXISTS latitude;"
  );
  await sequelize.query(
    "ALTER TABLE client_preferences DROP COLUMN IF EXISTS longitude;"
  );
};
