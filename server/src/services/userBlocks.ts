import { Op } from "sequelize";
import { UserBlock } from "../models/userBlock";

/**
 * Everyone `userId` should stop seeing: people they blocked, and people who
 * blocked them. Blocking here means "don't put this person in front of me" -
 * a client hiding a trainer's profile, or hiding a reviewer's review - not a
 * safety boundary, so the mutual direction matters as much as the one the
 * blocker chose: someone a trainer has blocked should not keep seeing that
 * trainer in search either.
 *
 * Returns an empty array (not queried further) for an unauthenticated caller
 * or a userId with no blocks either way - callers should skip adding a
 * `notIn` clause entirely in that case rather than pass an empty array to
 * Sequelize, which is valid but pointless.
 */
export const getMutuallyBlockedUserIds = async (
  userId: number | undefined
): Promise<number[]> => {
  if (!userId) return [];

  const rows = await UserBlock.findAll({
    where: {
      [Op.or]: [{ blockerId: userId }, { blockedId: userId }],
    },
    attributes: ["blockerId", "blockedId"],
  });

  const otherIds = new Set<number>();
  for (const row of rows) {
    otherIds.add(row.blockerId === userId ? row.blockedId : row.blockerId);
  }

  return Array.from(otherIds);
};
