import type { RequestHandler } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { getAuthenticatedRiderId } from "../../middlewares/riderAuth.middleware";
import { RiderSettingsModel } from "./rider-settings.model";
import { updateRiderSettingsSchema } from "./rider-settings.validator";

export const getMyRiderSettingsController: RequestHandler = asyncHandler(
  async (req, res) => {
    const riderId = getAuthenticatedRiderId(req);

    const settings = await RiderSettingsModel.findOneAndUpdate(
      { riderId },
      { $setOnInsert: { riderId } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean();

    res.status(200).json({
      success: true,
      message: "Rider settings retrieved.",
      data: settings,
    });
  },
);

export const updateMyRiderSettingsController: RequestHandler = asyncHandler(
  async (req, res) => {
    const riderId = getAuthenticatedRiderId(req);
    const input = updateRiderSettingsSchema.parse(req.body);

    const update: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(input.notifications ?? {})) {
      update[`notifications.${key}`] = value;
    }

    for (const [key, value] of Object.entries(input.app ?? {})) {
      update[`app.${key}`] = value;
    }

    const settings = await RiderSettingsModel.findOneAndUpdate(
      { riderId },
      {
        $set: update,
        $setOnInsert: { riderId },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    ).lean();

    res.status(200).json({
      success: true,
      message: "Rider settings updated.",
      data: settings,
    });
  },
);
