import {
  Document,
  Model,
  Schema,
  Types,
  model,
  models,
} from "mongoose";

export const RIDER_SESSION_STATUSES = [
  "ACTIVE",
  "REVOKED",
  "EXPIRED",
] as const;

export type RiderSessionStatus =
  (typeof RIDER_SESSION_STATUSES)[number];

export interface IRiderSession extends Document {
  riderId: Types.ObjectId;
  refreshTokenHash: string;
  status: RiderSessionStatus;
  userAgent?: string;
  ipAddress?: string;
  deviceId?: string;
  lastUsedAt?: Date;
  expiresAt: Date;
  revokedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const riderSessionSchema = new Schema<IRiderSession>(
  {
    riderId: {
      type: Schema.Types.ObjectId,
      ref: "Rider",
      required: true,
    },
    refreshTokenHash: {
      type: String,
      required: true,
      select: false,
    },
    status: {
      type: String,
      enum: RIDER_SESSION_STATUSES,
      default: "ACTIVE",
      required: true,
    },
    userAgent: {
      type: String,
      trim: true,
    },
    ipAddress: {
      type: String,
      trim: true,
    },
    deviceId: {
      type: String,
      trim: true,
    },
    lastUsedAt: Date,
    expiresAt: {
      type: Date,
      required: true,
    },
    revokedAt: Date,
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

riderSessionSchema.index({
  riderId: 1,
  status: 1,
  createdAt: -1,
});

riderSessionSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 },
);

export const RiderSession: Model<IRiderSession> =
  (models.RiderSession as Model<IRiderSession>) ??
  model<IRiderSession>("RiderSession", riderSessionSchema);
