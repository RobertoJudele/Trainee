import { Sequelize } from "sequelize";
import type { ProjectionAlias } from "sequelize";

/**
 * Cheapest per-session price a trainer offers: the lower of their single-session rate
 * and the best price/session_count across their packages. The app shows it as
 * "de la X lei o ședință", so it must be a price a client can actually get. A package
 * rate alone overstated it whenever the single session was the cheaper option.
 * LEAST skips NULLs, and a 0 session rate means "not set", so neither wins by default.
 *
 * This is what the trainer cards advertise ("De la 110 lei/ședință"), so it has to be
 * cheap to compute for a whole page of results: a correlated subquery keeps it to one
 * round trip instead of a second query plus a join in JS.
 *
 * `alias` is the SQL table alias of the Trainer in the surrounding query — "Trainer"
 * when selecting from the model directly, "trainer" when it is an include.
 */
export const minSessionPriceExpression = (alias = "Trainer"): string => `LEAST(
    (SELECT ROUND(MIN(tp.price / NULLIF(tp.session_count, 0)), 2)
       FROM trainer_packages tp
      WHERE tp.trainer_id = "${alias}"."id"),
    NULLIF("${alias}"."session_rate", 0)
  )`;

export const minSessionPriceAttribute = (alias = "Trainer"): ProjectionAlias => [
  Sequelize.literal(minSessionPriceExpression(alias)),
  "minSessionPrice",
];
