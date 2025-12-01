import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";

import { PORT } from "./env";
import { testConnection } from "./db";
import boardRoutes from "./routes/boardRoutes";
import authRoutes from "./routes/authRoutes";
import { attachWebSocketServer } from "./realtime";
import type { AppVariables } from "./routes/authMiddleware";

const app = new Hono<{ Variables: AppVariables }>();

app.use("*", cors());

app.use("*", async (c, next) => {
    console.log("HTTP", c.req.method, c.req.path);
    await next();
});

app.route("/api/auth", authRoutes);
app.route("/api", boardRoutes);

async function main() {
    await testConnection();

    const server = serve(
        {
            fetch: app.fetch,
            port: PORT,
        },
        (info) => {
            console.log(`✅ Server running at http://localhost:${info.port}`);
        }
    );

    attachWebSocketServer(server);
}

main().catch((err) => {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
});
