import jwt, { SignOptions, Secret } from "jsonwebtoken";

export const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";
export const JWT_EXPIRES_IN = "3m";
export const REFRESH_JWT_SECRET = process.env.REFRESH_JWT_SECRET || "your_refresh_jwt_secret";
export const REFRESH_EXPIRES_IN = process.env.REFRESH_EXPIRES_IN || "14d";

export const sign = (payload: object) => {
  return jwt.sign(payload, JWT_SECRET as Secret, {
    expiresIn: JWT_EXPIRES_IN,
  } as SignOptions);
};

export const verify = (token: string) => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET as Secret);
    return decoded;
  } catch (err) {
    return null;
  }
}; 

export const signRefresh = (payload: object) => {
  return jwt.sign(payload, REFRESH_JWT_SECRET as Secret, {
    expiresIn: REFRESH_EXPIRES_IN,
  } as SignOptions);
};

export const verifyRefresh = (token: string) => {
  try {
    const decoded = jwt.verify(token, REFRESH_JWT_SECRET as Secret);
    return decoded;
  } catch (err) {
    return null;
  }
};