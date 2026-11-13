import { z } from "zod";

import { SETTINGS_CATEGORIES } from "./settings.types";

import { securitySettingsSchema } from "./security/security.settings";
import { generalSettingsSchema } from "./general/general.settings";
import { businessSettingsSchema } from "./business/business.settings";
import { currencySettingsSchema } from "./currency/currency.settings";
import { taxSettingsSchema } from "./tax/tax.settings";
import { paymentSettingsSchema } from "./payment/payment.settings";
import { shippingSettingsSchema } from "./shipping/shipping.settings";
import { emailSettingsSchema } from "./email/email.settings";
import { smsSettingsSchema } from "./sms/sms.settings";

import {
  sellerApplicationsSettingsSchema,
} from "./seller-applications/seller-applications.settings";

export const settingsCategorySchema = z.object({
  category: z.enum(SETTINGS_CATEGORIES),
});

export const settingsValueSchemas = {
  general: generalSettingsSchema,
  business: businessSettingsSchema,
  security: securitySettingsSchema,
  currency: currencySettingsSchema,
  tax: taxSettingsSchema,
  payment: paymentSettingsSchema,
  shipping: shippingSettingsSchema,
  email: emailSettingsSchema,
  sms: smsSettingsSchema,
  "seller-applications": sellerApplicationsSettingsSchema,
} as const;

export const updateSettingsSchema = z
  .object({
    values: z
      .record(z.string(), z.unknown())
      .refine(
        (values) => Object.keys(values).length > 0,
        "At least one setting value is required.",
      ),
  })
  .strict();

export type UpdateSettingsValidatedInput = z.infer<
  typeof updateSettingsSchema
>;
