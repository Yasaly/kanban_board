import { Hono } from "hono";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { JWT_SECRET } from "../env";
import { findUserByEmail, createUser } from "../repositories/userRepo";
import type { AuthUser } from "../types";

const authRoutes = new Hono();

authRoutes.post("/login", async (c) => {
    const raw = await c.req.text();

    let body: { email: string; password: string };
    try {
        body = JSON.parse(raw);
    } catch {
        return c.json({ error: "Invalid JSON body" }, 400);
    }

    const { email, password } = body;

    if (typeof email !== "string" || typeof password !== "string") {
        return c.json({ error: "Invalid credentials" }, 400);
    }

    const dbUser = await findUserByEmail(email);

    if (!dbUser) {
        return c.json({ error: "Unauthorized" }, 401);
    }

    try {
        const ok = await bcrypt.compare(password, dbUser.password_hash);
        if (!ok) {
            return c.json({ error: "Unauthorized" }, 401);
        }
    } catch {
        return c.json({ error: "Auth error" }, 500);
    }

    const payload: AuthUser = {
        id: dbUser.id,
        email: dbUser.email,
        role: dbUser.role,
    };

    let token: string;
    try {
        token = jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
    } catch {
        return c.json({ error: "Auth error" }, 500);
    }

    return c.json({
        token,
        user: payload,
    });
});

authRoutes.post("/register", async (c) => {
    const raw = await c.req.text();

    let body: { email: string; password: string };
    try {
        body = JSON.parse(raw);
    } catch {
        return c.json({ error: "Invalid JSON body" }, 400);
    }

    const { email, password } = body;

    if (
        typeof email !== "string" ||
        typeof password !== "string" ||
        !email.includes("@") ||
        password.length < 6
    ) {
        return c.json({ error: "Некорректные email или пароль" }, 400);
    }

    const existing = await findUserByEmail(email);
    if (existing) {
        return c.json({ error: "Пользователь с таким email уже существует" }, 400);
    }

    let passwordHash: string;
    try {
        passwordHash = await bcrypt.hash(password, 10);
    } catch {
        return c.json({ error: "Auth error" }, 500);
    }

    let dbUser;
    try {
        dbUser = await createUser(email, passwordHash);
    } catch {
        return c.json({ error: "Auth error" }, 500);
    }

    const payload: AuthUser = {
        id: dbUser.id,
        email: dbUser.email,
        role: dbUser.role,
    };

    let token: string;
    try {
        token = jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
    } catch {
        return c.json({ error: "Auth error" }, 500);
    }

    return c.json({
        token,
        user: payload,
    });
});

export default authRoutes;
