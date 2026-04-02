export enum SlotStatus {
  AVAILABLE = "available",
  ASSIGNED = "assigned",
  COMPLETED = "completed",
  CANCELED = "canceled",
  NO_SHOW = "no_show",
}

export interface TrainerWorkingHourAttributes {
  id: number;
  trainerId: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotDurationMin: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TrainerWorkingHourCreationAttributes {
  trainerId: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotDurationMin?: number;
  isActive?: boolean;
}

export interface TrainerScheduleSlotAttributes {
  id: number;
  trainerId: number;
  clientId?: number;
  workingHourId?: number;
  startsAt: Date;
  endsAt: Date;
  status: SlotStatus;
  note?: string;
  checkInCodeHash?: string | null;
  checkInCodeExpiresAt?: Date | null;
  checkInAttempts: number;
  checkedInAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TrainerScheduleSlotCreationAttributes {
  trainerId: number;
  clientId?: number;
  workingHourId?: number;
  startsAt: Date;
  endsAt: Date;
  status?: SlotStatus;
  note?: string;
  checkInCodeHash?: string | null;
  checkInCodeExpiresAt?: Date | null;
  checkInAttempts?: number;
  checkedInAt?: Date | null;
}
