import { Hono } from "hono";

import { authMiddleware, type AppVariables } from "./authMiddleware";
import {
    getBoard,
    createCard,
    updateCard,
    deleteCard,
    canEditOrDeleteCard,
    type CardPatch,
} from "../repositories/boardRepo";
import { broadcastBoardChanged } from "../realtime";
import { createCardSchema, updateCardSchema } from "../schemas";

const boardRoutes = new Hono<{ Variables: AppVariables }>();

boardRoutes.get("/board", authMiddleware, async (c) => {
    const board = await getBoard();
    return c.json(board);
});

boardRoutes.post("/cards", authMiddleware, async (c) => {
    const body = await c.req.json();
    const parsed = createCardSchema.safeParse(body);

    if (!parsed.success) {
        console.log("Create card validation error:", parsed.error.flatten());
        return c.json({ error: "Invalid data" }, 400);
    }

    const user = c.get("user");
    const { columnId, title, description } = parsed.data;

    const card = await createCard(
        columnId,
        title,
        description ?? null,
        user.id
    );

    broadcastBoardChanged();

    return c.json(card, 201);
});

boardRoutes.patch("/cards/:id", authMiddleware, async (c) => {
    const idStr = c.req.param("id");
    const id = Number.parseInt(idStr, 10);

    if (Number.isNaN(id)) {
        return c.json({ error: "Invalid id" }, 400);
    }

    const body = await c.req.json();
    const parsed = updateCardSchema.safeParse(body);

    if (!parsed.success) {
        console.log("Update card validation error:", parsed.error.flatten());
        return c.json({ error: "Invalid data" }, 400);
    }

    const user = c.get("user");

    const canEdit = await canEditOrDeleteCard(id, user);
    if (!canEdit) {
        return c.json({ error: "Forbidden" }, 403);
    }

    const patch: CardPatch = parsed.data;

    const updated = await updateCard(id, patch);
    if (!updated) {
        return c.json({ error: "Not found" }, 404);
    }

    broadcastBoardChanged();

    return c.json(updated);
});

boardRoutes.delete("/cards/:id", authMiddleware, async (c) => {
    const idStr = c.req.param("id");
    const id = Number.parseInt(idStr, 10);

    if (Number.isNaN(id)) {
        return c.json({ error: "Invalid id" }, 400);
    }

    const user = c.get("user");

    const canDel = await canEditOrDeleteCard(id, user);
    if (!canDel) {
        return c.json({ error: "Forbidden" }, 403);
    }

    const ok = await deleteCard(id);
    if (!ok) {
        return c.json({ error: "Not found" }, 404);
    }

    broadcastBoardChanged();

    return c.json({ success: true });
});

export default boardRoutes;
