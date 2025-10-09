export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: string;
  profileImageUrl: string;
  isVerified: boolean;
  isActive: boolean;
  lastLoginAt: string;
  emailVerificationToken: string | null;
  emailVerificationExpires: string | null;
  emailVerifiedAt: string;
  createdAt: string;
  updatedAt: string;
}
