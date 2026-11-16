import { Types, startSession } from "mongoose";

import { ApiError } from "../../utils/ApiError";
import { Rider } from "./rider.model";
import { JobApplication } from "../job-applications/application.model";
import { Vacancy, VACANCY_TYPES } from "../job-vacancies/vacancy.model";
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

    const applicationObjectId = new Types.ObjectId(applicationId);
    const ownerObjectId = new Types.ObjectId(ownerId);
    const session = await startSession();

    try {
        session.startTransaction();

        const application = await JobApplication.findById(
            applicationObjectId,
        ).session(session);

        if (!application) {
            throw ApiError.notFound("Job application not found.");
        }

        if (application.status !== "SELECTED") {
            throw ApiError.badRequest(
                "Only SELECTED applicants can be converted into riders.",
            );
        }

        if (application.riderId || application.convertedToRiderAt) {
            throw ApiError.conflict(
                "This application has already been converted into a rider.",
            );
        }

        const vacancy = await Vacancy.findById(
            application.vacancyId,
        ).session(session);

        if (!vacancy) {
            throw ApiError.notFound("Related vacancy not found.");
        }

        if (vacancy.vacancyType !== VACANCY_TYPES.RIDER) {
            throw ApiError.badRequest(
                "Only RIDER vacancies can be converted into riders.",
            );
        }

        const existingRider = await Rider.findOne({
            $or: [
                { userId: application.applicantId },
                { jobApplicationId: application._id },
            ],
        }).session(session);

        if (existingRider) {
            throw ApiError.conflict(
                "This applicant already has a rider profile.",
            );
        }

        const riderCode = input.riderCode.trim().toUpperCase();
        const email = application.email.trim().toLowerCase();

        const duplicate = await Rider.findOne({
            $or: [
                { riderCode },
                { email },
            ],
        }).session(session);

        if (duplicate) {
            throw ApiError.conflict(
                "Rider code or email already exists.",
            );
        }

        const [rider] = await Rider.create(
            [
                {
                    userId: application.applicantId,
                    jobApplicationId: application._id,
                    riderCode,
                    type: input.type,
                    name: application.name,
                    email,
                    phone: input.phone ?? application.phone,
                    vehicleType: input.vehicleType,
                    vehicleNumber: input.vehicleNumber,
                    licenseNumber: input.licenseNumber,
                    nationalId: input.nationalId,
                    joinedAt: input.joinedAt ?? new Date(),
                    notes: input.notes,
                    status: "PENDING",
                    isAvailable: false,
                    createdBy: ownerObjectId,
                },
            ],
            { session },
        );

        application.riderId = rider._id;
        application.convertedToRiderAt = new Date();
        application.convertedToRiderBy = ownerObjectId;

        await application.save({ session });
        await session.commitTransaction();

        return rider;
    } catch (error: unknown) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }

        if (
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            error.code === 11000
        ) {
            throw ApiError.conflict(
                "This applicant has already been converted or the rider details already exist.",
            );
        }

        throw error;
    } finally {
        await session.endSession();
    }
};
