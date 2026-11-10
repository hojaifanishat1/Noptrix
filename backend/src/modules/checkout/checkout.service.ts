import { randomBytes } from "node:crypto";
import mongoose, { Types, type HydratedDocument } from "mongoose";

import { ApiError } from "../../utils/ApiError";

import { AddressModel } from "../addresses/address.model";
import type { Address } from "../addresses/address.types";
import { CartModel } from "../cart/cart.model";
import type { CartItem } from "../cart/cart.types";
import { InventoryModel } from "../inventory/inventory.model";
import { ProductModel } from "../products/product.model";
import ProductVariantModel from "../product-variants/variant.model";
import type { ProductVariantDocument } from "../product-variants/variant.model";
import { DeliveryEligibilityService } from "../delivery-areas/delivery-eligibility.service";

import CheckoutModel from "./checkout.model";
import type {
  CheckoutAddressSnapshot,
  Checkout,
  CheckoutItemSnapshot,
  CreateCheckoutInput,
} from "./checkout.types";

const roundMoney = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const toObjectId = (value: string): Types.ObjectId => {
  if (!/^[a-f\d]{24}$/i.test(value)) {
    throw ApiError.badRequest("Invalid MongoDB ObjectId.");
  }

  return new Types.ObjectId(value);
};

const normalizeUserId = (userId: string): Types.ObjectId => toObjectId(userId);

const getAddressSnapshot = (address: Address): CheckoutAddressSnapshot => ({
  fullName: address.fullName,
  phone: address.phone,
  addressLine1: address.addressLine1,
  ...(address.addressLine2 ? { addressLine2: address.addressLine2 } : {}),
  city: address.city,
  ...(address.state ? { state: address.state } : {}),
  ...(address.postalCode ? { postalCode: address.postalCode } : {}),
  country: address.country,
});

const getOwnedAddress = async (
  addressId: string,
  userId: Types.ObjectId,
  session?: mongoose.ClientSession,
) => {
  let query = AddressModel.findOne({
    _id: toObjectId(addressId),
    userId,
    isActive: true,
  });

  if (session) query = query.session(session);

  const address = await query;

  if (!address) {
    throw ApiError.notFound("Address not found.");
  }

  return address;
};

const getPurchasableItem = async (
  cartItem: CartItem,
  session?: mongoose.ClientSession,
): Promise<CheckoutItemSnapshot> => {
  let productQuery = ProductModel.findById(cartItem.productId);

  if (session) productQuery = productQuery.session(session);

  const product = await productQuery;

  if (!product || product.archivedAt || product.status !== "ACTIVE") {
    throw ApiError.badRequest(
      `Product "${cartItem.productName}" is no longer available.`,
    );
  }

  let variant: ProductVariantDocument | null = null;

  if (cartItem.variantId) {
    let variantQuery = ProductVariantModel.findOne({
      _id: cartItem.variantId,
      productId: product._id,
      status: "ACTIVE",
    });

    if (session) variantQuery = variantQuery.session(session);

    variant = await variantQuery;

    if (!variant) {
      throw ApiError.badRequest(
        `A selected variant of "${product.name}" is no longer available.`,
      );
    }
  }

  if (product.type === "VARIABLE" && !variant) {
    throw ApiError.badRequest(`Select a variant for "${product.name}".`);
  }

  const quantity = Number(cartItem.quantity);

  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000) {
    throw ApiError.badRequest("Invalid cart item quantity.");
  }

  const trackInventory = variant
    ? variant.trackInventory
    : product.trackInventory;

  const inventoryPolicy = product.inventoryPolicy;

  let availableQuantity = 0;
  if (trackInventory) {
    const inventoryQuery = InventoryModel.aggregate<{ available: number }>([
      {
        $match: {
          productId: product._id,
          ...(variant
            ? { variantId: variant._id }
            : { variantId: { $exists: false } }),
        },
      },
      {
        $group: {
          _id: null,
          available: {
            $sum: { $subtract: ["$quantity", "$reservedQuantity"] },
          },
        },
      },
    ]);

    if (session) inventoryQuery.session(session);

    const [inventory] = await inventoryQuery.exec();
    availableQuantity = inventory?.available ?? 0;
  }

  if (
    trackInventory &&
    (variant || inventoryPolicy !== "CONTINUE") &&
    (!Number.isSafeInteger(availableQuantity) || quantity > availableQuantity)
  ) {
    throw ApiError.badRequest(`Insufficient stock for "${product.name}".`);
  }

  const price = Number(variant?.price ?? product.price);

  if (!Number.isFinite(price) || price < 0) {
    throw ApiError.badRequest(`Invalid price for "${product.name}".`);
  }

  const currency = String(product.currency || "BDT").toUpperCase();

  return {
    productId: product._id,
    ...(variant ? { variantId: variant._id } : {}),
    ...(variant?.sku || product.sku
      ? { sku: variant?.sku || product.sku }
      : {}),
    productName: String(product.name),
    ...(variant?.title ? { variantName: String(variant.title) } : {}),
    quantity,
    trackInventory,
    allowOverselling:
      trackInventory && !variant && product.inventoryPolicy === "CONTINUE",
    unitPrice: roundMoney(price),
    ...((variant?.compareAtPrice ?? product.compareAtPrice) != null
      ? {
          compareAtPrice: Number(
            variant?.compareAtPrice ?? product.compareAtPrice,
          ),
        }
      : {}),
    currency,
    lineSubtotal: roundMoney(price * quantity),
  };
};

