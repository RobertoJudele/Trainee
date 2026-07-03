export interface UserPushTokenAttributes {
  id: number;
  userId: number;
  expoPushToken: string | null;
  remindersEnabled: boolean;
  locale: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPushTokenCreationAttributes {
  userId: number;
  expoPushToken?: string | null;
  remindersEnabled?: boolean;
  locale?: string;
}

export interface SlotReminderAttributes {
  id: number;
  slotId: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SlotReminderCreationAttributes {
  slotId: number;
}
