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

export const generateToken = ( payload:Omit<JWTPayload,'iat'|'exp'> ):string => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '7d'
  });
}

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