export const createCheckout = async (
  userIdInput: string,
  input: CreateCheckoutInput,
) => {
  const userId = normalizeUserId(userIdInput);

  const existing = await CheckoutModel.findOne({
    userId,
    idempotencyKey: input.idempotencyKey,
  });

  if (existing) {
    return existing;
  }

  const session = await mongoose.startSession();
  let createdCheckout: HydratedDocument<Checkout> | undefined;

  try {
    await session.withTransaction(async () => {
      const duplicate = await CheckoutModel.findOne({
        userId,
        idempotencyKey: input.idempotencyKey,
      }).session(session);

      if (duplicate) {
        createdCheckout = duplicate;
        return;
      }

      const cart = await CartModel.findOne({
        userId,
        status: "ACTIVE",
      }).session(session);

      if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
        throw ApiError.badRequest("Your cart is empty.");
      }

      const shippingAddress = await getOwnedAddress(
        input.addressId,
        userId,
        session,
      );

      const billingAddress = input.billingAddressId
        ? await getOwnedAddress(input.billingAddressId, userId, session)
        : null;

      const items: CheckoutItemSnapshot[] = [];

      for (const cartItem of cart.items) {
        items.push(await getPurchasableItem(cartItem, session));
      }

      const currencies = new Set(items.map((item) => item.currency));

      if (currencies.size !== 1) {
        throw ApiError.badRequest(
          "All checkout items must use the same currency.",
        );
      }

      const currency = items[0].currency;
      const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

      const subtotal = roundMoney(
        items.reduce((sum, item) => sum + item.lineSubtotal, 0),
      );

      /*
       * Coupon validation, shipping fees and tax calculation must be
       * connected to the corresponding project services before charging.
       * Never trust discount, shipping or tax amounts from the client.
       */
      const discountAmount = 0;
      const taxAmount = 0;

      if (input.paymentMethod !== "cod" && input.paymentMethod !== "online") {
        throw ApiError.badRequest("Unsupported payment method.");
      }

      const addressCountryCode = String(
        shippingAddress.countryCode || "",
      ).trim().toUpperCase();

      const countryCode = /^[A-Z]{2,3}$/.test(addressCountryCode)
        ? addressCountryCode
        : (/^[A-Za-z]{2,3}$/.test(shippingAddress.country.trim())
            ? shippingAddress.country.trim().toUpperCase()
            : "");

      if (!countryCode) {
        throw ApiError.badRequest(
          "A valid ISO country code is required for delivery.",
        );
      }

      const latitude = shippingAddress.location?.latitude;
      const longitude = shippingAddress.location?.longitude;

      const eligibility = await DeliveryEligibilityService.check({
        country: countryCode,
        city: shippingAddress.city,
        ...(shippingAddress.state ? { state: shippingAddress.state } : {}),
        ...(shippingAddress.postalCode
          ? { postalCode: shippingAddress.postalCode }
          : {}),
        ...(latitude != null ? { latitude } : {}),
        ...(longitude != null ? { longitude } : {}),
        orderAmount: subtotal,
        paymentMethod: input.paymentMethod,
        ...(input.shippingMethod
          ? { methodCode: input.shippingMethod }
          : {}),
      });

      if (
        !eligibility.available ||
        !eligibility.zone ||
        !eligibility.area
      ) {
        throw ApiError.badRequest(
          eligibility.message || "Delivery is not available for this address.",
        );
      }

      const override = eligibility.feeOverride;
      let deliveryFee: number;

      if (override) {
        if (String(override.currency).toUpperCase() !== currency) {
          throw ApiError.badRequest(
            "Delivery fee currency does not match your checkout currency.",
          );
        }
        deliveryFee = Number(override.fee);
      } else {
        if (currency !== "BDT") {
          throw ApiError.badRequest(
            "A delivery fee configured in the checkout currency is required for this area.",
          );
        }
        deliveryFee = Number(eligibility.zone.deliveryFee);
      }

      const freeThreshold =
        override?.freeDeliveryThreshold ??
        eligibility.zone.freeDeliveryThreshold;

      const freeDeliveryApplied =
        freeThreshold != null && subtotal >= Number(freeThreshold);

      const shippingAmount = roundMoney(
        freeDeliveryApplied ? 0 : deliveryFee,
      );

      const deliverySnapshot = {
        zoneId: eligibility.zone.id,
        zoneName: eligibility.zone.name,
        areaId: eligibility.area.id,
        areaName: eligibility.area.name,
        ...(eligibility.method
          ? {
              methodId: eligibility.method.id,
              methodCode: eligibility.method.code,
              methodName: eligibility.method.name,
              estimatedMinMinutes:
                eligibility.method.estimatedMinMinutes,
              estimatedMaxMinutes:
                eligibility.method.estimatedMaxMinutes,
            }
          : {}),
        fee: shippingAmount,
        currency,
        freeDeliveryApplied,
        ...(eligibility.liveRider
          ? {
              distanceKm: eligibility.liveRider.distanceKm,
              estimatedTravelMinutes:
                eligibility.liveRider.estimatedTravelMinutes,
            }
          : {}),
      };

      const totalAmount = roundMoney(
        subtotal - discountAmount + shippingAmount + taxAmount,
      );

      const checkoutToken = randomBytes(32).toString("base64url");

      const checkoutDocuments = await CheckoutModel.create(
        [
          {
            userId,
            checkoutToken,
            idempotencyKey: input.idempotencyKey,
            status: "PENDING",
            paymentStatus: "PENDING",
            items,
            shippingAddress: getAddressSnapshot(shippingAddress),
            ...(billingAddress
              ? { billingAddress: getAddressSnapshot(billingAddress) }
              : {}),
            ...(input.shippingMethod
              ? { shippingMethod: input.shippingMethod }
              : {}),
            delivery: deliverySnapshot,
            paymentMethod: input.paymentMethod,
            ...(input.couponCode
              ? { couponCode: input.couponCode.toUpperCase() }
              : {}),
            totals: {
              currency,
              itemCount,
              subtotal,
              discountAmount,
              shippingAmount,
              taxAmount,
              totalAmount,
            },
            expiresAt: new Date(Date.now() + 30 * 60 * 1000),
          },
        ],
        { session },
      );

      createdCheckout = checkoutDocuments[0];
    });

    if (!createdCheckout) {
      throw ApiError.internal("Failed to create checkout.");
    }

    return createdCheckout;
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      const duplicate = await CheckoutModel.findOne({
        userId,
        idempotencyKey: input.idempotencyKey,
      });

      if (duplicate) return duplicate;
    }

    throw error;
  } finally {
    await session.endSession();
  }
};

