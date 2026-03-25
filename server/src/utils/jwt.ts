import jwt from 'jsonwebtoken';
import { JWTPayload } from 'src/types/common';

export interface PasswordResetPayload {
  userId: number;
  email: string;
  purpose: 'password_reset';
  iat?: number;
  exp?: number;
}

export const generateToken = ( payload:Omit<JWTPayload,'iat'|'exp'> ):string => {
  return jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: '7d'
  });
}

export const verifyToken=(token:string ): JWTPayload =>{
  return jwt.verify(token,process.env.JWT_SECRET!) as JWTPayload
}

export const generatePasswordResetToken = (
  payload: Omit<PasswordResetPayload, 'iat' | 'exp'>
): string => {
  const secret = process.env.JWT_RESET_SECRET || process.env.JWT_SECRET;
  return jwt.sign(payload, secret!, {
    expiresIn: '15m',
  });
};

export const verifyPasswordResetToken = (token: string): PasswordResetPayload => {
  const secret = process.env.JWT_RESET_SECRET || process.env.JWT_SECRET;
  return jwt.verify(token, secret!) as PasswordResetPayload;
};