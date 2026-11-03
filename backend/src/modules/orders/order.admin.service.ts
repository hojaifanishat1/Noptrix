import { OrderModel } from "./order.model";
import type { AdminOrderQuery } from "./order.admin.validator";
import { ApiError } from "../../utils/ApiError";

const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const listAdminOrders = async (filters: AdminOrderQuery) => {
  const page = filters.page;
  const limit = filters.limit;

  const query: Record<string, unknown> = {};

  if (filters.status) {
    query.status = filters.status;
  }

  if (filters.paymentStatus) {
    query.paymentStatus = filters.paymentStatus;
  }

  if (filters.search) {
    const search = escapeRegex(filters.search);
    query.$or = [
      { orderNumber: { $regex: search, $options: "i" } },
      { "shippingAddress.fullName": { $regex: search, $options: "i" } },
      { "shippingAddress.email": { $regex: search, $options: "i" } },
      { "shippingAddress.phone": { $regex: search, $options: "i" } },
      { "items.productName": { $regex: search, $options: "i" } },
    ];
  }

  const [items, total] = await Promise.all([
    OrderModel.find(query)
      .select("-__v")
      .sort({
        createdAt: filters.sort === "oldest" ? 1 : -1,
        _id: filters.sort === "oldest" ? 1 : -1,
      })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()
      .exec(),
    OrderModel.countDocuments(query),
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
};

export const getAdminOrderById = async (orderId: string) => {
  const order = await OrderModel.findById(orderId).select("-__v").exec();

  if (!order) {
    throw ApiError.notFound("Order not found.", {
      code: "ORDER_NOT_FOUND",
    });
  }

  return order;
};
