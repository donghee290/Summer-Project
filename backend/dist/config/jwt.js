"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verify = exports.sign = exports.JWT_EXPIRES_IN = exports.JWT_SECRET = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
exports.JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";
exports.JWT_EXPIRES_IN = "3m";
const sign = (payload) => {
    return jsonwebtoken_1.default.sign(payload, exports.JWT_SECRET, {
        expiresIn: exports.JWT_EXPIRES_IN,
    });
};
exports.sign = sign;
const verify = (token) => {
    try {
        const decoded = jsonwebtoken_1.default.verify(token, exports.JWT_SECRET);
        return decoded;
    }
    catch (err) {
        return null;
    }
};
exports.verify = verify;
