export interface AppMinVersionAttributes {
  platform: string; // 'ios' | 'android'
  minVersion: string;
  storeUrl: string;
  message: string;
  updatedAt: Date;
}

export interface AppMinVersionCreationAttributes {
  platform: string;
  minVersion: string;
  storeUrl: string;
  message: string;
}
