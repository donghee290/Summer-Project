import { Request, Response, NextFunction } from "express";
import { verify } from "../../config/jwt";

export interface AuthRequest extends Request {
  user?: any;
}

export async function verifyToken(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "인증 토큰이 필요합니다." });
    }
    const token = authHeader.split(" ")[1];
    const decoded = verify(token);

    if (!decoded) {
      return res.status(401).json({ message: "유효하지 않은 토큰입니다." });
    }

    req.user = decoded;
    next();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "유효하지 않은 토큰입니다." });
  }
} 