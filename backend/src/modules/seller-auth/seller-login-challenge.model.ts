import {
  Schema,
  model,
  models,
  type Types,
} from "mongoose";

export type SellerLoginChallengeStatus =
  | "PENDING"
  | "VERIFIED"
  | "LOCKED";

export interface ISellerLoginChallenge {
  sellerId: Types.ObjectId;
  codeHash: string;
  challengeIdHash: string;
  status: SellerLoginChallengeStatus;
  attempts: number;
  maxAttempts: number;
  expiresAt: Date;
  resendAvailableAt: Date;
  verifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const sellerLoginChallengeSchema =
  new Schema<ISellerLoginChallenge>(
    {
      sellerId: {
        type: Schema.Types.ObjectId,
        ref: "Seller",
        required: true,
        index: true,
      },

      codeHash: {
        type: String,
        required: true,
        select: false,
      },

      challengeIdHash: {
        type: String,
        required: true,
        select: false,
      },

      status: {
        type: String,
        enum: ["PENDING", "VERIFIED", "LOCKED"],
        default: "PENDING",
        required: true,
      },

      attempts: {
        type: Number,
        default: 0,
        min: 0,
      },

      maxAttempts: {
        type: Number,
        required: true,
        default: 5,
      },

      expiresAt: {
        type: Date,
        required: true,
      },

      resendAvailableAt: {
        type: Date,
        required: true,
      },

      verifiedAt: {
        type: Date,
      },
    },
    {
      timestamps: true,
      versionKey: false,
    },
  );

sellerLoginChallengeSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 },
);

sellerLoginChallengeSchema.index({
  sellerId: 1,
  status: 1,
});

export const SellerLoginChallenge =
  models.SellerLoginChallenge ||
  model<ISellerLoginChallenge>(
    "SellerLoginChallenge",
    sellerLoginChallengeSchema,
  );
