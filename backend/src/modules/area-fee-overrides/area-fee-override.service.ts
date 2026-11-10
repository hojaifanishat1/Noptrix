import { Types } from "mongoose";
import { AreaFeeOverrideModel } from "./area-fee-override.model";
import { DeliveryAreaModel } from "../delivery-areas/delivery-area.model";
import { DeliveryMethodModel } from "../delivery-methods/delivery-method.model";

export class AreaFeeOverrideServiceError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message);
    this.name = "AreaFeeOverrideServiceError";
  }
}

export class AreaFeeOverrideService {
  static async validateReferences(input: Record<string, any>) {
    if (input.areaId) {
      const area = await DeliveryAreaModel.findById(input.areaId).lean();
      if (!area) throw new AreaFeeOverrideServiceError("Delivery area not found.", 404);
      if (area.status !== "ACTIVE") {
        throw new AreaFeeOverrideServiceError("Cannot assign an override to an inactive area.", 400);
      }
    }

    if (input.methodId) {
      const method = await DeliveryMethodModel.findById(input.methodId).lean();
      if (!method) throw new AreaFeeOverrideServiceError("Delivery method not found.", 404);
      if (method.status !== "ACTIVE") {
        throw new AreaFeeOverrideServiceError("Cannot assign an override to an inactive method.", 400);
      }
    }
  }

  static async create(input: Record<string, any>) {
    await this.validateReferences(input);
    return AreaFeeOverrideModel.create({
      ...input,
      areaId: new Types.ObjectId(input.areaId),
      ...(input.methodId ? { methodId: new Types.ObjectId(input.methodId) } : {}),
      currency: input.currency.toUpperCase(),
    });
  }

  static async getById(id: string) {
    const item = await AreaFeeOverrideModel.findById(id)
      .populate("areaId").populate("methodId");
    if (!item) throw new AreaFeeOverrideServiceError("Area fee override not found.", 404);
    return item;
  }

  static async update(id: string, input: Record<string, any>) {
    const item = await AreaFeeOverrideModel.findById(id);
    if (!item) throw new AreaFeeOverrideServiceError("Area fee override not found.", 404);

    await this.validateReferences(input);
    const changes: Record<string, any> = { ...input };

    if (input.areaId) changes.areaId = new Types.ObjectId(input.areaId);
    if (input.methodId) changes.methodId = new Types.ObjectId(input.methodId);
    if (input.currency) changes.currency = input.currency.toUpperCase();

    item.set(changes);
    return item.save();
  }

  static async setStatus(id: string, status: "ACTIVE" | "INACTIVE") {
    return this.update(id, { status });
  }

  static async remove(id: string) {
    const item = await AreaFeeOverrideModel.findByIdAndDelete(id);
    if (!item) throw new AreaFeeOverrideServiceError("Area fee override not found.", 404);
    return { deleted: true, id };
  }

  static async list(query: any) {
    const filter: Record<string, any> = {};
    if (query.areaId) filter.areaId = new Types.ObjectId(query.areaId);
    if (query.methodId) filter.methodId = new Types.ObjectId(query.methodId);
    if (query.status) filter.status = query.status;

    const sort: Record<string, 1 | -1> =
      query.sort === "oldest" ? { createdAt: 1 } :
      query.sort === "priority" ? { priority: -1, createdAt: -1 } :
      { createdAt: -1 };

    const skip = (query.page - 1) * query.limit;
    const [items, total] = await Promise.all([
      AreaFeeOverrideModel.find(filter)
        .populate("areaId", "name slug city zoneId")
        .populate("methodId", "name code")
        .sort(sort).skip(skip).limit(query.limit).lean(),
      AreaFeeOverrideModel.countDocuments(filter),
    ]);

    return {
      items,
      pagination: {
        page: query.page, limit: query.limit, total,
        totalPages: Math.ceil(total / query.limit),
        hasNextPage: skip + items.length < total,
        hasPreviousPage: query.page > 1,
      },
    };
  }
}
