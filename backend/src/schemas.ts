import { z } from "zod";


export const columnSchema = z.object({
    id: z.number().int(),
    title: z.string().min(1).max(100),
    orderIndex: z.number().int(),
});

export type Column = z.infer<typeof columnSchema>;

export const cardSchema = z.object({
    id: z.number().int(),
    columnId: z.number().int(),
    title: z.string().min(1).max(100),
    // описание может быть строкой, null или отсутствовать
    description: z.string().max(1000).nullable().optional(),
    orderIndex: z.number().int(),
    // владелец задачи (может быть null, если старые записи без него)
    ownerId: z.number().int().nullable().optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
});

export type Card = z.infer<typeof cardSchema>;


export const createCardSchema = z.object({
    columnId: z.number().int(),
    title: z.string().min(1).max(100),
    description: z.string().max(1000).nullable().optional(),
});

export type CreateCardDto = z.infer<typeof createCardSchema>;

export const updateCardSchema = z
    .object({
        columnId: z.number().int().optional(),
        title: z.string().min(1).max(100).optional(),
        description: z.string().max(1000).nullable().optional(),
        orderIndex: z.number().int().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
        message: "At least one field must be provided",
    });

export type UpdateCardDto = z.infer<typeof updateCardSchema>;
