import { z } from "zod";

export const updateRiderSettingsSchema = z.object({
  notifications: z.object({
    announcements: z.boolean().optional(),
    orderUpdates: z.boolean().optional(),
    earnings: z.boolean().optional(),
    promotions: z.boolean().optional(),
    sound: z.boolean().optional(),
    push: z.boolean().optional(),
    email: z.boolean().optional(),
  }).strict().optional(),
  app: z.object({
    language: z.enum(["en", "bn", "ar"]).optional(),
    theme: z.enum(["light", "dark", "system"]).optional(),
    distanceUnit: z.enum(["km", "mi"]).optional(),
  }).strict().optional(),
}).strict().refine(
  (value) => Boolean(value.notifications || value.app),
  { message: "Provide notification or app preferences." },
);
