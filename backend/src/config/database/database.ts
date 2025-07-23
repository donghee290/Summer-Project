import { getDbConnection } from './databaseConnectionPool';

export async function callStoredProcedure<T>(procedureName: string, params: any[] = []): Promise<T | null> {
  let connection;
  try {
    connection = await getDbConnection();

    const placeholders = params.map(() => '?').join(', ');
    const callQuery = `CALL ${procedureName}(${placeholders})`;

    const [results] = await connection.execute(callQuery, params);

    return (results && Array.isArray(results) && results.length > 0) ? results[0] as T : null;

  } catch (err) {
    console.error(`프로시저 '${procedureName}' 호출 중 오류 발생:`, err);
    throw new Error(`프로시저 '${procedureName}' 실행이 실패했습니다.`);
  } finally {
    if (connection) {
      connection.release();
    }
  }
}