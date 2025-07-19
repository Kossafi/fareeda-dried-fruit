import jwt from 'jsonwebtoken';

export interface JWTUtils {
  sign: (payload: any, secret: string, options?: jwt.SignOptions) => string;
  verify: (token: string, secret: string) => any;
  decode: (token: string) => any;
}

export const createJWTUtils = (): JWTUtils => {
  return {
    sign: (payload: any, secret: string, options?: jwt.SignOptions): string => {
      return jwt.sign(payload, secret, options);
    },

    verify: (token: string, secret: string): any => {
      return jwt.verify(token, secret);
    },

    decode: (token: string): any => {
      return jwt.decode(token);
    },
  };
};