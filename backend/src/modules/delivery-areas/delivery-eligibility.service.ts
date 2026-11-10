import { DeliveryAreaModel } from "./delivery-area.model";
import { DeliveryMethodModel } from "../delivery-methods/delivery-method.model";
import { AreaFeeOverrideModel } from "../area-fee-overrides/area-fee-override.model";
import { DeliveryZone } from "../delivery-zones/delivery-zone.model";
import { Tracking } from "../tracking/tracking.model";
import { Rider } from "../riders/rider.model";

export interface DeliveryEligibilityInput {
  country: string;
  city: string;
  state?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  orderAmount: number;
  paymentMethod: "cod" | "online";
  methodCode?: string;
}

const ACTIVE_TRACKING_STATUSES = [
  "ASSIGNED",
  "PICKED_UP",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
] as const;

function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const rad = (value: number) => (value * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) *
      Math.cos(rad(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export class DeliveryEligibilityService {
  static async check(input: DeliveryEligibilityInput) {
    const country = input.country.trim().toUpperCase();
    const city = input.city.trim();

    let area: any = null;
    let zone: any = null;

    const hasCoordinates =
      Number.isFinite(input.latitude) &&
      Number.isFinite(input.longitude);

    if (hasCoordinates) {
      const point = {
        type: "Point",
        coordinates: [input.longitude, input.latitude],
      };

      area = await DeliveryAreaModel.findOne({
        status: "ACTIVE",
        boundary: { $geoIntersects: { $geometry: point } },
      })
        .sort({ priority: -1 })
        .lean();

      if (!area) {
        return {
          available: false,
          reason: "ADDRESS_OUTSIDE_DELIVERY_AREA",
          message: "Delivery is not available at this location.",
        };
      }

      zone = await DeliveryZone.findOne({
        _id: area.zoneId,
        status: "active",
        country,
      }).lean();
    } else {
      if (!input.postalCode) {
        return {
          available: false,
          reason: "LOCATION_REQUIRED",
          message: "Provide a map location or postal code to check delivery.",
        };
      }

      const escapedCity = city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      area = await DeliveryAreaModel.findOne({
        status: "ACTIVE",
        city: new RegExp(`^${escapedCity}$`, "i"),
        postalCodes: input.postalCode.trim(),
      })
        .sort({ priority: -1 })
        .lean();

      if (!area) {
        return {
          available: false,
          reason: "AREA_NOT_FOUND",
          message: "Delivery is not available for this postal code.",
        };
      }

      zone = await DeliveryZone.findOne({
        _id: area.zoneId,
        status: "active",
        country,
      }).lean();
    }

    if (!zone) {
      return {
        available: false,
        reason: "ZONE_INACTIVE",
        message: "Delivery is not available in this area.",
      };
    }

    if (
      input.state &&
      zone.state &&
      zone.state.toLowerCase() !== input.state.trim().toLowerCase()
    ) {
      return {
        available: false,
        reason: "STATE_MISMATCH",
        message: "The selected delivery area does not match the address.",
      };
    }

    if (input.orderAmount < (zone.minimumOrderAmount ?? 0)) {
      return {
        available: false,
        reason: "MINIMUM_ORDER_NOT_MET",
        minimumOrderAmount: zone.minimumOrderAmount,
        message: "Order amount is below the delivery minimum.",
      };
    }

    if (input.paymentMethod === "cod" && !zone.supportsCOD) {
      return {
        available: false,
        reason: "COD_NOT_SUPPORTED",
        message: "Cash on delivery is not supported in this area.",
      };
    }

    let method: any = null;

    if (input.methodCode) {
      method = await DeliveryMethodModel.findOne({
        code: input.methodCode.trim().toUpperCase(),
        status: "ACTIVE",
      }).lean();

      if (!method) {
        return {
          available: false,
          reason: "METHOD_UNAVAILABLE",
          message: "The selected delivery method is unavailable.",
        };
      }

      if (method.requiresAreaCoverage && !area.boundary) {
        return {
          available: false,
          reason: "AREA_COVERAGE_REQUIRED",
          message: "This delivery method requires mapped area coverage.",
        };
      }
    }

    let liveRider: {
      id: unknown;
      name: string;
      riderCode: string;
      distanceKm: number;
      lastLocationAt: Date;
      estimatedTravelMinutes: number;
    } | null = null;

    if (method?.requiresLiveRider) {
      if (!hasCoordinates) {
        return {
          available: false,
          reason: "CUSTOMER_LOCATION_REQUIRED",
          message: "A map location is required for this delivery method.",
        };
      }

      const freshnessCutoff = new Date(Date.now() - 5 * 60 * 1000);

      const [riders, workloads] = await Promise.all([
        Rider.find({
          status: "ACTIVE",
          isAvailable: true,
          lastLocationAt: { $gte: freshnessCutoff },
          currentLatitude: { $exists: true, $ne: null },
          currentLongitude: { $exists: true, $ne: null },
        })
          .select(
            "_id name riderCode currentLatitude currentLongitude lastLocationAt maxActiveDeliveries",
          )
          .lean(),

        Tracking.aggregate([
          {
            $match: {
              status: { $in: ACTIVE_TRACKING_STATUSES },
              riderId: { $exists: true, $ne: null },
            },
          },
          {
            $group: {
              _id: "$riderId",
              activeCount: { $sum: 1 },
            },
          },
        ]),
      ]);

      const workloadMap = new Map<string, number>(
        workloads.map((item: any) => [
          String(item._id),
          Number(item.activeCount),
        ]),
      );

      const candidates = riders
        .filter((rider: any) => {
          const workload = workloadMap.get(String(rider._id)) ?? 0;
          const capacity = Math.max(
            1,
            Number(rider.maxActiveDeliveries ?? 1),
          );

          return workload < capacity;
        })
        .map((rider: any) => {
          const distanceKm = calculateDistanceKm(
            input.latitude!,
            input.longitude!,
            Number(rider.currentLatitude),
            Number(rider.currentLongitude),
          );

          return {
            rider,
            distanceKm,
            lastLocationAt: rider.lastLocationAt,
            estimatedTravelMinutes: Math.ceil((distanceKm / 20) * 60),
          };
        })
        .filter(
          (candidate: any) =>
            method.maximumDistanceKm == null ||
            candidate.distanceKm <= method.maximumDistanceKm,
        )
        .sort((a: any, b: any) => a.distanceKm - b.distanceKm);

      if (!candidates.length) {
        return {
          available: false,
          reason: "NO_LIVE_RIDER_AVAILABLE",
          message:
            "No nearby rider with fresh GPS and available capacity was found.",
        };
      }

      const nearest = candidates[0];

      liveRider = {
        id: nearest.rider._id,
        name: nearest.rider.name,
        riderCode: nearest.rider.riderCode,
        distanceKm: Number(nearest.distanceKm.toFixed(2)),
        lastLocationAt: nearest.lastLocationAt,
        estimatedTravelMinutes: nearest.estimatedTravelMinutes,
      };
    }

    const now = new Date();

    const overrideFilter: Record<string, any> = {
      areaId: area._id,
      status: "ACTIVE",
      $and: [
        {
          $or: [
            { validFrom: { $exists: false } },
            { validFrom: null },
            { validFrom: { $lte: now } },
          ],
        },
        {
          $or: [
            { validUntil: { $exists: false } },
            { validUntil: null },
            { validUntil: { $gt: now } },
          ],
        },
      ],
    };

    overrideFilter.$or = method
      ? [
          { methodId: method._id },
          { methodId: { $exists: false } },
          { methodId: null },
        ]
      : [
          { methodId: { $exists: false } },
          { methodId: null },
        ];

    const override = await AreaFeeOverrideModel.findOne(overrideFilter)
      .sort({ priority: -1, createdAt: -1 })
      .lean();

    if (
      override &&
      input.orderAmount < Number(override.minimumOrderAmount ?? 0)
    ) {
      return {
        available: false,
        reason: "AREA_MINIMUM_ORDER_NOT_MET",
        minimumOrderAmount: override.minimumOrderAmount,
        message: "Order amount is below the minimum for this delivery area.",
      };
    }

    return {
      available: true,
      area: {
        id: area._id,
        name: area.name,
        city: area.city,
      },
      zone: {
        id: zone._id,
        name: zone.name,
        deliveryFee: Number(zone.deliveryFee ?? 0),
        freeDeliveryThreshold: zone.freeDeliveryThreshold ?? null,
        minimumOrderAmount: Number(zone.minimumOrderAmount ?? 0),
        supportsCOD: zone.supportsCOD,
      },
      method: method
        ? {
            id: method._id,
            code: method.code,
            name: method.name,
            estimatedMinMinutes: method.estimatedMinMinutes,
            estimatedMaxMinutes: method.estimatedMaxMinutes,
            requiresLiveRider: method.requiresLiveRider,
          }
        : null,
      liveRider,
      feeOverride: override
        ? {
            id: override._id,
            fee: Number(override.fee),
            currency: override.currency,
            freeDeliveryThreshold:
              override.freeDeliveryThreshold ?? null,
            minimumOrderAmount: Number(
              override.minimumOrderAmount ?? 0,
            ),
          }
        : null,
    };
  }
}
