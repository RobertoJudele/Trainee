import { Op } from "sequelize";
import crypto from "crypto";
import { ClientCheckInCode } from "../../../models/clientCheckInCode";
import { Trainer } from "../../../models/trainer";
import { User } from "../../../models/user";
import { unaccentILike } from "../../../utils/search";
import {
  AssignCodeCodec,
  AssignCodeReader,
  AssignCodeRecord,
  ClientRecord,
  ParticipantRepository,
  TrainerRef,
} from "../ports";
import { toAssignCodeRecord, toClientRecord } from "./rowMappers";

export class SequelizeParticipantRepo implements ParticipantRepository {
  async findTrainerByUserId(userId: number): Promise<TrainerRef | null> {
    const row = await Trainer.findOne({ where: { userId } });
    return row ? { id: row.id, userId: row.userId } : null;
  }

  /**
   * Folds in the role and isActive checks that only two of the three former
   * assign paths applied - assignClientToSlot checked isActive but not role,
   * so a trainer or admin account could be booked into a slot as a "client".
   */
  async findActiveClientById(userId: number): Promise<ClientRecord | null> {
    const row = await User.findByPk(userId);
    if (!row || !row.isActive || String(row.role) !== "client") return null;
    return toClientRecord(row);
  }

  async searchClients(query: string, limit: number): Promise<ClientRecord[]> {
    const rows = await User.findAll({
      where: {
        role: "client",
        isActive: true,
        [Op.or]: [
          // Email stays a plain ILIKE - it never carries diacritics, and this
          // way it keeps using its trigram index.
          { email: { [Op.iLike]: `%${query}%` } },
          unaccentILike('"User"."first_name"', query),
          unaccentILike('"User"."last_name"', query),
        ],
      },
      limit,
      order: [["firstName", "ASC"]],
    });
    return rows.map(toClientRecord);
  }
}

/** Bearer lookup: knowing the six digits is the authorisation, so this is
 *  deliberately not trainer-scoped. */
export class SequelizeAssignCodeReader implements AssignCodeReader {
  async findLiveByHash(codeHash: string, now: Date): Promise<AssignCodeRecord | null> {
    const row = await ClientCheckInCode.findOne({
      where: { codeHash, consumedAt: null, expiresAt: { [Op.gt]: now } },
    });
    return row ? toAssignCodeRecord(row) : null;
  }
}

/**
 * Holds the assign-code secret. Constructed in container.ts with the value
 * passed in, so importing this module - or anything under
 * services/schedule/ - no longer throws when the env var is missing. The old
 * controller read it via getRequiredEnv at module scope, which meant a
 * missing variable took down the whole Express app at import time.
 *
 * Deliberately keeps the existing sha256(`code:secret`) construction rather
 * than switching to real HMAC: codes already issued must keep verifying
 * across the deploy. (It is a peppered digest, not an HMAC - the name says so
 * on purpose.)
 */
export class Sha256AssignCodeCodec implements AssignCodeCodec {
  constructor(private readonly secret: string) {}

  generate(): { code: string; codeHash: string } {
    const code = String(crypto.randomInt(100000, 1000000));
    return { code, codeHash: this.hash(code) };
  }

  hash(code: string): string {
    return crypto.createHash("sha256").update(`${code}:${this.secret}`).digest("hex");
  }
}
