export interface SpecializationAttributes {
  id: string;
  name: string;
  description?: string;
  iconUrl?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SpecializationCreationAttributes {
  name: string;
  description?: string;
  iconUrl?: string;
  isActive: boolean;
}
