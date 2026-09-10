import jwt from 'jsonwebtoken';
import { JWTPayload } from 'src/types/common';
import { getOptionalEnv, getRequiredEnv } from '../config/env';

export interface PasswordResetPayload {
  userId: number;
  email: string;
  purpose: 'password_reset';
  iat?: number;
  exp?: number;
}

const JWT_SECRET = getRequiredEnv('JWT_SECRET');
const JWT_RESET_SECRET = getOptionalEnv('JWT_RESET_SECRET') || JWT_SECRET;

import crypto from 'crypto';

export const generateToken = ( payload:Omit<JWTPayload,'iat'|'exp'> ):string => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '15m'
  });
}

export const generateRefreshToken = (): string => {
  return crypto.randomBytes(40).toString('hex');
};

export const verifyToken=(token:string ): JWTPayload =>{
  return jwt.verify(token,JWT_SECRET) as JWTPayload
}

export const generatePasswordResetToken = (
  payload: Omit<PasswordResetPayload, 'iat' | 'exp'>
): string => {
  return jwt.sign(payload, JWT_RESET_SECRET, {
    expiresIn: '15m',
  });
};

export const verifyPasswordResetToken = (token: string): PasswordResetPayload => {
  return jwt.verify(token, JWT_RESET_SECRET) as PasswordResetPayload;
};

/**
 * Handed to the client after a first-time Google/Apple sign-in, carrying the
 * already-verified provider identity while the client collects the phone number
 * that neither provider supplies. It has no `userId`, so it cannot stand in for
 * an access token; `purpose` is checked on the way back in.
 */
export interface SocialSignupPayload {
  provider: 'google' | 'apple';
  providerId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  purpose: 'social_signup';
  iat?: number;
  exp?: number;
}

export const generateSocialSignupToken = (
  payload: Omit<SocialSignupPayload, 'iat' | 'exp'>
): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
};

export const verifySocialSignupToken = (token: string): SocialSignupPayload => {
  return jwt.verify(token, JWT_SECRET) as SocialSignupPayload;
};