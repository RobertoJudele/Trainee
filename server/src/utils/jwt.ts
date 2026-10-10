import jwt from 'jsonwebtoken';
import { JWTPayload } from 'src/types/common';
import { getRequiredEnv } from '../config/env';

const JWT_SECRET = getRequiredEnv('JWT_SECRET');

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