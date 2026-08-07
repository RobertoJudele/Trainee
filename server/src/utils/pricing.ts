import { Sequelize } from "sequelize";
import type { ProjectionAlias } from "sequelize";

/**
 * Cheapest per-session price a trainer offers — the best price/session_count across
 * their packages, falling back to the flat session rate when they have no packages.
 *
 * This is what the trainer cards advertise ("De la 110 lei/ședință"), so it has to be
 * cheap to compute for a whole page of results: a correlated subquery keeps it to one
 * round trip instead of a second query plus a join in JS.
 *
 * `alias` is the SQL table alias of the Trainer in the surrounding query — "Trainer"
 * when selecting from the model directly, "trainer" when it is an include.
 */
export const minSessionPriceExpression = (alias = "Trainer"): string => `COALESCE(
    (SELECT ROUND(MIN(tp.price / NULLIF(tp.session_count, 0)), 2)
       FROM trainer_packages tp
      WHERE tp.trainer_id = "${alias}"."id"),
    "${alias}"."session_rate"
  )`;

export const minSessionPriceAttribute = (alias = "Trainer"): ProjectionAlias => [
  Sequelize.literal(minSessionPriceExpression(alias)),
  "minSessionPrice",
];
