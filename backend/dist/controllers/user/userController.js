"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetPassword = exports.register = exports.checkUserId = exports.testAuth = exports.login = void 0;
const jwt_1 = require("../../config/jwt");
const database_1 = require("../../config/database/database");
const login = async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ message: "사용자 이름과 비밀번호를 입력해주세요." });
        }
        const loginResult = await (0, database_1.callStoredProcedure)('WEB_GET_LOGIN', [username, password]);
        const user = (loginResult && loginResult.length > 0) ? loginResult[0] : null;
        // console.log(user.user_no, user.user_id);
        if (user) {
            const payload = {
                userNo: user.user_no,
                userId: user.user_id,
            };
            // JWT 토큰 생성
            // 미들웨어에서 인증 성공 시 user 정보를 넘기기 위함
            const token = (0, jwt_1.sign)({
                userNo: payload.userNo,
                userId: payload.userId,
            });
            return res.json({
                message: "로그인 성공",
                token: token,
            });
        }
        return res.status(401).json({ message: "아이디 또는 비밀번호가 올바르지 않습니다." });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: "서버 오류가 발생했습니다." });
    }
};
exports.login = login;
const testAuth = async (req, res) => {
    try {
        res.status(200).json({ message: "인증 성공", user: req.user });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: "잠시 후 다시 시도해 주세요." });
    }
};
exports.testAuth = testAuth;
// 아이디 중복 확인
const checkUserId = async (req, res) => {
    const username = req.query.username || req.query.user_id;
    if (!username) {
        return res.status(400).json({ message: "아이디가 필요합니다." });
    }
    try {
        const idCheckResult = await (0, database_1.callStoredProcedure)("WEB_GET_ID_CHECK", [username]);
        const count = idCheckResult && idCheckResult[0] ? idCheckResult[0].count : 0;
        return res.status(200).json({ available: count === 0 });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: "서버 오류가 발생했습니다." });
    }
};
exports.checkUserId = checkUserId;
// 회원가입
const register = async (req, res) => {
    const { username, password, email } = req.body;
    if (!username || !password || !email) {
        return res.status(400).json({ message: "아이디, 비밀번호, 이메일을 모두 입력해주세요." });
    }
    try {
        const registerResult = await (0, database_1.callStoredProcedure)("WEB_SET_USER_REGISTER", [username, password, email]);
        const row = registerResult && registerResult[0] ? registerResult[0] : null;
        if (!row) {
            return res.status(500).json({ message: "회원가입 처리 중 오류가 발생했습니다." });
        }
        if (row.success === 0 || row.code === "DUPLICATE") {
            return res.status(409).json({ message: "이미 사용중인 아이디입니다." });
        }
        return res.status(201).json({ message: "회원가입이 완료되었습니다." });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: "서버 오류가 발생했습니다." });
    }
};
exports.register = register;
// 비밀번호 초기화 (아이디+이메일 검증 후 4자리 숫자 난수로 초기화, MD5 저장)
const resetPassword = async (req, res) => {
    const { username, email } = req.body;
    if (!username || !email) {
        return res.status(400).json({ message: "아이디와 이메일을 모두 입력해주세요." });
    }
    try {
        const spResult = await (0, database_1.callStoredProcedure)("WEB_SET_USER_PW_RESET", [username, email]);
        const row = spResult && spResult[0] ? spResult[0] : null;
        if (!row) {
            return res.status(500).json({ message: "비밀번호 초기화 처리 중 오류가 발생했습니다." });
        }
        if (row.success === 0 || row.code === "NOT_FOUND") {
            return res.status(404).json({ message: "일치하는 사용자 정보를 찾을 수 없습니다." });
        }
        return res.status(200).json({ message: "비밀번호가 초기화되었습니다.", tempPassword: row.tempPassword });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: "서버 오류가 발생했습니다." });
    }
};
exports.resetPassword = resetPassword;
