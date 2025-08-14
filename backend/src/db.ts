// backend/src/db.ts
import mysql from 'mysql2/promise';

// 커넥션 풀 생성
export const db = mysql.createPool({
  host: '34.42.28.113',  // GCP 인스턴스 IP
  port: 3306,
  user: 'user',
  password: '1234',
  database: 'project',
});
