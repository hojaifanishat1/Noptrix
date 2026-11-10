import { Types } from "mongoose";
import { DeliveryMethodModel } from "./delivery-method.model";

export class DeliveryMethodServiceError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message);
    this.name = "DeliveryMethodServiceError";
  }
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export class DeliveryMethodService {
  static async create(input: Record<string, any>) {
    try {
      return await DeliveryMethodModel.create({
        ...input, code: input.code.toUpperCase(),
      });
    } catch (error: any) {
      if (error?.code === 11000) {
        throw new DeliveryMethodServiceError("Delivery method code already exists.", 409);
      }
      throw error;
    }
  }

  static async getById(id: string) {
    const item = await DeliveryMethodModel.findById(id);
    if (!item) throw new DeliveryMethodServiceError("Delivery method not found.", 404);
    return item;
  }

  static async update(id: string, input: Record<string, any>) {
    const item = await DeliveryMethodModel.findById(id);
    if (!item) throw new DeliveryMethodServiceError("Delivery method not found.", 404);

    item.set({
      ...input,
      ...(input.code ? { code: input.code.toUpperCase() } : {}),
    });

    try {
      return await item.save();
    } catch (error: any) {
      if (error?.code === 11000) {
        throw new DeliveryMethodServiceError("Delivery method code already exists.", 409);
      }
      throw error;
    }
  }

  static async setStatus(id: string, status: "ACTIVE" | "INACTIVE") {
    return this.update(id, { status });
  }

  static async remove(id: string) {
    const item = await DeliveryMethodModel.findByIdAndDelete(id);
    if (!item) throw new DeliveryMethodServiceError("Delivery method not found.", 404);
    return { deleted: true, id };
  }

  static async list(query: any) {
    const filter: Record<string, any> = {};
    if (query.status) filter.status = query.status;

    if (query.search) {
      const regex = new RegExp(escapeRegex(query.search), "i");
      filter.$or = [{ code: regex }, { name: regex }];
    }

    const sort: Record<string, 1 | -1> =
      query.sort === "oldest" ? { createdAt: 1 } :
      query.sort === "name" ? { name: 1 } :
      query.sort === "priority" ? { priority: -1, createdAt: -1 } :
      { createdAt: -1 };

    const skip = (query.page - 1) * query.limit;
    const [items, total] = await Promise.all([
      DeliveryMethodModel.find(filter).sort(sort).skip(skip).limit(query.limit).lean(),
      DeliveryMethodModel.countDocuments(filter),
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
