// Attendance confirmation was never finished (the per-slot check-in code was
// only ever written null) and has been removed rather than completed. A slot
// is either open or booked - there is no third state.
export enum SlotStatus {
  AVAILABLE = "available",
  ASSIGNED = "assigned",
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
}

export interface TrainerBlockedDateAttributes {
  id: number;
  trainerId: number;
  date: string; // "YYYY-MM-DD"
  reason?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TrainerBlockedDateCreationAttributes {
  trainerId: number;
  date: string;
  reason?: string | null;
}
