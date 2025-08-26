"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
// backend/src/db.ts
const promise_1 = __importDefault(require("mysql2/promise"));
// 커넥션 풀 생성
exports.db = promise_1.default.createPool({
    host: '34.42.28.113', // GCP 인스턴스 IP
    port: 3306,
    user: 'user',
    password: '1234',
    database: 'project',
});
