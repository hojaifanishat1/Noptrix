import { Schema, model, models, type Model, type Types } from "mongoose";

export interface RiderSettings {
  riderId: Types.ObjectId;
  notifications: {
    announcements: boolean;
    orderUpdates: boolean;
    earnings: boolean;
    promotions: boolean;
    sound: boolean;
    push: boolean;
    email: boolean;
  };
  app: {
    language: "en" | "bn" | "ar";
    theme: "light" | "dark" | "system";
    distanceUnit: "km" | "mi";
  };
  createdAt?: Date;
  updatedAt?: Date;
}

const schema = new Schema<RiderSettings>(
  {
    riderId: {
      type: Schema.Types.ObjectId,
      ref: "Rider",
      required: true,
      unique: true,
      immutable: true,
      index: true,
    },
    notifications: {
      announcements: { type: Boolean, default: true },
      orderUpdates: { type: Boolean, default: true },
      earnings: { type: Boolean, default: true },
      promotions: { type: Boolean, default: false },
      sound: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      email: { type: Boolean, default: true },
    },
    app: {
      language: {
        type: String,
        enum: ["en", "bn", "ar"],
        default: "en",
      },
      theme: {
        type: String,
        enum: ["light", "dark", "system"],
        default: "system",
      },
      distanceUnit: {
        type: String,
        enum: ["km", "mi"],
        default: "km",
      },
    },
  },
  { timestamps: true, versionKey: false, strict: "throw" },
);

export const RiderSettingsModel =
  (models.RiderSettings as Model<RiderSettings> | undefined) ??
  model<RiderSettings>("RiderSettings", schema);
