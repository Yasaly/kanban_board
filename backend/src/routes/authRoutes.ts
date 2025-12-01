import { Hono } from "hono";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { JWT_SECRET } from "../env";
import { findUserByEmail } from "../repositories/userRepo";
import type { AuthUser } from "../types";

const authRoutes = new Hono();

authRoutes.post("/login", async (c) => {
    console.log("--- /api/auth/login called ---");
    console.log("Method:", c.req.method, "Path:", c.req.path);

    const raw = await c.req.text();
    console.log("Raw body:", raw);

    let body: { email: string; password: string };
    try {
        body = JSON.parse(raw);
    } catch (err) {
        console.error("❌ Failed to parse JSON body:", err);
        return c.json({ error: "Invalid JSON body" }, 400);
    }

    const { email, password } = body;
    console.log("Parsed body:", { email, passwordLength: password?.length });

    const dbUser = await findUserByEmail(email);
    console.log(
        "DB user found:",
        !!dbUser,
        dbUser && { id: dbUser.id, email: dbUser.email, role: dbUser.role }
    );

    if (!dbUser) {
        console.log("❌ User not found, returning 401");
        return c.json({ error: "Unauthorized" }, 401);
    }

    try {
        const ok = await bcrypt.compare(password, dbUser.password_hash);
        console.log("Password compare result:", ok);

        if (!ok) {
            console.log("❌ Wrong password, returning 401");
            return c.json({ error: "Unauthorized" }, 401);
        }
    } catch (err) {
        console.error("❌ Error during bcrypt.compare:", err);
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
    } catch (err) {
        console.error("❌ Error during jwt.sign:", err);
        return c.json({ error: "Auth error" }, 500);
    }

    console.log("✅ Login success for user:", payload);

    return c.json({
        token,
        user: payload,
    });
});

export default authRoutes;
