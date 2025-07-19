import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export const hashPassword = async (password: string, saltRounds: number = 12): Promise<string> => {
  return bcrypt.hash(password, saltRounds);
};

export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

export const generateJWT = (payload: any, secret: string, options?: jwt.SignOptions): string => {
  return jwt.sign(payload, secret, options);
};

export const verifyJWT = (token: string, secret: string): any => {
  return jwt.verify(token, secret);
};

export const decodeJWT = (token: string): any => {
  return jwt.decode(token);
};

export const generateSecretKey = (length: number = 32): string => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
};