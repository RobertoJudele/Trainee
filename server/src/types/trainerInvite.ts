export interface TrainerInviteCodeAttributes {
  id: number;
  trainerId: number;
  code: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TrainerInviteCodeCreationAttributes {
  trainerId: number;
  code: string;
}

export interface TrainerClientAttributes {
  id: number;
  trainerId: number;
  clientId: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TrainerClientCreationAttributes {
  trainerId: number;
  clientId: number;
}
