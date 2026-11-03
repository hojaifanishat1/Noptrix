import { Types } from "mongoose";

import { ApiError } from "../../utils/ApiError";
import ProductModel from "../products/product.model";
import ProductVariantModel from "./variant.model";

import type { VariantActor, VariantInput } from "./variant.types";
import type { VariantListQuery } from "./variant.validator";

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

function normalizeSku(value: string | undefined): string | undefined {
  return normalizeOptional(value)?.toUpperCase();
}

function normalizeOptions(
  options: Record<string, string> | undefined,
): Map<string, string> {
  const result = new Map<string, string>();
  const normalizedKeys = new Set<string>();

  for (const [key, value] of Object.entries(options ?? {})) {
    const normalizedKey = key.trim();
    const normalizedValue = value.trim();

    if (!normalizedKey || !normalizedValue) {
      throw ApiError.badRequest(
        "Variant option names and values cannot be empty.",
      );
    }

    const comparisonKey = normalizedKey.toLowerCase();

    if (normalizedKeys.has(comparisonKey)) {
      throw ApiError.badRequest(
        `Duplicate variant option name: ${normalizedKey}.`,
      );
    }

    normalizedKeys.add(comparisonKey);
    result.set(normalizedKey, normalizedValue);
  }

  if (result.size === 0) {
    throw ApiError.badRequest(
      "At least one option is required for a product variant.",
    );
  }

  return result;
}

function createOptionsKey(options: Map<string, string>): string {
  const canonical = [...options.entries()]
    .map(
      ([key, value]) =>
        [key.trim().toLowerCase(), value.trim().toLowerCase()] as const,
    )
    .sort(([a], [b]) => a.localeCompare(b));

  return JSON.stringify(canonical);
}

function validatePriceRelations(input: {
  price?: number;
  compareAtPrice?: number;
}): void {
  if (
    input.price !== undefined &&
    input.compareAtPrice !== undefined &&
    input.compareAtPrice < input.price
  ) {
    throw ApiError.badRequest(
      "compareAtPrice must be greater than or equal to price.",
    );
  }
}

function validateActorId(actor: VariantActor): Types.ObjectId {
  if (!Types.ObjectId.isValid(actor.userId)) {
    throw ApiError.unauthorized("Invalid authenticated administrator.");
  }

  return new Types.ObjectId(actor.userId);
}

async function ensureVariableProduct(productId: string) {
  if (!Types.ObjectId.isValid(productId)) {
    throw ApiError.badRequest("Invalid product ID.");
  }

  const product = await ProductModel.findById(productId)
    .select("type")
    .lean()
    .exec();

  if (!product) {
    throw ApiError.notFound("Product not found.");
  }

  if (product.type !== "VARIABLE") {
    throw ApiError.badRequest(
      "Variants can only be managed for VARIABLE products.",
      { code: "PRODUCT_VARIANTS_NOT_ALLOWED" },
    );
  }

  return product;
}

function handleDuplicateKey(error: unknown): never {
  const mongoError = error as {
    code?: number;
    keyPattern?: Record<string, unknown>;
  };

  if (mongoError?.code === 11000) {
    const fields = Object.keys(mongoError.keyPattern ?? {});
    const field = fields.find(
      (key) => key === "sku" || key === "barcode" || key === "optionsKey",
    );

    if (field === "optionsKey") {
      throw ApiError.conflict(
        "A variant with the same option combination already exists.",
        { code: "DUPLICATE_VARIANT_OPTIONS" },
      );
    }

    throw ApiError.conflict(
      field === "barcode"
        ? "A variant with this barcode already exists for this product."
        : "A variant with this SKU already exists for this product.",
      { code: "DUPLICATE_VARIANT_IDENTIFIER" },
    );
  }

  throw error;
}

async function ensureUniqueFields(
  productId: string,
  input: { sku?: string; barcode?: string },
  excludeId?: string,
): Promise<void> {
  const baseFilter: Record<string, unknown> = {
    productId: new Types.ObjectId(productId),
  };

  if (excludeId) {
    if (!Types.ObjectId.isValid(excludeId)) {
      throw ApiError.badRequest("Invalid variant ID.");
    }

    baseFilter._id = { $ne: new Types.ObjectId(excludeId) };
  }

  const checks: Promise<unknown>[] = [];

  if (input.sku) {
    checks.push(ProductVariantModel.exists({ ...baseFilter, sku: input.sku }));
  }

  if (input.barcode) {
    checks.push(
      ProductVariantModel.exists({ ...baseFilter, barcode: input.barcode }),
    );
  }

  const results = await Promise.all(checks);

  if (results.some(Boolean)) {
    throw ApiError.conflict(
      "A variant with this SKU or barcode already exists for this product.",
      { code: "DUPLICATE_VARIANT_IDENTIFIER" },
    );
  }
}

