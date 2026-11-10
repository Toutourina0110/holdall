import { z } from "zod";

export const slotIds = ["rail.main", "rail.media", "rail.system", "topbar.right", "dashboard.widgets"] as const;
export type SlotId = (typeof slotIds)[number];

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a color like #1f4a7a.");
const itemId = z.string().regex(/^[a-z0-9][a-z0-9.:-]{0,95}$/);

export const elementStyleSchema = z
  .object({
    color: color.optional(),
    background: color.optional(),
    size: z.enum(["sm", "md", "lg"]).optional(),
    spacing: z.enum(["tight", "normal", "loose"]).optional(),
    radius: z.enum(["none", "sm", "md", "lg"]).optional(),
    icon: z.string().max(32).optional(),
    label: z.string().trim().max(40).optional(),
    width: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  })
  .strict();

export type ElementStyle = z.infer<typeof elementStyleSchema>;

export const slotStateSchema = z
  .object({
    order: z.array(itemId).max(200),
    hidden: z.array(itemId).max(200),
  })
  .strict();

export const userLayoutSchema = z
  .object({
    version: z.literal(1),
    slots: z.partialRecord(z.enum(slotIds), slotStateSchema),
    styles: z.record(itemId, elementStyleSchema),
  })
  .strict();

export type UserLayout = z.infer<typeof userLayoutSchema>;

export const emptyLayout: UserLayout = { version: 1, slots: {}, styles: {} };
