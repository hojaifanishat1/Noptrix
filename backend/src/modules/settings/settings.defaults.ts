import { DEFAULT_GENERAL_SETTINGS } from "./general/general.settings";
import { DEFAULT_BUSINESS_SETTINGS } from "./business/business.settings";
import { DEFAULT_SECURITY_SETTINGS } from "./security/security.settings";
import { DEFAULT_CURRENCY_SETTINGS } from "./currency/currency.settings";
import { DEFAULT_TAX_SETTINGS } from "./tax/tax.settings";
import { DEFAULT_PAYMENT_SETTINGS } from "./payment/payment.settings";
import { DEFAULT_SHIPPING_SETTINGS } from "./shipping/shipping.settings";
import { DEFAULT_EMAIL_SETTINGS } from "./email/email.settings";
import { DEFAULT_SMS_SETTINGS } from "./sms/sms.settings";
import { DEFAULT_SELLER_APPLICATIONS_SETTINGS } from "./seller-applications/seller-applications.settings";

import type { SettingsCategory, SettingsValues } from "./settings.types";

export const DEFAULT_SETTINGS = {
  general: DEFAULT_GENERAL_SETTINGS,
  business: DEFAULT_BUSINESS_SETTINGS,
  security: DEFAULT_SECURITY_SETTINGS,
  currency: DEFAULT_CURRENCY_SETTINGS,
  tax: DEFAULT_TAX_SETTINGS,
  payment: DEFAULT_PAYMENT_SETTINGS,
  shipping: DEFAULT_SHIPPING_SETTINGS,
  email: DEFAULT_EMAIL_SETTINGS,
  sms: DEFAULT_SMS_SETTINGS,
  "seller-applications": DEFAULT_SELLER_APPLICATIONS_SETTINGS,
} satisfies Record<SettingsCategory, SettingsValues>;
