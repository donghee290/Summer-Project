// backend/src/testDb.ts
import { db } from './db';

const testConnection = async () => {
  try {
    const [rows] = await db.query('SELECT NOW() AS now');
    console.log('✅ DB 연결 성공:', rows);
  } catch (error) {
    console.error('❌ DB 연결 실패:', error);
  } finally {
    await db.end();
  }
};

testConnection();
