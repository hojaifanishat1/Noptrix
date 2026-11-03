import mongoose, { Types } from "mongoose";

import { ApiError } from "../../utils/ApiError";
import ProductModel from "../products/product.model";
import ProductVariantModel from "../product-variants/variant.model";
import { CartModel } from "./cart.model";

import type { AddCartItemInput } from "./cart.types";

const MAX_ITEM_QUANTITY = 1000;
const CART_EXPIRY_DAYS = 30;

function toObjectId(value: string | Types.ObjectId, label: string) {
  if (!Types.ObjectId.isValid(String(value))) {
    throw ApiError.badRequest(`Invalid ${label}`);
  }

  return new Types.ObjectId(String(value));
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function validateQuantity(quantity: number) {
  if (
    !Number.isSafeInteger(quantity) ||
    quantity < 1 ||
    quantity > MAX_ITEM_QUANTITY
  ) {
    throw ApiError.badRequest(
      `Quantity must be between 1 and ${MAX_ITEM_QUANTITY}`,
    );
  }
}

function recalculateCart(cart: {
  items: Array<{ quantity: number; unitPrice: number }>;
  itemCount: number;
  subtotal: number;
}) {
  cart.itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);

  cart.subtotal = roundMoney(
    cart.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
  );
}

function assertAvailableStock(
  quantity: number,
  trackInventory: boolean,
  stockQuantity: number,
  inventoryPolicy: string,
) {
  if (
    trackInventory &&
    inventoryPolicy !== "CONTINUE" &&
    quantity > stockQuantity
  ) {
    throw ApiError.conflict("Insufficient stock", {
      details: {
        requestedQuantity: quantity,
        availableQuantity: stockQuantity,
      },
    });
  }
}

async function getPurchasableItem(input: AddCartItemInput) {
  validateQuantity(input.quantity);

  const productId = toObjectId(input.productId, "product ID");

  const product = await ProductModel.findById(productId).lean();

  if (!product) {
    throw ApiError.notFound("Product not found");
  }

  if (product.status !== "ACTIVE" || product.archivedAt) {
    throw ApiError.badRequest("Product is not available for purchase");
  }

  let variant: InstanceType<typeof ProductVariantModel> | null = null;

  if (input.variantId) {
    const variantId = toObjectId(input.variantId, "variant ID");

    variant = await ProductVariantModel.findOne({
      _id: variantId,
      productId,
      status: "ACTIVE",
    });

    if (!variant) {
      throw ApiError.badRequest("Invalid or inactive product variant");
    }
  } else if (product.type === "VARIABLE") {
    throw ApiError.badRequest("A variant must be selected");
  }

  const price = variant?.price ?? product.price;
  const compareAtPrice = variant?.compareAtPrice ?? product.compareAtPrice;

  const trackInventory = variant
    ? variant.trackInventory
    : product.trackInventory;

  const stockQuantity = variant ? variant.stockQuantity : product.stockQuantity;

  if (!Number.isFinite(price) || price < 0) {
    throw ApiError.badRequest("Product has an invalid price");
  }

  assertAvailableStock(
    input.quantity,
    trackInventory,
    stockQuantity,
    variant ? "DENY" : product.inventoryPolicy,
  );

  return {
    productId: product._id,
    variantId: variant?._id,
    sku: variant?.sku ?? product.sku,
    productName: product.name,
    variantName: variant?.title,
    quantity: input.quantity,
    unitPrice: roundMoney(price),
    compareAtPrice,
    currency: product.currency,
    addedAt: new Date(),
    updatedAt: new Date(),
  };
}

async function getOrCreateActiveCart(
  userId: Types.ObjectId,
  session: mongoose.ClientSession,
) {
  const cart = await CartModel.findOne({
    userId,
    status: "ACTIVE",
  }).session(session);

  if (cart) return cart;

  try {
    const [created] = await CartModel.create(
      [
        {
          userId,
          items: [],
          status: "ACTIVE",
          currency: "BDT",
          itemCount: 0,
          subtotal: 0,
          expiresAt: new Date(
            Date.now() + CART_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
          ),
        },
      ],
      { session },
    );

    if (!created) {
      throw ApiError.internal("Failed to create cart");
    }

    return created;
  } catch (error) {
    const existing = await CartModel.findOne({
      userId,
      status: "ACTIVE",
    }).session(session);

    if (existing) return existing;

    throw error;
  }
}

