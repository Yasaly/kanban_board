import { pool } from "../db";
import type { AuthUser } from "../types";

export type Column = {
    id: number;
    title: string;
    orderIndex: number;
};

export type Card = {
    id: number;
    columnId: number;
    title: string;
    description: string | null;
    orderIndex: number;
    ownerId: number | null;
    createdAt: string;
    updatedAt: string;
};

export type Board = {
    columns: Column[];
    cards: Card[];
};

export async function getBoard(): Promise<Board> {
    const columnsRes = await pool.query(
        `SELECT id, title, order_index
         FROM columns
         ORDER BY order_index ASC`
    );

    const cardsRes = await pool.query(
        `SELECT
             id,
             column_id,
             title,
             description,
             order_index,
             owner_id,
             created_at,
             updated_at
         FROM cards
         ORDER BY order_index ASC, id ASC`
    );

    const columns: Column[] = columnsRes.rows.map((row) => ({
        id: row.id,
        title: row.title,
        orderIndex: row.order_index,
    }));

    const cards: Card[] = cardsRes.rows.map((row) => ({
        id: row.id,
        columnId: row.column_id,
        title: row.title,
        description: row.description,
        orderIndex: row.order_index,
        ownerId: row.owner_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    }));

    return { columns, cards };
}

export async function createCard(
    columnId: number,
    title: string,
    description: string | null | undefined,
    ownerId: number
): Promise<Card> {
    const res = await pool.query(
        `INSERT INTO cards (
            column_id,
            title,
            description,
            order_index,
            owner_id
        )
         VALUES (
                    $1,
                    $2,
                    $3,
                    COALESCE(
                            (SELECT MAX(order_index) + 1 FROM cards WHERE column_id = $1),
                            0
                    ),
                    $4
                )
             RETURNING
        id,
        column_id,
        title,
        description,
        order_index,
        owner_id,
        created_at,
        updated_at`,
        [columnId, title, description ?? null, ownerId]
    );

    const row = res.rows[0];

    return {
        id: row.id,
        columnId: row.column_id,
        title: row.title,
        description: row.description,
        orderIndex: row.order_index,
        ownerId: row.owner_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

export type CardPatch = {
    columnId?: number;
    title?: string;
    description?: string | null;
    orderIndex?: number;
};

export async function updateCard(
    id: number,
    patch: CardPatch
): Promise<Card | null> {
    const currentRes = await pool.query(
        `SELECT
             id,
             column_id,
             title,
             description,
             order_index,
             owner_id,
             created_at,
             updated_at
         FROM cards
         WHERE id = $1`,
        [id]
    );

    if (currentRes.rowCount === 0) {
        return null;
    }

    const current = currentRes.rows[0];

    const newColumnId =
        patch.columnId !== undefined ? patch.columnId : current.column_id;
    const newTitle = patch.title !== undefined ? patch.title : current.title;
    const newDescription =
        patch.description === undefined ? current.description : patch.description;
    const newOrderIndex =
        patch.orderIndex !== undefined ? patch.orderIndex : current.order_index;

    const res = await pool.query(
        `UPDATE cards
         SET column_id   = $2,
             title       = $3,
             description = $4,
             order_index = $5,
             updated_at  = NOW()
         WHERE id = $1
             RETURNING
        id,
        column_id,
        title,
        description,
        order_index,
        owner_id,
        created_at,
        updated_at`,
        [id, newColumnId, newTitle, newDescription, newOrderIndex]
    );

    if (res.rowCount === 0) {
        return null;
    }

    const row = res.rows[0];

    return {
        id: row.id,
        columnId: row.column_id,
        title: row.title,
        description: row.description,
        orderIndex: row.order_index,
        ownerId: row.owner_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

export async function deleteCard(id: number): Promise<boolean> {
    const res = await pool.query(`DELETE FROM cards WHERE id = $1`, [id]);
    return (res.rowCount ?? 0) > 0;
}

export async function canEditOrDeleteCard(
    cardId: number,
    user: AuthUser
): Promise<boolean> {
    if (user.role === "admin") return true;

    const res = await pool.query<{ owner_id: number | null }>(
        `SELECT owner_id FROM cards WHERE id = $1`,
        [cardId]
    );

    if (res.rowCount === 0) {
        return false;
    }

    const ownerId = res.rows[0].owner_id;
    return ownerId === user.id;
}
