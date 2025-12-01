import { pool } from '../db';
import type { AuthUser } from '../types';

export type DbUser = AuthUser & {
    password_hash: string;
};

export async function findUserByEmail(email: string): Promise<DbUser | null> {
    const res = await pool.query(
        'SELECT id, email, password_hash, role FROM users WHERE email = $1',
        [email]
    );
    if (res.rowCount === 0) return null;

    const row = res.rows[0];
    return {
        id: row.id,
        email: row.email,
        password_hash: row.password_hash,
        role: row.role,
    };
}
