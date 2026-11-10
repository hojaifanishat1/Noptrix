import { Types } from "mongoose";
import { z } from "zod";

const fields = {
  areaId: z.string().refine(Types.ObjectId.isValid),
  methodId: z.string().refine(Types.ObjectId.isValid).optional(),
  fee: z.number().finite().min(0),
  freeDeliveryThreshold: z.number().finite().min(0).optional(),
  minimumOrderAmount: z.number().finite().min(0).default(0),
  currency: z.string().trim().length(3).default("BDT"),
  priority: z.number().int().min(0).max(100000).default(100),
  validFrom: z.coerce.date().optional(),
  validUntil: z.coerce.date().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
};

export const createAreaFeeOverrideSchema = z.object(fields).strict()
  .superRefine((value, ctx) => {
    if (value.validFrom && value.validUntil && value.validFrom >= value.validUntil) {
      ctx.addIssue({
        code: "custom", path: ["validUntil"],
        message: "validUntil must be later than validFrom.",
      });
    }
  });

export const updateAreaFeeOverrideSchema = z.object({
  areaId: fields.areaId.optional(),
  methodId: fields.methodId,
  fee: fields.fee.optional(),
  freeDeliveryThreshold: fields.freeDeliveryThreshold,
  minimumOrderAmount: fields.minimumOrderAmount.optional(),
  currency: z.string().trim().length(3).optional(),
  priority: fields.priority.optional(),
  validFrom: fields.validFrom,
  validUntil: fields.validUntil,
  status: fields.status.optional(),
}).strict().superRefine((value, ctx) => {
  if (value.validFrom && value.validUntil && value.validFrom >= value.validUntil) {
    ctx.addIssue({
      code: "custom", path: ["validUntil"],
      message: "validUntil must be later than validFrom.",
    });
  }
});

export const areaFeeOverrideIdSchema = z.object({
  id: z.string().refine(Types.ObjectId.isValid),
});

export const listAreaFeeOverridesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  areaId: z.string().refine(Types.ObjectId.isValid).optional(),
  methodId: z.string().refine(Types.ObjectId.isValid).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  sort: z.enum(["newest", "oldest", "priority"]).default("priority"),
});
