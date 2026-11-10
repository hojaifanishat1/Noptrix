import mongoose, { Types } from "mongoose";
import { DeliveryAreaModel } from "./delivery-area.model";

export class DeliveryAreaServiceError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message);
    this.name = "DeliveryAreaServiceError";
  }
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export class DeliveryAreaService {
  static async create(input: Record<string, any>) {
    if (!(await mongoose.model("DeliveryZone").exists({ _id: input.zoneId }))) {
      throw new DeliveryAreaServiceError("Delivery zone not found.", 404);
    }

    try {
      return await DeliveryAreaModel.create({
        ...input,
        zoneId: new Types.ObjectId(input.zoneId),
      });
    } catch (error: any) {
      if (error?.code === 11000) {
        throw new DeliveryAreaServiceError(
          "An area with this slug already exists in this zone.", 409,
        );
      }
      throw error;
    }
  }

  static async getById(id: string) {
    const item = await DeliveryAreaModel.findById(id).populate("zoneId");
    if (!item) throw new DeliveryAreaServiceError("Delivery area not found.", 404);
    return item;
  }

  static async update(id: string, input: Record<string, any>) {
    const item = await DeliveryAreaModel.findById(id);
    if (!item) throw new DeliveryAreaServiceError("Delivery area not found.", 404);

    item.set(input);

    try {
      return await item.save();
    } catch (error: any) {
      if (error?.code === 11000) {
        throw new DeliveryAreaServiceError(
          "An area with this slug already exists in this zone.", 409,
        );
      }
      throw error;
    }
  }

  static async setStatus(id: string, status: "ACTIVE" | "INACTIVE") {
    return this.update(id, { status });
  }

  static async remove(id: string) {
    const item = await DeliveryAreaModel.findByIdAndDelete(id);
    if (!item) throw new DeliveryAreaServiceError("Delivery area not found.", 404);
    return { deleted: true, id };
  }

  static async list(query: any) {
    const filter: Record<string, any> = {};

    if (query.zoneId) filter.zoneId = new Types.ObjectId(query.zoneId);
    if (query.status) filter.status = query.status;
    if (query.city) filter.city = new RegExp(`^${escapeRegex(query.city)}$`, "i");

    if (query.search) {
      const regex = new RegExp(escapeRegex(query.search), "i");
      filter.$or = [{ name: regex }, { slug: regex }, { city: regex }];
    }

    const sort: Record<string, 1 | -1> =
      query.sort === "oldest" ? { createdAt: 1 } :
      query.sort === "name" ? { name: 1 } :
      query.sort === "priority" ? { priority: -1, createdAt: -1 } :
      { createdAt: -1 };

    const skip = (query.page - 1) * query.limit;

    const [items, total] = await Promise.all([
      DeliveryAreaModel.find(filter)
        .populate("zoneId", "name city country")
        .sort(sort).skip(skip).limit(query.limit).lean(),
      DeliveryAreaModel.countDocuments(filter),
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
}
