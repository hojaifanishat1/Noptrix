import { Document, Model, Schema, Types, model } from "mongoose";

import {
  RIDER_STATUSES,
  RIDER_TYPES,
  RIDER_VEHICLE_TYPES,
  RiderStatus,
  RiderType,
  RiderVehicleType,
} from "./rider.types";

/*
|--------------------------------------------------------------------------
| Rider Document
|--------------------------------------------------------------------------
*/

export interface IRider extends Document {
  userId: Types.ObjectId;
  jobApplicationId?: Types.ObjectId;

  riderCode: string;

  type: RiderType;

  name: string;

  email: string;

  phone?: string;

  vehicleType?: RiderVehicleType;

  vehicleNumber?: string;

  licenseNumber?: string;

  nationalId?: string;

  status: RiderStatus;
  isAvailable: boolean;
  currentLatitude?: number;
  currentLongitude?: number;
  lastLocationAt?: Date;
  maxActiveDeliveries: number;

  joinedAt?: Date;

  suspendedAt?: Date;

  suspendedBy?: Types.ObjectId;

  suspensionReason?: string;

  terminatedAt?: Date;

  terminatedBy?: Types.ObjectId;

  terminationReason?: string;

  notes?: string;

  createdBy?: Types.ObjectId;

  updatedBy?: Types.ObjectId;

  createdAt: Date;

  updatedAt: Date;
}

/*
|--------------------------------------------------------------------------
| Schema
|--------------------------------------------------------------------------
*/

const riderSchema = new Schema<IRider>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    jobApplicationId: {
      type: Schema.Types.ObjectId,
      ref: "JobApplication",
    },

    riderCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
      maxlength: 50,
    },

    type: {
      type: String,
      enum: RIDER_TYPES,
      required: true,
      default: "INTERNAL",
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
    },

    phone: {
      type: String,
      trim: true,
      maxlength: 30,
    },

    vehicleType: {
      type: String,
      enum: RIDER_VEHICLE_TYPES,
      index: true,
    },

    vehicleNumber: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 50,
    },

    licenseNumber: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 100,
    },

    nationalId: {
      type: String,
      trim: true,
      maxlength: 100,
    },

    isAvailable: {
    type: Boolean,
    default: false,
    index: true,
  },

  currentLatitude: {
    type: Number,
    min: -90,
    max: 90,
  },

  currentLongitude: {
    type: Number,
    min: -180,
    max: 180,
  },

  lastLocationAt: {
    type: Date,
    index: true,
  },

  maxActiveDeliveries: {
    type: Number,
    default: 1,
    min: 1,
    max: 20,
    validate: {
      validator: Number.isInteger,
      message: "Maximum active deliveries must be an integer.",
    },
  },

  status: {
      type: String,
      enum: RIDER_STATUSES,
      required: true,
      default: "PENDING",
      index: true,
    },

    joinedAt: {
      type: Date,
    },

    suspendedAt: {
      type: Date,
    },

    suspendedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    suspensionReason: {
      type: String,
      trim: true,
      maxlength: 2000,
    },

    terminatedAt: {
      type: Date,
    },

    terminatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    terminationReason: {
      type: String,
      trim: true,
      maxlength: 2000,
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 5000,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  },
);

/*
|--------------------------------------------------------------------------
| Indexes
|--------------------------------------------------------------------------
*/

riderSchema.index({
  status: 1,
  createdAt: -1,
});

riderSchema.index({
  type: 1,
  status: 1,
});

riderSchema.index({
  vehicleType: 1,
  status: 1,
});

riderSchema.index({
  name: 1,
  status: 1,
});

riderSchema.index({
  email: 1,
  status: 1,
});

/*
|--------------------------------------------------------------------------
| Model
|--------------------------------------------------------------------------
*/

riderSchema.index({ jobApplicationId: 1 }, { unique: true, sparse: true });

export const Rider: Model<IRider> = model<IRider>("Rider", riderSchema);


riderSchema.index({
  status: 1,
  isAvailable: 1,
  lastLocationAt: -1,
});