export const getCheckout = async (userIdInput: string, checkoutId: string) => {
  const userId = normalizeUserId(userIdInput);

  const checkout = await CheckoutModel.findOne({
    _id: toObjectId(checkoutId),
    userId,
  });

  if (!checkout) {
    throw ApiError.notFound("Checkout not found.");
  }

  return checkout;
};

export const getCheckoutByToken = async (
  userIdInput: string,
  checkoutToken: string,
) => {
  const userId = normalizeUserId(userIdInput);

  const checkout = await CheckoutModel.findOne({
    userId,
    checkoutToken,
  });

  if (!checkout) {
    throw ApiError.notFound("Checkout not found.");
  }

  return checkout;
};

export const listCheckouts = async (
  userIdInput: string,
  filters: {
    status?: string;
    paymentStatus?: string;
    page?: number;
    limit?: number;
    sort?: "newest" | "oldest";
  } = {},
) => {
  const userId = normalizeUserId(userIdInput);
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 20));

  const query: Record<string, unknown> = { userId };

  if (filters.status) query.status = filters.status;
  if (filters.paymentStatus) query.paymentStatus = filters.paymentStatus;

  const [items, total] = await Promise.all([
    CheckoutModel.find(query)
      .sort({ createdAt: filters.sort === "oldest" ? 1 : -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    CheckoutModel.countDocuments(query),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const cancelCheckout = async (
  userIdInput: string,
  checkoutId: string,
) => {
  const checkout = await getCheckout(userIdInput, checkoutId);

  if (checkout.status === "COMPLETED") {
    throw ApiError.badRequest("A completed checkout cannot be cancelled here.");
  }

  if (checkout.status === "PROCESSING") {
    throw ApiError.badRequest(
      "A checkout undergoing payment processing cannot be cancelled directly.",
    );
  }

  if (checkout.status === "CANCELLED") {
    return checkout;
  }

  checkout.status = "CANCELLED";
  await checkout.save();

  return checkout;
};
