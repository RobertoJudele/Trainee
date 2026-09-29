import sequelize from "../../db";
import { getOptionalEnv, getRequiredEnv } from "../../config/env";
import { ScheduleService, ScheduleServiceConfig } from "./ScheduleService";
import { SequelizeScheduleReads } from "./adapters/SequelizeScheduleReads";
import { SequelizeScheduleUnitOfWork } from "./adapters/SequelizeScheduleUnitOfWork";
import {
  SequelizeAssignCodeReader,
  SequelizeParticipantRepo,
  Sha256AssignCodeCodec,
} from "./adapters/SequelizeParticipantRepo";
import { SystemClock } from "./adapters/SystemClock";

/**
 * The composition root: the single place that knows both which adapters exist
 * and where configuration comes from. Nothing else under services/schedule/
 * touches process.env, which is what lets domain.ts and ScheduleService be
 * exercised with fakes and no environment at all.
 */
export const buildScheduleService = (config: {
  assignCodeSecret: string;
  defaultTimeZone: string;
} & Omit<ScheduleServiceConfig, "defaultTimeZone">): ScheduleService =>
  new ScheduleService({
    reads: new SequelizeScheduleReads(),
    uow: new SequelizeScheduleUnitOfWork(sequelize),
    participants: new SequelizeParticipantRepo(),
    assignCodes: new SequelizeAssignCodeReader(),
    codec: new Sha256AssignCodeCodec(config.assignCodeSecret),
    clock: new SystemClock(),
    ...config,
  });

let instance: ScheduleService | undefined;

/**
 * Lazily built, unlike billing's eagerly-constructed export. The secret is
 * mandatory, so resolving it at import time would mean a missing variable took
 * down the entire Express app while it was still wiring up its routes - which
 * is exactly what the old controller's module-scope getRequiredEnv call did.
 * Deferring to the first request keeps the failure local to this feature.
 */
export const scheduleService = (): ScheduleService => {
  if (!instance) {
    instance = buildScheduleService({
      assignCodeSecret: getRequiredEnv("CHECKIN_CODE_SECRET"),
      defaultTimeZone: getOptionalEnv("DEFAULT_TIMEZONE") || "UTC",
    });
  }
  return instance;
};
