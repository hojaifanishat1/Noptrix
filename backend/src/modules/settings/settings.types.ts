export const SETTINGS_CATEGORIES = [
  "general",
  "business",
  "security",
  "currency",
  "tax",
  "payment",
  "shipping",
  "email",
  "sms",
  "seller-applications",
] as const;

export type SettingsCategory = (typeof SETTINGS_CATEGORIES)[number];

export type SettingsValues = Record<string, unknown>;

export interface UpdateSettingsInput {
  readonly values: SettingsValues;
}