async function ensureUniqueOptions(
  productId: string,
  optionsKey: string,
  excludeId?: string,
): Promise<void> {
  const filter: Record<string, unknown> = {
    productId: new Types.ObjectId(productId),
    optionsKey,
  };

  if (excludeId) {
    filter._id = { $ne: new Types.ObjectId(excludeId) };
  }

  const duplicate = await ProductVariantModel.exists(filter);

  if (duplicate) {
    throw ApiError.conflict(
      "A variant with the same option combination already exists.",
      { code: "DUPLICATE_VARIANT_OPTIONS" },
    );
  }
}

export async function createVariant(
  productId: string,
  input: VariantInput,
  actor: VariantActor,
) {
  await ensureVariableProduct(productId);

  const actorId = validateActorId(actor);
  const sku = normalizeSku(input.sku);
  const barcode = normalizeOptional(input.barcode);
  const options = normalizeOptions(input.options);

  validatePriceRelations({
    price: input.price,
    compareAtPrice: input.compareAtPrice,
  });

  await ensureUniqueFields(productId, { sku, barcode });
  await ensureUniqueOptions(productId, createOptionsKey(options));

  try {
    return await ProductVariantModel.create({
      ...input,
      productId: new Types.ObjectId(productId),
      title: input.title.trim(),
      sku,
      barcode,
      options,
      optionsKey: createOptionsKey(options),
      trackInventory: input.trackInventory ?? true,
      stockQuantity: 0,
      lowStockThreshold: input.lowStockThreshold ?? 5,
      status: input.status ?? "ACTIVE",
      sortOrder: input.sortOrder ?? 0,
      createdBy: actorId,
      updatedBy: actorId,
    });
  } catch (error) {
    handleDuplicateKey(error);
  }
}

export async function listVariants(productId: string, query: VariantListQuery) {
  await ensureVariableProduct(productId);

  const filter: Record<string, unknown> = {
    productId: new Types.ObjectId(productId),
  };

  if (query.status) filter.status = query.status;

  if (query.search) {
    const escaped = query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    filter.$or = [
      { title: { $regex: escaped, $options: "i" } },
      { sku: { $regex: escaped, $options: "i" } },
      { barcode: { $regex: escaped, $options: "i" } },
    ];
  }

  const direction = query.sortOrder === "desc" ? -1 : 1;
  const skip = (query.page - 1) * query.limit;

  const [items, total] = await Promise.all([
    ProductVariantModel.find(filter)
      .sort({ [query.sortBy]: direction, _id: 1 })
      .skip(skip)
      .limit(query.limit)
      .lean()
      .exec(),
    ProductVariantModel.countDocuments(filter).exec(),
  ]);

  return {
    items,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export async function getVariant(productId: string, id: string) {
  await ensureVariableProduct(productId);

  if (!Types.ObjectId.isValid(id)) {
    throw ApiError.badRequest("Invalid variant ID.");
  }

  const variant = await ProductVariantModel.findOne({
    _id: new Types.ObjectId(id),
    productId: new Types.ObjectId(productId),
  }).exec();

  if (!variant) {
    throw ApiError.notFound("Product variant not found.");
  }

  return variant;
}

export async function updateVariant(
  productId: string,
  id: string,
  input: Partial<VariantInput>,
  actor: VariantActor,
) {
  const variant = await getVariant(productId, id);
  const actorId = validateActorId(actor);

  const nextPrice = input.price !== undefined ? input.price : variant.price;

  const nextCompareAtPrice =
    input.compareAtPrice !== undefined
      ? input.compareAtPrice
      : variant.compareAtPrice;

  validatePriceRelations({
    price: nextPrice,
    compareAtPrice: nextCompareAtPrice,
  });

  const nextSku =
    input.sku !== undefined ? normalizeSku(input.sku) : variant.sku;

  const nextBarcode =
    input.barcode !== undefined
      ? normalizeOptional(input.barcode)
      : variant.barcode;

  await ensureUniqueFields(
    productId,
    { sku: nextSku, barcode: nextBarcode },
    id,
  );

  const updates: Record<string, unknown> = { ...input };

  if (input.title !== undefined) {
    updates.title = input.title.trim();
  }

  if (input.sku !== undefined) updates.sku = nextSku;
  if (input.barcode !== undefined) updates.barcode = nextBarcode;

  if (input.options !== undefined) {
    const normalizedOptions = normalizeOptions(input.options);
    const optionsKey = createOptionsKey(normalizedOptions);

    await ensureUniqueOptions(productId, optionsKey, id);

    updates.options = normalizedOptions;
    updates.optionsKey = optionsKey;
  }

  updates.updatedBy = actorId;

  Object.assign(variant, updates);

  try {
    await variant.save();
    return variant;
  } catch (error) {
    handleDuplicateKey(error);
  }
}

export async function deleteVariant(productId: string, id: string) {
  const variant = await getVariant(productId, id);

  // Preserve historical invoice references by deactivating the variant.
  // The variant remains available for historical invoice lookups.
  variant.status = "INACTIVE";
  await variant.save();

  return { id: variant._id.toString() };
}
