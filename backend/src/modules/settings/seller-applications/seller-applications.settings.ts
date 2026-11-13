import { z } from "zod";

export const sellerApplicationsSettingsSchema = z.object({
  enabled: z.boolean().optional(),
}).strict();

export type SellerApplicationsSettings = z.infer<
  typeof sellerApplicationsSettingsSchema
>;

export const DEFAULT_SELLER_APPLICATIONS_SETTINGS = {
  enabled: true,
} satisfies SellerApplicationsSettings;
