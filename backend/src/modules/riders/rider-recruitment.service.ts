import { Types } from "mongoose";

import { ApiError } from "../../utils/ApiError";
import { JobApplication } from "../job-applications/application.model";
import { Vacancy, VACANCY_TYPES } from "../job-vacancies/vacancy.model";
import {
  createRiderInvitation,
  revokeRiderInvitation,
} from "../rider-invitations/rider-invitation.service";
import { ConvertSelectedApplicationToRiderInput } from "./rider.validator";

export const convertSelectedApplicationToRider = async (
  applicationId: string,
  ownerId: string,
  input: ConvertSelectedApplicationToRiderInput,
) => {
  if (!Types.ObjectId.isValid(applicationId)) {
    throw ApiError.badRequest("Invalid job application ID.");
  }

  if (!Types.ObjectId.isValid(ownerId)) {
    throw ApiError.badRequest("Invalid owner ID.");
  }

  const application = await JobApplication.findById(applicationId).exec();

  if (!application) {
    throw ApiError.notFound("Job application not found.");
  }

  if (application.status !== "SELECTED") {
    throw ApiError.badRequest(
      "Only SELECTED applicants can receive a Rider invitation.",
    );
  }

  if (
    application.riderId ||
    application.convertedToRiderAt ||
    application.riderInvitationId
  ) {
    throw ApiError.conflict(
      "This application already has a Rider conversion or invitation in progress.",
    );
  }

  const vacancy = await Vacancy.findById(application.vacancyId).exec();

  if (!vacancy) {
    throw ApiError.notFound("Related vacancy not found.");
  }

  if (vacancy.vacancyType !== VACANCY_TYPES.RIDER) {
    throw ApiError.badRequest(
      "Only RIDER vacancy applicants can receive a Rider invitation.",
    );
  }

  const riderCode = input.riderCode.trim().toUpperCase();

  const invitation = await createRiderInvitation(
    ownerId,
    {
      name: application.name,
      email: application.email.trim().toLowerCase(),
      phone: input.phone ?? application.phone,
      type: input.type,
      vehicleType: input.vehicleType,
      vehicleNumber: input.vehicleNumber,
      licenseNumber: input.licenseNumber,
      nationalId: input.nationalId,
    },
    {
      applicationId: application._id.toString(),
      riderCode,
    },
  );

  try {
    const updatedApplication = await JobApplication.findOneAndUpdate(
      {
        _id: application._id,
        status: "SELECTED",
        riderId: { $exists: false },
        riderInvitationId: { $exists: false },
        convertedToRiderAt: { $exists: false },
      },
      {
        $set: {
          riderInvitationId: new Types.ObjectId(invitation.invitationId),
          riderInvitationSentAt: new Date(),
          riderInvitationSentBy: new Types.ObjectId(ownerId),
        },
      },
      { new: true },
    ).exec();

    if (!updatedApplication) {
      await revokeRiderInvitation(invitation.invitationId, ownerId);

      throw ApiError.conflict(
        "The application changed while the invitation was being sent. Please review it and try again.",
      );
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("application changed")) {
      throw error;
    }
    throw error;
  }

  return {
    ...invitation,
    applicationId: application._id.toString(),
    riderCode,
    message:
      "Rider invitation sent. The Rider account will be created after the applicant accepts and sets a password.",
  };
};
