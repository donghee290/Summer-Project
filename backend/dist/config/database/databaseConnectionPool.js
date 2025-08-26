"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDbConnection = void 0;
const promise_1 = __importDefault(require("mysql2/promise"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const DB_HOST = process.env.DB_HOST || '34.42.28.113';
const DB_USER = process.env.DB_USER || 'user';
const DB_PASSWORD = process.env.DB_PASSWORD || '1234';
const DB_NAME = process.env.DB_NAME || 'project';
const DB_PORT = process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306;
const pool = promise_1.default.createPool({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    port: DB_PORT,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});
const getDbConnection = async () => {
    try {
        const connection = await pool.getConnection();
        return connection;
    }
    catch (err) {
        console.error("데이터베이스 연결 실패:", err);
        throw new Error("데이터베이스 연결이 실패했습니다.");
    }
};
exports.getDbConnection = getDbConnection;
