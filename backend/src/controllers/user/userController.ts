import { Request, Response } from "express";
import { sign, signRefresh, verifyRefresh } from "../../config/jwt";
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
        userNo: user.user_no, 
        userId: user.user_id,
      };

      // 액세스/리프레시 토큰 생성
      const token = sign({
        userNo: payload.userNo,
        userId: payload.userId,
      });
      const refreshToken = signRefresh({
        userNo: payload.userNo,
        userId: payload.userId,
        tokenType: "refresh",
      });

      return res.json({
        message: "로그인 성공",
        token: token,
        refreshToken: refreshToken,
      });
    }

    return res.status(401).json({ message: "아이디 또는 비밀번호가 올바르지 않습니다." });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
};

// 리프레시 토큰으로 액세스 토큰 재발급
export const refreshAccessToken = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body as { refreshToken?: string };
    if (!refreshToken) {
      return res.status(400).json({ message: "리프레시 토큰이 필요합니다." });
    }

    const decoded = verifyRefresh(refreshToken) as any;
    if (!decoded || decoded.tokenType !== "refresh") {
      return res.status(401).json({ message: "유효하지 않은 리프레시 토큰입니다." });
    }

    const { userNo, userId } = decoded as { userNo: number; userId: string };
    const newAccessToken = sign({ userNo, userId });

    return res.status(200).json({ token: newAccessToken });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "토큰 재발급 중 오류가 발생했습니다." });
  }
};

export const testAuth = async (req: AuthRequest, res: Response) => {
  try {
    res.status(200).json({ message: "인증 성공", user: req.user });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "잠시 후 다시 시도해 주세요." });
  }
}; 

// 아이디 중복 확인
export const checkUserId = async (req: Request, res: Response) => {
  const username = (req.query.username as string) || (req.query.user_id as string);
  if (!username) {
    return res.status(400).json({ message: "아이디가 필요합니다." });
  }

  try {
    const idCheckResult = await callStoredProcedure<any[]>("WEB_GET_ID_CHECK", [username]);
    const count = idCheckResult && idCheckResult[0] ? idCheckResult[0].count : 0;
    return res.status(200).json({ available: count === 0 });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
};

// 회원가입
export const register = async (req: Request, res: Response) => {
  const { username, password, email } = req.body as {
    username?: string;
    password?: string;
    email?: string;
  };

  if (!username || !password || !email) {
    return res.status(400).json({ message: "아이디, 비밀번호, 이메일을 모두 입력해주세요." });
  }

  try {
    const registerResult = await callStoredProcedure<any[]>(
      "WEB_SET_USER_REGISTER",
      [username, password, email]
    );

    const row = registerResult && registerResult[0] ? registerResult[0] : null;
    if (!row) {
      return res.status(500).json({ message: "회원가입 처리 중 오류가 발생했습니다." });
    }

    if (row.success === 0 || row.code === "DUPLICATE") {
      return res.status(409).json({ message: "이미 사용중인 아이디입니다." });
    }

    return res.status(201).json({ message: "회원가입이 완료되었습니다." });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
};

// 비밀번호 초기화 (아이디+이메일 검증 후 4자리 숫자 난수로 초기화, MD5 저장)
export const resetPassword = async (req: Request, res: Response) => {
  const { username, email } = req.body as { username?: string; email?: string };
  if (!username || !email) {
    return res.status(400).json({ message: "아이디와 이메일을 모두 입력해주세요." });
  }

  try {
    const spResult = await callStoredProcedure<any[]>(
      "WEB_SET_USER_PW_RESET",
      [username, email]
    );

    const row = spResult && spResult[0] ? spResult[0] : null;
    if (!row) {
      return res.status(500).json({ message: "비밀번호 초기화 처리 중 오류가 발생했습니다." });
    }

    if (row.success === 0 || row.code === "NOT_FOUND") {
      return res.status(404).json({ message: "일치하는 사용자 정보를 찾을 수 없습니다." });
    }

    return res.status(200).json({ message: "비밀번호가 초기화되었습니다.", tempPassword: row.tempPassword });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
};