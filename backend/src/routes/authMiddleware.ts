import type { Context, Next } from "hono";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../env";
import type { AuthUser } from "../types";

export type AppVariables = {
    user: AuthUser;
};

export const authMiddleware = async (c: Context, next: Next) => {
    const header = c.req.header("Authorization");
    console.log("Auth middleware: Authorization header =", header);

    if (!header?.startsWith("Bearer ")) {
        console.log("❌ No Bearer token, return 401");
        return c.json({ error: "Unauthorized" }, 401);
    }

    const token = header.slice(7);
    console.log("Auth middleware: token =", token);

    try {
        const payload = jwt.verify(token, JWT_SECRET) as AuthUser;
        console.log("Auth middleware: decoded payload =", payload);
        c.set("user", payload);
        await next();
    } catch (err) {
        console.error("❌ JWT verify error:", err);
        return c.json({ error: "Unauthorized" }, 401);
    }
};
