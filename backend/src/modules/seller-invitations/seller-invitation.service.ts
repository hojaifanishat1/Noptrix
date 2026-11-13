import { createHash, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { Types } from "mongoose";
import { env } from "../../config/env";

import { ApiError } from "../../utils/ApiError";
import { sendEmail } from "../../services/email.service";

import { SellerInvitation } from "./seller-invitation.model";
import { SellerApplication } from "../seller-applications/seller-application.model";
import { Seller } from "../sellers/seller.model";

import type { AcceptSellerInvitationInput } from "./seller-invitation.validator";

const PASSWORD_SALT_ROUNDS = 12;
const INVITATION_EXPIRY_DAYS = 3;

const hashToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

const createRawToken = (): string =>
  randomBytes(32).toString("hex");

const normalizeEmail = (email: string): string =>
  email.trim().toLowerCase();

const generateSellerCode = (): string =>
  `SEL-${Date.now().toString(36).toUpperCase()}-${randomBytes(4)
    .toString("hex")
    .toUpperCase()}`;

const getInvitationUrl = (token: string): string => {
  const appUrl = env.APP_URL.replace(/\/+$/, "");

  return `${appUrl}/seller/invitation/${encodeURIComponent(token)}`;
};

/*
|--------------------------------------------------------------------------
| Create / Resend Seller Invitation
|--------------------------------------------------------------------------
*/

export const createSellerInvitation = async (
  applicationId: string,
  reviewerUserId: string,
) => {
  if (!Types.ObjectId.isValid(applicationId)) {
    throw ApiError.badRequest("Invalid application ID.");
  }

  if (!Types.ObjectId.isValid(reviewerUserId)) {
    throw ApiError.badRequest("Invalid reviewer ID.");
  }

  const application = await SellerApplication.findById(applicationId);

  if (!application) {
    throw ApiError.notFound("Seller application not found.");
  }

  if (application.status !== "APPROVED") {
    throw ApiError.badRequest(
      "Only approved applications can receive seller invitations.",
    );
  }

  const email = normalizeEmail(application.email);

  const existingSeller = await Seller.findOne({
    $or: [
      { sourceApplicationId: application._id },
      { email },
    ],
  });

  if (existingSeller) {
    throw ApiError.conflict(
      "A seller account already exists for this application or email.",
    );
  }

  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  );

  const rawToken = createRawToken();
  const tokenHash = hashToken(rawToken);

  let invitation = await SellerInvitation.findOne({
    applicationId: application._id,
  });

  if (invitation?.status === "ACCEPTED") {
    throw ApiError.conflict("This seller invitation was already accepted.");
  }

  if (invitation) {
    invitation.email = email;
    invitation.tokenHash = tokenHash;
    invitation.status = "PENDING";
    invitation.expiresAt = expiresAt;
    invitation.sentAt = now;
    invitation.acceptedAt = undefined;
    invitation.acceptedSellerId = undefined;
    invitation.createdBy = new Types.ObjectId(reviewerUserId);
    await invitation.save();
  } else {
    invitation = await SellerInvitation.create({
      applicationId: application._id,
      email,
      tokenHash,
      status: "PENDING",
      expiresAt,
      sentAt: now,
      createdBy: new Types.ObjectId(reviewerUserId),
    });
  }

  const invitationUrl = getInvitationUrl(rawToken);

  const formattedExpiry = expiresAt.toLocaleString("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });

  const sellerName =
    application.legalName?.trim() || application.businessName.trim();

  try {
    await sendEmail({
      to: email,
      subject: `Your ${env.APP_NAME} seller invitation is ready.`,
      text: [
        `Hello ${sellerName},`,
        "",
        `Your seller application for ${env.APP_NAME} has been approved.`,
        "",
        `Business: ${application.businessName}`,
        `Seller type: ${application.type}`,
        "",
        "Create your separate Seller account using this link:",
        invitationUrl,
        "",
        `This invitation expires on ${formattedExpiry} (UTC).`,
        "",
        "Your Seller account will remain pending until Owner verification.",
        "",
        "You do not need an existing customer account.",
      ].join("\n"),
      templateKey: "seller.invitation.created",
      templateLocale: "en",
      templateVariables: {
        sellerName,
        businessName: application.businessName,
        sellerType: application.type,
        companyName: env.APP_NAME,
        invitationUrl,
        expiresAt: formattedExpiry,
      },
      requireTemplate: true,
    });
  } catch (error) {
    invitation.status = "REVOKED";
    await invitation.save();
    throw error;
  }

  return {
    sent: true,
    invitationId: invitation._id,
    applicationId: application._id,
    email,
    status: invitation.status,
    expiresAt: invitation.expiresAt,
    sentAt: invitation.sentAt,
  };
};

/*
|--------------------------------------------------------------------------
| Preview Seller Invitation
|--------------------------------------------------------------------------
*/

export const getSellerInvitationPreview = async (token: string) => {
  const tokenHash = hashToken(token);

  const invitation = await SellerInvitation.findOne({
    tokenHash,
  }).select("+tokenHash");

  if (!invitation || invitation.status !== "PENDING") {
    throw ApiError.badRequest("This seller invitation is invalid or no longer available.");
  }

  if (invitation.expiresAt <= new Date()) {
    invitation.status = "EXPIRED";
    await invitation.save();

    throw ApiError.badRequest("Seller invitation has expired.");
  }

  const application = await SellerApplication.findById(
    invitation.applicationId,
  );

  if (
    !application ||
    application.status !== "APPROVED" ||
    normalizeEmail(application.email) !== normalizeEmail(invitation.email)
  ) {
    throw ApiError.badRequest("This seller invitation is invalid or no longer available.");
  }

  return {
    name: application.legalName?.trim() || application.businessName.trim(),
    businessName: application.businessName,
    email: normalizeEmail(invitation.email),
    phone: application.phone ?? null,
  };
};

/*
|--------------------------------------------------------------------------
| Accept Invitation — Create Independent Seller Account
|--------------------------------------------------------------------------
*/

export const acceptSellerInvitation = async (
  input: AcceptSellerInvitationInput,
) => {
  const tokenHash = hashToken(input.token);

  const invitation = await SellerInvitation.findOne({
    tokenHash,
  }).select("+tokenHash");

  if (!invitation) {
    throw ApiError.badRequest("Invalid seller invitation.");
  }

  if (invitation.status !== "PENDING") {
    throw ApiError.badRequest("This seller invitation is no longer valid.");
  }

  if (invitation.expiresAt <= new Date()) {
    invitation.status = "EXPIRED";
    await invitation.save();
    throw ApiError.badRequest("Seller invitation has expired.");
  }

  const application = await SellerApplication.findById(
    invitation.applicationId,
  );

  if (!application || application.status !== "APPROVED") {
    throw ApiError.badRequest(
      "The associated seller application is not approved.",
    );
  }

  const email = normalizeEmail(invitation.email);

  if (normalizeEmail(application.email) !== email) {
    throw ApiError.badRequest(
      "Invitation email does not match the approved application.",
    );
  }

  const existingSeller = await Seller.findOne({
    $or: [
      { email },
      { sourceApplicationId: application._id },
    ],
  });

  if (existingSeller) {
    throw ApiError.conflict("A seller account already exists.");
  }

  const password = await bcrypt.hash(
    input.password,
    PASSWORD_SALT_ROUNDS,
  );

  const seller = await Seller.create({
    sourceApplicationId: application._id,
    sellerCode: generateSellerCode(),
    type: application.type,
    businessName: application.businessName,
    legalName: application.legalName,
    email,
    phone: application.phone,
    password,
    failedLoginAttempts: 0,
    taxNumber: application.taxNumber,
    registrationNumber: application.registrationNumber,
    description: application.description,
    logoUrl: application.logoUrl,
    website: application.website,
    status: "PENDING",
  });

  invitation.status = "ACCEPTED";
  invitation.acceptedAt = new Date();
  invitation.acceptedSellerId = seller._id as Types.ObjectId;
  await invitation.save();

  return {
    sellerId: seller._id,
    sellerCode: seller.sellerCode,
    email: seller.email,
    status: seller.status,
  };
};
