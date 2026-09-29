// The module's entire public surface. Controllers import from here and never
// from a file below it - adapters, ports and the Sequelize models they wrap
// stay private, so the storage layer can change without a caller noticing.
//
// Two groups, and nothing else: what the HTTP edge needs to call the service
// and shape a response, and the injection seam (buildScheduleService plus the
// port interfaces) that lets a caller stand the service up over fakes. A
// re-export with no consumer is surface area, not a service.
export { scheduleService, buildScheduleService } from "./container";
export { ScheduleService, ScheduleError } from "./ScheduleService";
export type { Actor, ScheduleServiceDeps } from "./ScheduleService";
export type {
  AssignCodeCodec,
  AssignCodeReader,
  BlockedDayView,
  ClientRecord,
  Clock,
  ParticipantRepository,
  ScheduleReads,
  ScheduleUnitOfWork,
} from "./ports";
export type { SlotView, WorkingHourView } from "./types";
