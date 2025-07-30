import express from "express";
import { login, testAuth } from "../../controllers/user/userController";
import { verifyToken } from "../../middlewares/user/auth";

const router = express.Router();

// 로그인
router.post("/login", login);

// 토큰 인증 미들웨어
router.get("/test", verifyToken, testAuth);

export default router; 