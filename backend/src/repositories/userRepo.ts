import { pool } from "../db";
import type { AuthUser } from "../types";

export type DbUser = AuthUser & {
    password_hash: string;
};

export async function findUserByEmail(email: string): Promise<DbUser | null> {
    const res = await pool.query(
        "SELECT id, email, password_hash, role FROM users WHERE email = $1",
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

export async function createUser(
    email: string,
    passwordHash: string
): Promise<DbUser> {
    const res = await pool.query(
        "INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id, email, password_hash, role",
        [email, passwordHash, "user"]
    );

    const row = res.rows[0];
    return {
        id: row.id,
        email: row.email,
        password_hash: row.password_hash,
        role: row.role,
    };
}
