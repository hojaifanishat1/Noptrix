import { Types } from "mongoose";

import { DeliveryFee } from "./delivery-fee.model";
import type {
  CreateDeliveryFeeInput,
  UpdateDeliveryFeeInput,
  ListDeliveryFeesInput,
  CalculateDeliveryFeeInput,
} from "./delivery-fee.validator";

export class DeliveryFeeServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "DeliveryFeeServiceError";
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeCountry(value: string): string {
  return value.trim().toUpperCase();
}

function normalizeCity(value: string): string {
  return value.trim().toLowerCase();
}

export class DeliveryFeeService {
  static async create(input: CreateDeliveryFeeInput, actorId?: string) {
    const duplicate = await DeliveryFee.exists({ slug: input.slug });

    if (duplicate) {
      throw new DeliveryFeeServiceError(
        "A delivery fee rule with this slug already exists.",
        409,
      );
    }

    const data: Record<string, unknown> = {
      ...input,
      country: normalizeCountry(input.country),
    };

    if (input.deliveryZoneId) {
      data.deliveryZoneId = new Types.ObjectId(input.deliveryZoneId);
    }

    if (input.deliveryMethodId) {
      data.deliveryMethodId = new Types.ObjectId(input.deliveryMethodId);
    }

    if (actorId && Types.ObjectId.isValid(actorId)) {
      data.createdBy = new Types.ObjectId(actorId);
      data.updatedBy = new Types.ObjectId(actorId);
    }

    try {
      return await DeliveryFee.create(data);
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === 11000
      ) {
        throw new DeliveryFeeServiceError(
          "A delivery fee rule with this slug already exists.",
          409,
        );
      }
      throw error;
    }
  }

  static async getById(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new DeliveryFeeServiceError("Invalid delivery fee ID.", 400);
    }

    const fee = await DeliveryFee.findById(id).lean();

    if (!fee) {
      throw new DeliveryFeeServiceError("Delivery fee rule not found.", 404);
    }

    return fee;
  }

  static async getBySlug(slug: string) {
    const fee = await DeliveryFee.findOne({ slug }).lean();

    if (!fee) {
      throw new DeliveryFeeServiceError("Delivery fee rule not found.", 404);
    }

    return fee;
  }

  static async update(
    id: string,
    input: UpdateDeliveryFeeInput,
    actorId?: string,
  ) {
    if (!Types.ObjectId.isValid(id)) {
      throw new DeliveryFeeServiceError("Invalid delivery fee ID.", 400);
    }

    const fee = await DeliveryFee.findById(id);

    if (!fee) {
      throw new DeliveryFeeServiceError("Delivery fee rule not found.", 404);
    }

    if (input.slug && input.slug !== fee.slug) {
      const duplicate = await DeliveryFee.exists({
        slug: input.slug,
        _id: { $ne: fee._id },
      });

      if (duplicate) {
        throw new DeliveryFeeServiceError(
          "A delivery fee rule with this slug already exists.",
          409,
        );
      }
    }

    const changes: Record<string, unknown> = { ...input };

    if (input.country) {
      changes.country = normalizeCountry(input.country);
    }

    if (input.deliveryZoneId) {
      changes.deliveryZoneId = new Types.ObjectId(input.deliveryZoneId);
    }

    if (input.deliveryMethodId) {
      changes.deliveryMethodId = new Types.ObjectId(input.deliveryMethodId);
    } else if (input.deliveryMethodId === undefined) {
      // Keep an existing method assignment unless explicitly changed.
    }

    if (actorId && Types.ObjectId.isValid(actorId)) {
      changes.updatedBy = new Types.ObjectId(actorId);
    }

    fee.set(changes);

    try {
      return await fee.save();
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === 11000
      ) {
        throw new DeliveryFeeServiceError(
          "A delivery fee rule with this slug already exists.",
          409,
        );
      }
      throw error;
    }
  }

  static async setStatus(
    id: string,
    status: "active" | "inactive",
    actorId?: string,
  ) {
    return this.update(id, { status }, actorId);
  }

  static async remove(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new DeliveryFeeServiceError("Invalid delivery fee ID.", 400);
    }

    const fee = await DeliveryFee.findByIdAndDelete(id);

    if (!fee) {
      throw new DeliveryFeeServiceError("Delivery fee rule not found.", 404);
    }

    return { deleted: true, id };
  }

  static async list(query: ListDeliveryFeesInput) {
    const filter: Record<string, unknown> = {};

    if (query.country) {
      filter.country = normalizeCountry(query.country);
    }

    if (query.city) {
      filter.city = {
        $regex: `^${escapeRegex(query.city)}$`,
        $options: "i",
      };
    }

    if (query.status) filter.status = query.status;
    if (query.method) filter.method = query.method;

    if (query.deliveryZoneId) {
      filter.deliveryZoneId = new Types.ObjectId(query.deliveryZoneId);
    }

    if (query.deliveryMethodId) {
      filter.deliveryMethodId = new Types.ObjectId(query.deliveryMethodId);
    }

    if (query.search) {
      const regex = new RegExp(escapeRegex(query.search), "i");
      filter.$or = [{ name: regex }, { slug: regex }];
    }

    const sort: Record<string, 1 | -1> =
      query.sort === "oldest"
        ? { createdAt: 1 }
        : query.sort === "name"
          ? { name: 1 }
          : query.sort === "priority"
            ? { priority: -1, createdAt: -1 }
            : { createdAt: -1 };

    const skip = (query.page - 1) * query.limit;

    const [items, total] = await Promise.all([
      DeliveryFee.find(filter).sort(sort).skip(skip).limit(query.limit).lean(),
      DeliveryFee.countDocuments(filter),
    ]);

    return {
      items,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
        hasNextPage: skip + items.length < total,
        hasPreviousPage: query.page > 1,
      },
    };
  }


  static async calculate(input: CalculateDeliveryFeeInput) {
    const country = normalizeCountry(input.country);
    const city = normalizeCity(input.city);
    const weightKg = input.weightKg;

    const baseFilter: Record<string, unknown> = {
      country,
      status: "active",
      $or: [
        { city: { $exists: false } },
        { city: "" },
        { city: { $regex: `^${escapeRegex(city)}$`, $options: "i" } },
      ],
    };

    const allRules = await DeliveryFee.find(baseFilter)
      .sort({ priority: -1, createdAt: -1 })
      .lean();

    const matchingRules = allRules.filter((rule) => {
      if (input.state) {
        if (rule.state && normalizeCity(rule.state) !== normalizeCity(input.state)) {
          return false;
        }
      } else if (rule.state) {
        return false;
      }

      if (input.deliveryZoneId) {
        if (
          rule.deliveryZoneId &&
          rule.deliveryZoneId.toString() !== input.deliveryZoneId
        ) return false;
      } else if (rule.deliveryZoneId) {
        return false;
      }

      if (input.postalCode) {
        if (
          rule.postalCodes.length &&
          !rule.postalCodes.includes(input.postalCode.trim())
        ) return false;
      } else if (rule.postalCodes.length) {
        return false;
      }

      if (input.paymentMethod === "cod" && !rule.supportsCOD) return false;
      if (input.orderAmount < rule.minimumOrderAmount) return false;

      if (rule.deliveryMethodId) {
        if (
          !input.deliveryMethodId ||
          rule.deliveryMethodId.toString() !== input.deliveryMethodId
        ) return false;
      }

      if (
        rule.method === "weight_based" &&
        (weightKg === undefined || !Number.isFinite(weightKg))
      ) return false;

      if (weightKg !== undefined) {
        if (weightKg < rule.minimumWeightKg) return false;
        if (
          rule.maximumWeightKg !== undefined &&
          weightKg > rule.maximumWeightKg
        ) return false;
      }

      return true;
    });

    // Exact selected method first. Methodless legacy rules are fallback.
    const methodRules = input.deliveryMethodId
      ? matchingRules.filter(
          (rule) =>
            rule.deliveryMethodId?.toString() === input.deliveryMethodId,
        )
      : matchingRules.filter((rule) => !rule.deliveryMethodId);

    const legacyRules = input.deliveryMethodId
      ? matchingRules.filter((rule) => !rule.deliveryMethodId)
      : [];

    const rules = [...methodRules, ...legacyRules];

    rules.sort((a, b) => {
      const specificity = (rule: (typeof rules)[number]) =>
        (rule.deliveryZoneId ? 8 : 0) +
        (rule.postalCodes.length ? 4 : 0) +
        (rule.city ? 2 : 0) +
        (rule.state ? 1 : 0);

      return specificity(b) - specificity(a) || b.priority - a.priority;
    });

    // Keep exact method rules ahead of legacy fallback rules.
    const rule =
      methodRules.length > 0
        ? [...methodRules].sort((a, b) => {
            const score = (r: (typeof rules)[number]) =>
              (r.deliveryZoneId ? 8 : 0) +
              (r.postalCodes.length ? 4 : 0) +
              (r.city ? 2 : 0) +
              (r.state ? 1 : 0);
            return score(b) - score(a) || b.priority - a.priority;
          })[0]
        : legacyRules.sort((a, b) => b.priority - a.priority)[0];

    if (!rule) {
      return {
        available: false,
        fee: 0,
        currency: "BDT" as const,
        freeDelivery: false,
        message: "No applicable delivery fee rule was found.",
      };
    }

    if (
      rule.freeDeliveryThreshold !== undefined &&
      input.orderAmount >= rule.freeDeliveryThreshold
    ) {
      return {
        available: true,
        fee: 0,
        currency: "BDT" as const,
        freeDelivery: true,
        ruleId: rule._id.toString(),
        ruleName: rule.name,
        message: "Free delivery threshold reached.",
      };
    }

    let fee = rule.baseFee;

    if (rule.method === "weight_based") {
      if (weightKg === undefined || !Number.isFinite(weightKg)) {
        return {
          available: false,
          fee: 0,
          currency: "BDT" as const,
          freeDelivery: false,
          message: "Product shipping weight is required for this delivery fee.",
        };
      }
      fee += weightKg * rule.perKgFee;
    }

    fee = Math.round((fee + Number.EPSILON) * 100) / 100;

    return {
      available: true,
      fee,
      currency: "BDT" as const,
      freeDelivery: false,
      ruleId: rule._id.toString(),
      ruleName: rule.name,
      message: "Delivery fee calculated successfully.",
    };
  }

}
