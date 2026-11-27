import { Document, Model, Schema, Types, model } from "mongoose";

export interface IRiderAnnouncementRecipient extends Document {
  announcementId: Types.ObjectId;
  riderId: Types.ObjectId;
  deliveredAt?: Date;
  readAt?: Date;
  dismissedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const riderAnnouncementRecipientSchema =
  new Schema<IRiderAnnouncementRecipient>(
    {
      announcementId: {
        type: Schema.Types.ObjectId,
        ref: "Announcement",
        required: true,
      },

      riderId: {
        type: Schema.Types.ObjectId,
        ref: "Rider",
        required: true,
      },

      deliveredAt: Date,
      readAt: Date,
      dismissedAt: Date,
    },
    {
      timestamps: true,
      versionKey: false,
    },
  );

riderAnnouncementRecipientSchema.index(
  { announcementId: 1, riderId: 1 },
  {
    unique: true,
    name: "rider_announcement_recipient_unique",
  },
);

riderAnnouncementRecipientSchema.index(
  { riderId: 1, readAt: 1, createdAt: -1 },
  { name: "rider_announcement_inbox" },
);

export const RiderAnnouncementRecipient = model<
  IRiderAnnouncementRecipient,
  Model<IRiderAnnouncementRecipient>
>(
  "RiderAnnouncementRecipient",
  riderAnnouncementRecipientSchema,
);