export async function getCart(authenticatedUserId: string | Types.ObjectId) {
  const userId = toObjectId(authenticatedUserId, "user ID");

  let cart = await CartModel.findOne({
    userId,
    status: "ACTIVE",
  });

  if (cart) return cart;

  try {
    cart = await CartModel.create({
      userId,
      items: [],
      status: "ACTIVE",
      currency: "BDT",
      itemCount: 0,
      subtotal: 0,
      expiresAt: new Date(Date.now() + CART_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
    });
  } catch (error) {
    cart = await CartModel.findOne({
      userId,
      status: "ACTIVE",
    });

    if (!cart) throw error;
  }

  return cart;
}

export async function addCartItem(
  authenticatedUserId: string | Types.ObjectId,
  input: AddCartItemInput,
) {
  validateQuantity(input.quantity);

  const userId = toObjectId(authenticatedUserId, "user ID");
  const purchasable = await getPurchasableItem(input);
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const cart = await getOrCreateActiveCart(userId, session);

      if (cart.items.length > 0 && cart.currency !== purchasable.currency) {
        throw ApiError.conflict(
          "Products with different currencies cannot share a cart",
        );
      }

      const existing = cart.items.find(
        (item) =>
          String(item.productId) === String(purchasable.productId) &&
          String(item.variantId ?? "") === String(purchasable.variantId ?? ""),
      );

      const newQuantity = (existing?.quantity ?? 0) + input.quantity;

      validateQuantity(newQuantity);

      const latest = await getPurchasableItem({
        productId: String(purchasable.productId),
        variantId: purchasable.variantId
          ? String(purchasable.variantId)
          : undefined,
        quantity: newQuantity,
      });

      if (existing) {
        existing.quantity = newQuantity;
        existing.unitPrice = latest.unitPrice;
        existing.compareAtPrice = latest.compareAtPrice;
        existing.productName = latest.productName;
        existing.variantName = latest.variantName;
        existing.sku = latest.sku;
        existing.updatedAt = new Date();
      } else {
        cart.items.push(latest as never);
      }

      cart.currency = latest.currency;
      cart.expiresAt = new Date(
        Date.now() + CART_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
      );

      recalculateCart(cart);
      await cart.save({ session });
    });
  } finally {
    await session.endSession();
  }

  return getCart(userId);
}

export async function updateCartItem(
  authenticatedUserId: string | Types.ObjectId,
  itemId: string,
  quantity: number,
) {
  validateQuantity(quantity);

  const userId = toObjectId(authenticatedUserId, "user ID");
  const id = toObjectId(itemId, "cart item ID");

  const cart = await CartModel.findOne({
    userId,
    status: "ACTIVE",
  });

  if (!cart) {
    throw ApiError.notFound("Active cart not found");
  }

  const item = cart.items.find((entry) => String(entry._id) === String(id));

  if (!item) {
    throw ApiError.notFound("Cart item not found");
  }

  const refreshed = await getPurchasableItem({
    productId: String(item.productId),
    variantId: item.variantId ? String(item.variantId) : undefined,
    quantity,
  });

  item.quantity = quantity;
  item.unitPrice = refreshed.unitPrice;
  item.compareAtPrice = refreshed.compareAtPrice;
  item.productName = refreshed.productName;
  item.variantName = refreshed.variantName;
  item.sku = refreshed.sku;
  item.updatedAt = new Date();

  recalculateCart(cart);
  await cart.save();

  return getCart(userId);
}

export async function removeCartItem(
  authenticatedUserId: string | Types.ObjectId,
  itemId: string,
) {
  const userId = toObjectId(authenticatedUserId, "user ID");
  const id = toObjectId(itemId, "cart item ID");

  const cart = await CartModel.findOne({
    userId,
    status: "ACTIVE",
  });

  if (!cart) {
    throw ApiError.notFound("Active cart not found");
  }

  const item = cart.items.find((entry) => String(entry._id) === String(id));

  if (!item) {
    throw ApiError.notFound("Cart item not found");
  }

  cart.items = cart.items.filter(
    (entry) => String(entry._id) !== String(item._id),
  ) as typeof cart.items;

  recalculateCart(cart);
  await cart.save();

  return getCart(userId);
}

export async function removeCartProduct(
  authenticatedUserId: string | Types.ObjectId,
  productId: string,
  variantId?: string,
) {
  const userId = toObjectId(authenticatedUserId, "user ID");
  const productObjectId = toObjectId(productId, "product ID");

  const cart = await CartModel.findOne({
    userId,
    status: "ACTIVE",
  });

  if (!cart) {
    throw ApiError.notFound("Active cart not found");
  }

  const item = cart.items.find(
    (entry) =>
      String(entry.productId) === String(productObjectId) &&
      String(entry.variantId ?? "") === String(variantId ?? ""),
  );

  if (!item) {
    throw ApiError.notFound("Cart item not found");
  }

  cart.items = cart.items.filter(
    (entry) => String(entry._id) !== String(item._id),
  ) as typeof cart.items;

  recalculateCart(cart);
  await cart.save();

  return getCart(userId);
}

export async function clearCart(authenticatedUserId: string | Types.ObjectId) {
  const userId = toObjectId(authenticatedUserId, "user ID");

  const cart = await CartModel.findOne({
    userId,
    status: "ACTIVE",
  });

  if (!cart) return getCart(userId);

  cart.items.splice(0, cart.items.length);
  cart.appliedCouponCode = undefined;

  recalculateCart(cart);
  await cart.save();

  return cart;
}

export async function refreshCartPrices(
  authenticatedUserId: string | Types.ObjectId,
) {
  const userId = toObjectId(authenticatedUserId, "user ID");

  const cart = await CartModel.findOne({
    userId,
    status: "ACTIVE",
  });

  if (!cart) return getCart(userId);

  const removedItemIds: string[] = [];

  for (const item of [...cart.items]) {
    try {
      const refreshed = await getPurchasableItem({
        productId: String(item.productId),
        variantId: item.variantId ? String(item.variantId) : undefined,
        quantity: item.quantity,
      });

      item.unitPrice = refreshed.unitPrice;
      item.compareAtPrice = refreshed.compareAtPrice;
      item.productName = refreshed.productName;
      item.variantName = refreshed.variantName;
      item.sku = refreshed.sku;
      item.updatedAt = new Date();
    } catch {
      removedItemIds.push(String(item._id));
      cart.items = cart.items.filter(
        (entry) => String(entry._id) !== String(item._id),
      ) as typeof cart.items;
    }
  }

  recalculateCart(cart);
  await cart.save();

  return {
    cart,
    removedItemIds,
  };
}
