"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyToken = verifyToken;
const jwt_1 = require("../../config/jwt");
async function verifyToken(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ message: "인증 토큰이 필요합니다." });
        }
        const token = authHeader.split(" ")[1];
        const decoded = (0, jwt_1.verify)(token);
        if (!decoded) {
            return res.status(401).json({ message: "유효하지 않은 토큰입니다." });
        }
        const { iat, exp, ...userInfo } = decoded;
        req.user = userInfo;
        next();
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: "유효하지 않은 토큰입니다." });
    }
}
