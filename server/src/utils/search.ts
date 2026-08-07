import { Op, Sequelize, Utils } from "sequelize";

/**
 * Diacritic-insensitive ILIKE — "bucuresti" matches "București", "Stefan" matches "Ștefan".
 *
 * unaccent() runs on both sides, so it also folds the cedilla lookalikes (ş/ţ, U+015F/U+0163)
 * that Windows keyboards still emit for what should be comma-below ș/ț, plus every
 * non-Romanian accent for free.
 *
 * The column must be fully qualified and quoted ("Trainer"."location_city"): the models map
 * camelCase attributes onto snake_case columns via `field:`, so Sequelize.col("locationCity")
 * would emit a column that does not exist.
 *
 * ponytail: wrapping the column discards its gin_trgm index. Fine at this row count — if
 * search slows down, add an IMMUTABLE unaccent wrapper plus a functional trigram index.
 */
export const unaccentILike = (qualifiedColumn: string, value: string): Utils.Where =>
  Sequelize.where(Sequelize.literal(`unaccent(${qualifiedColumn})`), {
    [Op.iLike]: Sequelize.fn("unaccent", `%${value}%`),
  });
