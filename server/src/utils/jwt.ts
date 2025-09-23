import jwt from 'jsonwebtoken';
import { JWTPayload } from 'src/types/common';

export const generateToken = ( payload:Omit<JWTPayload,'iat'|'exp'> ):string => {
  return jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: '7d'
  });
}

export const verifyToken=(token:string ): JWTPayload =>{
  return jwt.verify(token,process.env.JWT_SECRET!) as JWTPayload
}