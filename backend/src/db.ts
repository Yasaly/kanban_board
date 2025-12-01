import { Pool } from 'pg';
import { DATABASE_URL } from './env';

export const pool = new Pool({
    connectionString: DATABASE_URL,
});

export async function testConnection(): Promise<void> {
    const client = await pool.connect();
    try {
        const res = await client.query('SELECT NOW()');
        console.log('DB connected, time:', res.rows[0].now);
    } finally {
        client.release();
    }
}
