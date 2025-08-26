"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// backend/src/testDb.ts
const db_1 = require("./db");
const testConnection = async () => {
    try {
        const [rows] = await db_1.db.query('SELECT NOW() AS now');
        console.log('✅ DB 연결 성공:', rows);
    }
    catch (error) {
        console.error('❌ DB 연결 실패:', error);
    }
    finally {
        await db_1.db.end();
    }
};
testConnection();
