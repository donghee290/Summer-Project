import express from "express";
import { login, testAuth, checkUserId, register, resetPassword } from "../../controllers/user/userController";
import { verifyToken } from "../../middlewares/user/auth";

const router = express.Router();

// 로그인
router.post("/login", login);

// 아이디 중복 확인
router.get("/check-id", checkUserId);

// 회원가입
router.post("/register", register);

// 비밀번호 초기화
router.post("/password-reset", resetPassword);

// 토큰 인증 미들웨어
router.get("/test", verifyToken, testAuth);

export default router; 