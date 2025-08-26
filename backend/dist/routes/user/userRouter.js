"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const userController_1 = require("../../controllers/user/userController");
const auth_1 = require("../../middlewares/user/auth");
const router = express_1.default.Router();
// 로그인
router.post("/login", userController_1.login);
// 아이디 중복 확인
router.get("/check-id", userController_1.checkUserId);
// 회원가입
router.post("/register", userController_1.register);
// 비밀번호 초기화
router.post("/password-reset", userController_1.resetPassword);
// 토큰 인증 미들웨어
router.get("/test", auth_1.verifyToken, userController_1.testAuth);
exports.default = router;
