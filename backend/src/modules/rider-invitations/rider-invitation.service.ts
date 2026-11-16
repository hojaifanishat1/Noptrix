import { createHash, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { ClientSession, startSession, Types } from "mongoose";

import { env } from "../../config/env";
import { sendEmail } from "../../services/email.service";
import { ApiError } from "../../utils/ApiError";

import { Rider } from "../riders/rider.model";
import { JobApplication } from "../job-applications/application.model";
import { RiderInvitation } from "./rider-invitation.model";

import {
  AcceptRiderInvitationInput,
  CreateRiderInvitationInput,
  RiderInvitationQuery,
} from "./rider-invitation.validator";

const INVITATION_EXPIRY_HOURS = 48;
const PASSWORD_SALT_ROUNDS = 12;

const normalizeEmail = (email: string) =>
  email.trim().toLowerCase();

const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const isDuplicateKeyError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === 11000;

const getActiveInvitation = async (
  token: string,
  session?: ClientSession,
) => {
  const invitation = await RiderInvitation.findOne({
    tokenHash: hashToken(token.trim()),
  })
    .select("+tokenHash")
    .session(session ?? null)
    .exec();

  if (!invitation) {
    throw ApiError.badRequest("Invalid rider invitation token.");
  }

  if (invitation.status !== "PENDING") {
    throw ApiError.badRequest(
      "This rider invitation is no longer active.",
    );
  }

  if (invitation.expiresAt.getTime() <= Date.now()) {
    if (!session) {
      await RiderInvitation.updateOne(
        {
          _id: invitation._id,
          status: "PENDING",
          expiresAt: { $lte: new Date() },
        },
        {
          $set: { status: "EXPIRED" },
        },
      ).exec();
    }

    throw ApiError.badRequest("This rider invitation has expired.");
  }

  return invitation;
};

/*
|--------------------------------------------------------------------------
| Create Rider Invitation
|--------------------------------------------------------------------------
*/

export const createRiderInvitation = async (
  invitedBy: string,
  input: CreateRiderInvitationInput,
  options?: { applicationId?: string; riderCode?: string },
) => {
  if (!Types.ObjectId.isValid(invitedBy)) {
    throw ApiError.badRequest("Invalid inviter ID.");
  }

  const email = normalizeEmail(input.email);
  const now = new Date();

  if (
    options?.applicationId &&
    !Types.ObjectId.isValid(options.applicationId)
  ) {
    throw ApiError.badRequest("Invalid job application ID.");
  }

  const riderCode =
    options?.riderCode?.trim().toUpperCase() ||
    `RDR-${randomBytes(6).toString("hex").toUpperCase()}`;

  if (await Rider.exists({ email })) {
    throw ApiError.conflict(
      "A rider profile already exists with this email.",
    );
  }

  /*
   * Expire old pending invitations before checking for duplicates.
   */
  await RiderInvitation.updateMany(
    {
      email,
      status: "PENDING",
      expiresAt: { $lte: now },
    },
    {
      $set: { status: "EXPIRED" },
    },
  ).exec();

  const pendingInvitation = await RiderInvitation.exists({
    email,
    status: "PENDING",
    expiresAt: { $gt: now },
  });

  if (pendingInvitation) {
    throw ApiError.conflict(
      "A pending rider invitation already exists for this email.",
    );
  }

  const duplicateRiderCode = await Rider.exists({ riderCode });

  if (duplicateRiderCode) {
    throw ApiError.conflict("Rider code already exists.");
  }

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(
    now.getTime() + INVITATION_EXPIRY_HOURS * 60 * 60 * 1000,
  );

  let invitation;

  try {
    invitation = await RiderInvitation.create({
      ...input,
      email,
      riderCode,
      applicationId: options?.applicationId
        ? new Types.ObjectId(options.applicationId)
        : undefined,
      tokenHash: hashToken(token),
      invitedBy: new Types.ObjectId(invitedBy),
      status: "PENDING",
      expiresAt,
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw ApiError.conflict(
        "A pending rider invitation already exists for this email.",
      );
    }

    throw error;
  }

  const actionUrl =
    `${env.APP_URL.replace(/\/+$/, "")}/rider-invitation/${token}`;

  const formattedExpiry = expiresAt.toLocaleString("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });

  /*
   * The invitation is created before email delivery.
   * If delivery fails, revoke it so the undisclosed token
   * cannot leave a permanently pending invitation behind.
   */
  try {
    const result = await sendEmail({
      to: email,
      subject: `You're invited to join ${env.APP_NAME} as a rider`,
      text:
        `Hello ${invitation.name},\n\n` +
        `You have been invited to join ${env.APP_NAME} as a rider.\n\n` +
        `Accept your invitation here:\n${actionUrl}\n\n` +
        `This invitation expires at ${formattedExpiry} UTC.\n\n` +
        `If you were not expecting this invitation, you can ignore this email.`,
    });

    const acceptedRecipients = result.accepted.map((address) =>
      address.trim().toLowerCase(),
    );

    if (
      result.rejected.some(
        (address) => address.trim().toLowerCase() === email,
      ) ||
      !acceptedRecipients.includes(email)
    ) {
      throw new Error("The invitation email was not accepted by the mail server.");
    }
  } catch (error) {
    await RiderInvitation.updateOne(
      {
        _id: invitation._id,
        status: "PENDING",
      },
      {
        $set: {
          status: "REVOKED",
          revokedAt: new Date(),
          revokedBy: new Types.ObjectId(invitedBy),
        },
      },
    ).exec();

    throw error;
  }

  return {
    invitationId: invitation._id.toString(),
    name: invitation.name,
    email: invitation.email,
    status: invitation.status,
    expiresAt: invitation.expiresAt,
  };
};

/*
|--------------------------------------------------------------------------
| Validate Invitation Token
|--------------------------------------------------------------------------
*/

export const getRiderInvitationByToken = async (token: string) => {
  const invitation = await getActiveInvitation(token);

  return {
    invitationId: invitation._id.toString(),
    name: invitation.name,
    email: invitation.email,
    phone: invitation.phone,
    type: invitation.type,
    vehicleType: invitation.vehicleType,
    vehicleNumber: invitation.vehicleNumber,
    riderCode: invitation.riderCode,
    expiresAt: invitation.expiresAt,
    requiresPassword: true,
  };
};

export const acceptRiderInvitation = async (
  input: AcceptRiderInvitationInput,
) => {
  if (input.password !== input.confirmPassword) {
    throw ApiError.badRequest("Password and confirm password do not match.");
  }

  const session = await startSession();

  try {
    session.startTransaction();

    const invitation = await getActiveInvitation(input.token, session);
    const email = normalizeEmail(invitation.email);

    const existingRider = await Rider.findOne({ email })
      .session(session)
      .exec();

    if (existingRider) {
      throw ApiError.conflict(
        "A rider account already exists with this email address.",
      );
    }

    const acceptedAt = new Date();

    const lockedInvitation = await RiderInvitation.findOneAndUpdate(
      {
        _id: invitation._id,
        status: "PENDING",
        expiresAt: { $gt: acceptedAt },
      },
      {
        $set: {
          status: "ACCEPTED",
          acceptedAt,
        },
      },
      {
        new: true,
        session,
      },
    ).exec();

    if (!lockedInvitation) {
      throw ApiError.conflict(
        "This rider invitation has already been processed or expired.",
      );
    }

    const hashedPassword = await bcrypt.hash(
      input.password,
      PASSWORD_SALT_ROUNDS,
    );

    const [rider] = await Rider.create(
      [
        {
          riderCode: invitation.riderCode,
          jobApplicationId: invitation.applicationId,
          type: invitation.type,
          name: invitation.name,
          email,
          phone: invitation.phone,
          password: hashedPassword,
          passwordChangedAt: acceptedAt,
          failedLoginAttempts: 0,
          vehicleType: invitation.vehicleType,
          vehicleNumber: invitation.vehicleNumber,
          licenseNumber: invitation.licenseNumber,
          nationalId: invitation.nationalId,
          status: "ACTIVE",
          onboardingStatus: "IN_PROGRESS",
          isAvailable: false,
          createdBy: invitation.invitedBy,
        },
      ],
      { session },
    );

    lockedInvitation.riderId = rider._id;
    await lockedInvitation.save({ session });

    if (invitation.applicationId) {
      const applicationUpdate = await JobApplication.updateOne(
        {
          _id: invitation.applicationId,
          status: "SELECTED",
          riderInvitationId: invitation._id,
          riderId: { $exists: false },
          convertedToRiderAt: { $exists: false },
        },
        {
          $set: {
            riderId: rider._id,
            convertedToRiderAt: acceptedAt,
            convertedToRiderBy: invitation.invitedBy,
          },
        },
        { session },
      ).exec();

      if (applicationUpdate.matchedCount !== 1) {
        throw ApiError.conflict(
          "The related job application has already been processed.",
        );
      }
    }

    await session.commitTransaction();

    return {
      riderId: rider._id.toString(),
      riderCode: rider.riderCode,
      email: rider.email,
      status: rider.status,
      onboardingStatus: rider.onboardingStatus,
      message:
        "Rider account activated. Complete your onboarding to start accepting deliveries.",
    };
  } catch (error: unknown) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }

    if (isDuplicateKeyError(error)) {
      throw ApiError.conflict(
        "This rider account or rider code already exists, or the invitation was already accepted.",
      );
    }

    throw error;
  } finally {
    await session.endSession();
  }
};

export const listRiderInvitations = async (
  query: RiderInvitationQuery,
) => {
  const now = new Date();

  /*
   * Update expired invitations before listing.
   */
  await RiderInvitation.updateMany(
    {
      status: "PENDING",
      expiresAt: { $lte: now },
    },
    {
      $set: { status: "EXPIRED" },
    },
  ).exec();

  const filter: Record<string, unknown> = {};

  if (query.status) {
    filter.status = query.status;
  }

  if (query.search?.trim()) {
    const search = escapeRegex(query.search.trim());

    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } },
    ];
  }

  const page = query.page ?? 1;
  const limit = query.limit ?? 20;

  const [invitations, total] = await Promise.all([
    RiderInvitation.find(filter)
      .select("-tokenHash")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()
      .exec(),

    RiderInvitation.countDocuments(filter),
  ]);

  return {
    invitations,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/*
|--------------------------------------------------------------------------
| Revoke Rider Invitation
|--------------------------------------------------------------------------
*/

export const revokeRiderInvitation = async (
  invitationId: string,
  revokedBy: string,
) => {
  if (
    !Types.ObjectId.isValid(invitationId) ||
    !Types.ObjectId.isValid(revokedBy)
  ) {
    throw ApiError.badRequest("Invalid rider invitation ID.");
  }

  const now = new Date();

  /*
   * Do not revoke an already expired invitation as if it were pending.
   */
  await RiderInvitation.updateOne(
    {
      _id: invitationId,
      status: "PENDING",
      expiresAt: { $lte: now },
    },
    {
      $set: { status: "EXPIRED" },
    },
  ).exec();

  const invitation = await RiderInvitation.findOneAndUpdate(
    {
      _id: invitationId,
      status: "PENDING",
      expiresAt: { $gt: now },
    },
    {
      $set: {
        status: "REVOKED",
        revokedAt: now,
        revokedBy: new Types.ObjectId(revokedBy),
      },
    },
    {
      new: true,
    },
  )
    .select("-tokenHash")
    .exec();

  if (!invitation) {
    throw ApiError.notFound(
      "Pending rider invitation not found.",
    );
  }

  return invitation;
};
