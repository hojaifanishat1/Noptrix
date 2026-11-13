import {
  Document,
  Model,
  Schema,
  Types,
  model,
  models,
} from "mongoose";

export const SELLER_SESSION_STATUSES = [
  "ACTIVE",
  "REVOKED",
  "EXPIRED",
] as const;

export interface ISellerSession extends Document {
  sellerId: Types.ObjectId;
  refreshTokenHash: string;
  status: (typeof SELLER_SESSION_STATUSES)[number];
  userAgent?: string;
  ipAddress?: string;
  deviceId?: string;
  lastUsedAt?: Date;
  expiresAt: Date;
  revokedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const sellerSessionSchema = new Schema<ISellerSession>(
  {
    sellerId: {
      type: Schema.Types.ObjectId,
      ref: "Seller",
      required: true,
      index: true,
    },

    refreshTokenHash: {
      type: String,
      required: true,
      select: false,
    },

    status: {
      type: String,
      enum: SELLER_SESSION_STATUSES,
      default: "ACTIVE",
      required: true,
    },

    userAgent: String,
    ipAddress: String,
    deviceId: String,
    lastUsedAt: Date,

    expiresAt: {
      type: Date,
      required: true,
    },

    revokedAt: Date,
  },
  {
    timestamps: true,
  },
);

sellerSessionSchema.index({
  sellerId: 1,
  status: 1,
  createdAt: -1,
});

sellerSessionSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 },
);

export const SellerSession: Model<ISellerSession> =
  (models.SellerSession as Model<ISellerSession>) ??
  model<ISellerSession>("SellerSession", sellerSessionSchema);