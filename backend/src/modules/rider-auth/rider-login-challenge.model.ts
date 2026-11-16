import {
    Schema,
    model,
    models,
    type Types,
} from "mongoose";

export type RiderLoginChallengeStatus =
    | "PENDING"
    | "VERIFIED"
    | "LOCKED";

export interface IRiderLoginChallenge {
    riderId: Types.ObjectId;
    codeHash: string;
    challengeIdHash: string;
    status: RiderLoginChallengeStatus;
    attempts: number;
    maxAttempts: number;
    expiresAt: Date;
    resendAvailableAt: Date;
    verifiedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const riderLoginChallengeSchema =
    new Schema<IRiderLoginChallenge>(
        {
            riderId: {
                type: Schema.Types.ObjectId,
                ref: "Rider",
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
                enum: [
                    "PENDING",
                    "VERIFIED",
                    "LOCKED",
                ],
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

riderLoginChallengeSchema.index(
    { expiresAt: 1 },
    { expireAfterSeconds: 0 },
);

riderLoginChallengeSchema.index({
    riderId: 1,
    status: 1,
});

export const RiderLoginChallenge =
    models.RiderLoginChallenge ||
    model<IRiderLoginChallenge>(
        "RiderLoginChallenge",
        riderLoginChallengeSchema,
    );