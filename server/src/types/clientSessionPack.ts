export interface ClientSessionPackAttributes {
  id: number;
  trainerId: number;
  clientId: number;
  name: string | null;
  totalSessions: number;
  usedSessions: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClientSessionPackCreationAttributes {
  trainerId: number;
  clientId: number;
  name?: string | null;
  totalSessions: number;
  usedSessions?: number;
}
