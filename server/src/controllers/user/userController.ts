import { Request, Response } from "express";
import { sign } from "../../config/jwt";
import { AuthRequest } from "../../middlewares/user/auth";

import { callStoredProcedure } from "../../config/database/database";

export const login = async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: "사용자 이름과 비밀번호를 입력해주세요." });
    }

    const loginResult = await callStoredProcedure<any[]>('WEB_GET_LOGIN', [username, password]);
    const user = (loginResult && loginResult.length > 0) ? loginResult[0] : null;

    if (user) {
      const payload = {
        userId: user.id, 
        username: user.username,
      };
      const token = sign(payload);

      return res.json({
        message: "로그인 성공",
        token: token,
      });
    }

    return res.status(401).json({ message: "아이디 또는 비밀번호가 올바르지 않습니다." });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
};

export const testAuth = async (req: AuthRequest, res: Response) => {
  try {
    res.status(200).json({ message: "Test Success", user: req.user });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "잠시 후 다시 시도해 주세요." });
  }
}; 