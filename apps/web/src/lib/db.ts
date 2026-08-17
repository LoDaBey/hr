import 'server-only';
import { Pool, types, type QueryResultRow } from 'pg';

types.setTypeParser(types.builtins.DATE, (value) => value);
types.setTypeParser(types.builtins.NUMERIC, (value) => (value === null ? null : Number(value)));
types.setTypeParser(types.builtins.INT8, (value) => Number(value));
types.setTypeParser(types.builtins.TIMESTAMPTZ, (value) =>
  value ? new Date(value).toISOString() : value,
);

const globalForDb = globalThis as unknown as { pool?: Pool };

function poolConfig() {
  if (process.env.DATABASE_URL) {
    const local = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL);
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: local ? false : { rejectUnauthorized: false },
      max: 5,
    };
  }
  return {
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT ?? 5432),
    ssl: process.env.DB_HOST === 'localhost' ? false : { rejectUnauthorized: false },
    max: 5,
  };
}

export const pool =
  globalForDb.pool ?? new Pool(poolConfig());

if (process.env.NODE_ENV !== 'production') globalForDb.pool = pool;

export async function query<T extends QueryResultRow>(sql: string, params: unknown[] = []) {
  const res = await pool.query<T>(sql, params);
  return res.rows;
}

export async function one<T extends QueryResultRow>(sql: string, params: unknown[] = []) {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

export async function tx<T>(fn: (c: import('pg').PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
