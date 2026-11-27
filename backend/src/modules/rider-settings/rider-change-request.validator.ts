import { z } from "zod";

export const createRiderChangeRequestSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("VEHICLE"),
    requestedValues: z.object({
      vehicleType: z.enum(["MOTORCYCLE", "CAR", "BICYCLE", "VAN", "OTHER"]),
      vehicleNumber: z.string().trim().min(2).max(50),
      licenseNumber: z.string().trim().min(2).max(100),
    }).strict(),
  }).strict(),

  z.object({
    type: z.literal("PAYMENT"),
    requestedValues: z.object({
      provider: z.string().trim().min(2).max(80),
      accountHolderName: z.string().trim().min(2).max(120),
      accountLast4: z.string().regex(/^\d{4}$/),
    }).strict(),
  }).strict(),
]);
