import mongoose, { Types } from "mongoose";

import { ApiError } from "../../utils/ApiError";
import ProductModel, { type ProductDocument } from "./product.model";
import InventoryModel from "../inventory/inventory.model";
import WarehouseModel from "../warehouses/warehouse.model";
import StockMovementModel from "../stock-movements/stockMovement.model";
import { ProductTag } from "../product-tags/tag.model";
import { ProductTagAssignment } from "../product-tags/product-tag-assignment.model";

import type {
  ProductInput,
  ProductListQuery,
  ProductStatus,
  ProductUpdateInput,
} from "./product.types";

const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeSlug = (value: string): string =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 200);

const normalizeSku = (value?: string): string | undefined =>
  value?.trim().toUpperCase() || undefined;

const normalizeBarcode = (value?: string): string | undefined =>
  value?.trim() || undefined;

function throwDuplicateKey(error: unknown): never {
  const mongoError = error as {
    code?: number;
    keyPattern?: Record<string, unknown>;
  };

  if (mongoError?.code === 11000) {
    const field = Object.keys(mongoError.keyPattern ?? {})[0];

    throw ApiError.conflict(
      `A product with this ${field || "unique field"} already exists.`,
      { code: "DUPLICATE_PRODUCT_FIELD" },
    );
  }

  throw error;
}

function validatePriceRelationship(
  price?: number,
  compareAtPrice?: number,
): void {
  if (
    price !== undefined &&
    compareAtPrice !== undefined &&
    compareAtPrice <= price
  ) {
    throw ApiError.badRequest("compareAtPrice must be greater than price.");
  }
}

function getModel(name: string) {
  try {
    return mongoose.model(name);
  } catch {
    throw ApiError.internal(`The ${name} model has not been registered.`);
  }
}

async function assertReferencesExist(
  input: Partial<ProductInput>,
): Promise<void> {
  if (input.categoryId) {
    const category = await getModel("Category").exists({
      _id: input.categoryId,
    });

    if (!category) {
      throw ApiError.notFound("Category does not exist.");
    }
  }

  if (input.subcategoryId) {
    const subcategory = await getModel("Subcategory")
      .findById(input.subcategoryId)
      .select("categoryId")
      .lean();

    if (!subcategory) {
      throw ApiError.notFound("Subcategory does not exist.");
    }

    const subcategoryCategoryId = (
      subcategory as unknown as {
        categoryId?: Types.ObjectId;
      }
    ).categoryId;

    if (
      input.categoryId &&
      String(subcategoryCategoryId) !== String(input.categoryId)
    ) {
      throw ApiError.badRequest(
        "Subcategory does not belong to the selected category.",
      );
    }
  }

  if (input.brandId) {
    const brand = await getModel("Brand").exists({ _id: input.brandId });

    if (!brand) {
      throw ApiError.notFound("Brand does not exist.");
    }
  }

  if (input.collectionIds?.length) {
    const uniqueIds = [...new Set(input.collectionIds)];

    const count = await getModel("Collection").countDocuments({
      _id: { $in: uniqueIds },
    });

    if (count !== uniqueIds.length) {
      throw ApiError.badRequest("One or more collections do not exist.");
    }
  }
}

function validateProductRules(input: Partial<ProductInput>): void {
  if (input.type === "DIGITAL" && input.requiresShipping === true) {
    throw ApiError.badRequest("Digital products cannot require shipping.");
  }
}

export async function createProduct(input: ProductInput, actorId?: string) {
  const { inventoryWarehouseId, tagIds = [], ...productInput } = input;
  const name = input.name.trim();
  const slug = normalizeSlug(input.slug || name);

  if (!slug) {
    throw ApiError.badRequest("A valid product slug is required.");
  }

  validatePriceRelationship(input.price, input.compareAtPrice);
  if (
    input.salePrice !== undefined &&
    input.salePrice !== null &&
    input.salePrice >= input.price
  ) {
    throw ApiError.badRequest(
      "Sale price must be less than the regular price.",
    );
  }
  if (
    input.saleStartsAt &&
    input.saleEndsAt &&
    input.saleStartsAt >= input.saleEndsAt
  ) {
    throw ApiError.badRequest(
      "Sale end time must be later than its start time.",
    );
  }
  if (input.publishAt && input.publishAt <= new Date()) {
    throw ApiError.badRequest("Scheduled publish time must be in the future.");
  }
  if (input.publishAt && input.status === "INACTIVE") {
    throw ApiError.badRequest(
      "An inactive product cannot be scheduled for publication.",
    );
  }
  validateProductRules(input);
  await assertReferencesExist(input);

  const payload: Record<string, unknown> = {
    ...productInput,
    name,
    slug,
    status:
      input.publishAt && input.publishAt > new Date()
        ? "DRAFT"
        : (input.status ?? "DRAFT"),
    publishedAt:
      !input.publishAt && input.status === "ACTIVE" ? new Date() : undefined,
    sku: normalizeSku(input.sku),
    barcode: normalizeBarcode(input.barcode),
    tags: [...new Set((input.tags ?? []).map((tag) => tag.trim()))],
    collectionIds: input.collectionIds ?? [],
  };

  if (actorId && Types.ObjectId.isValid(actorId)) {
    payload.createdBy = new Types.ObjectId(actorId);
    payload.updatedBy = new Types.ObjectId(actorId);
  }

  const session = await mongoose.startSession();
  let createdProduct: ProductDocument | undefined;

  try {
    await session.withTransaction(async () => {
      let warehouseId: Types.ObjectId | undefined;
      let stockMovementActorId: Types.ObjectId | undefined;

      if (inventoryWarehouseId) {
        if (input.trackInventory === false) {
          throw ApiError.badRequest(
            "Inventory warehouse cannot be set when inventory tracking is disabled.",
          );
        }

        if (!Types.ObjectId.isValid(inventoryWarehouseId)) {
          throw ApiError.badRequest("Invalid inventory warehouse ID.");
        }

        const warehouse = await WarehouseModel.findOne({
          _id: inventoryWarehouseId,
          status: "ACTIVE",
        })
          .select("_id")
          .session(session)
          .lean()
          .exec();

        if (!warehouse) {
          throw ApiError.badRequest(
            "Select an active warehouse for this product.",
          );
        }

        if (!actorId || !Types.ObjectId.isValid(actorId)) {
          throw ApiError.unauthorized(
            "Authenticated admin ID is required to initialize inventory.",
          );
        }

        warehouseId = warehouse._id;
        stockMovementActorId = new Types.ObjectId(actorId);
      }

      const created = await ProductModel.create([payload], { session });
      const product = created[0];

      if (!product) {
        throw new Error("Product creation returned no document.");
      }

      const collectionIds = product.collectionIds ?? [];

      if (collectionIds.length > 0) {
        await getModel("Collection")
          .updateMany(
            { _id: { $in: collectionIds } },
            { $addToSet: { products: product._id } },
            { session },
          )
          .exec();
      }

      if (warehouseId) {
        const initialQuantity = product.stockQuantity;

        await InventoryModel.create(
          [
            {
              productId: product._id,
              warehouseId,
              quantity: initialQuantity,
              reservedQuantity: 0,
              lowStockThreshold: product.lowStockThreshold,
            },
          ],
          { session },
        );

        if (initialQuantity > 0 && stockMovementActorId) {
          await StockMovementModel.create(
            [
              {
                productId: product._id,
                warehouseId,
                type: "IN",
                quantity: initialQuantity,
                quantityBefore: 0,
                quantityAfter: initialQuantity,
                reason: "Initial stock received during product creation.",
                referenceType: "PRODUCT_CREATION",
                referenceId: product._id,
                createdBy: stockMovementActorId,
              },
            ],
            { session },
          );
        }
      }

      const uniqueTagIds = [...new Set(tagIds)];
      if (uniqueTagIds.length > 0) {
        const existingTagCount = await ProductTag.countDocuments({
          _id: { $in: uniqueTagIds },
        })
          .session(session)
          .exec();

        if (existingTagCount !== uniqueTagIds.length) {
          throw ApiError.badRequest("One or more product tags do not exist.");
        }

        await ProductTagAssignment.insertMany(
          uniqueTagIds.map((tagId) => ({
            productId: product._id,
            tagId: new Types.ObjectId(tagId),
          })),
          { session },
        );
      }

      createdProduct = product;
    });

    if (!createdProduct) {
      throw new Error("Product creation transaction returned no product.");
    }

    return createdProduct;
  } catch (error) {
    throwDuplicateKey(error);
  } finally {
    await session.endSession();
  }
}

export async function getProductById(
  id: string,
  options: {
    includeArchived?: boolean;
    includeCostPrice?: boolean;
  } = {},
) {
  if (!Types.ObjectId.isValid(id)) {
    throw ApiError.badRequest("Invalid product ID.");
  }

  const query = ProductModel.findById(id);

  if (!options.includeArchived) {
    query.where({ status: { $ne: "ARCHIVED" } });
  }

  if (options.includeCostPrice) {
    query.select("+costPrice");
  }

  const product = await query;

  if (!product) {
    throw ApiError.notFound("Product not found.");
  }

  return product;
}

export async function getProductBySlug(
  slug: string,
  options: { includeArchived?: boolean } = {},
) {
  const query = ProductModel.findOne({
    slug: normalizeSlug(slug),
    ...(options.includeArchived
      ? {}
      : {
          status: "ACTIVE",
          $or: [{ visibility: "VISIBLE" }, { visibility: { $exists: false } }],
        }),
  });

  const product = await query;

  if (!product) {
    throw ApiError.notFound("Product not found.");
  }

  const now = new Date();
  if (
    product.salePrice !== undefined &&
    (!product.saleStartsAt || product.saleStartsAt <= now) &&
    (!product.saleEndsAt || product.saleEndsAt > now)
  ) {
    product.compareAtPrice = product.price;
    product.price = product.salePrice;
  }

  return product;
}

export async function listProducts(
  query: ProductListQuery,
  options: { publicOnly?: boolean } = {},
) {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;

  // A flexible MongoDB filter avoids relying on an unavailable
  // Mongoose FilterQuery export in this project.
  const filter: Record<string, unknown> = {};

  if (options.publicOnly) {
    filter.status = "ACTIVE";
  } else if (query.status) {
    filter.status = query.status;
  } else {
    filter.status = { $ne: "ARCHIVED" };
  }

  if (query.type) filter.type = query.type;
  if (query.categoryId) filter.categoryId = query.categoryId;
  if (query.subcategoryId) filter.subcategoryId = query.subcategoryId;
  if (query.brandId) filter.brandId = query.brandId;

  if (query.featured !== undefined) {
    filter.featured = query.featured;
  }

  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    filter.price = {
      ...(query.minPrice !== undefined && { $gte: query.minPrice }),
      ...(query.maxPrice !== undefined && { $lte: query.maxPrice }),
    };
  }

  if (query.inStock === true) {
    filter.$or = [
      { type: { $ne: "VARIABLE" }, trackInventory: false },
      { stockQuantity: { $gt: 0 } },
      { type: { $ne: "VARIABLE" }, inventoryPolicy: "CONTINUE" },
    ];
  } else if (query.inStock === false) {
    filter.$or = [{ type: "VARIABLE" }, { trackInventory: true }];
    filter.stockQuantity = { $lte: 0 };
    filter.$and = [
      ...(Array.isArray(filter.$and)
        ? (filter.$and as Record<string, unknown>[])
        : []),
      { $or: [{ type: "VARIABLE" }, { inventoryPolicy: "DENY" }] },
    ];
  }

  if (query.search?.trim()) {
    const safeSearch = escapeRegex(query.search.trim());

    const existingAnd = filter.$and;
    filter.$and = [
      ...(Array.isArray(existingAnd)
        ? (existingAnd as Record<string, unknown>[])
        : []),
      {
        $or: [
          { name: { $regex: safeSearch, $options: "i" } },
          { sku: { $regex: safeSearch, $options: "i" } },
          { barcode: { $regex: safeSearch, $options: "i" } },
          { shortDescription: { $regex: safeSearch, $options: "i" } },
        ],
      },
    ];
  }

  if (options.publicOnly) {
    const conditions = Array.isArray(filter.$and)
      ? (filter.$and as Record<string, unknown>[])
      : [];
    filter.$and = [
      ...conditions,
      {
        $or: [{ visibility: "VISIBLE" }, { visibility: { $exists: false } }],
      },
    ];
  }

  const allowedSortFields = [
    "createdAt",
    "updatedAt",
    "name",
    "price",
    "sortOrder",
  ];

  const sortBy = allowedSortFields.includes(query.sortBy ?? "")
    ? query.sortBy!
    : "createdAt";

  const sortDirection = query.sortOrder === "asc" ? 1 : -1;
  const sort: Record<string, 1 | -1> = {
    [sortBy]: sortDirection,
    _id: -1,
  };

  const [items, total] = await Promise.all([
    ProductModel.find(filter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("categoryId", "name slug")
      .populate("subcategoryId", "name slug")
      .populate("brandId", "name slug")
      .lean(),

    ProductModel.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    items: options.publicOnly
      ? items.map((item) => {
          const now = new Date();
          if (
            item.salePrice !== undefined &&
            (!item.saleStartsAt || item.saleStartsAt <= now) &&
            (!item.saleEndsAt || item.saleEndsAt > now)
          ) {
            return {
              ...item,
              compareAtPrice: item.price,
              price: item.salePrice,
            };
          }
          return item;
        })
      : items,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
}

export async function updateProduct(
  id: string,
  input: ProductUpdateInput,
  actorId?: string,
) {
  const { tagIds, ...productInput } = input;
  const product = await getProductById(id, {
    includeArchived: true,
  });

  if (product.status === "ARCHIVED") {
    throw ApiError.conflict("Archived products cannot be edited.");
  }

  const nextPrice = productInput.price ?? product.price;
  const nextCompareAt =
    productInput.compareAtPrice !== undefined
      ? productInput.compareAtPrice
      : product.compareAtPrice;

  validatePriceRelationship(nextPrice, nextCompareAt);

  const nextSalePrice =
    productInput.salePrice !== undefined
      ? productInput.salePrice
      : product.salePrice;
  const nextSaleStart =
    productInput.saleStartsAt !== undefined
      ? productInput.saleStartsAt
      : product.saleStartsAt;
  const nextSaleEnd =
    productInput.saleEndsAt !== undefined
      ? productInput.saleEndsAt
      : product.saleEndsAt;

  if (
    nextSalePrice !== undefined &&
    nextSalePrice !== null &&
    nextSalePrice >= nextPrice
  ) {
    throw ApiError.badRequest(
      "Sale price must be less than the regular price.",
    );
  }
  if (nextSaleStart && nextSaleEnd && nextSaleStart >= nextSaleEnd) {
    throw ApiError.badRequest(
      "Sale end time must be later than its start time.",
    );
  }
  if (productInput.publishAt && productInput.publishAt <= new Date()) {
    throw ApiError.badRequest("Scheduled publish time must be in the future.");
  }
  if (
    productInput.publishAt &&
    (productInput.status ?? product.status) === "INACTIVE"
  ) {
    throw ApiError.badRequest(
      "An inactive product cannot be scheduled for publication.",
    );
  }

  validateProductRules({
    type: productInput.type ?? product.type,
    requiresShipping: productInput.requiresShipping ?? product.requiresShipping,
  });

  const nextCategoryId = productInput.categoryId ?? String(product.categoryId);

  const nextSubcategoryId =
    productInput.subcategoryId !== undefined
      ? productInput.subcategoryId
      : product.subcategoryId
        ? String(product.subcategoryId)
        : undefined;

  const nextBrandId =
    productInput.brandId !== undefined
      ? productInput.brandId
      : product.brandId
        ? String(product.brandId)
        : undefined;

  await assertReferencesExist({
    categoryId: nextCategoryId,
    subcategoryId: nextSubcategoryId,
    brandId: nextBrandId,
    collectionIds: productInput.collectionIds,
  });

  const updates: Record<string, unknown> = { ...productInput };

  if (productInput.publishAt && productInput.publishAt > new Date()) {
    updates.status = "DRAFT";
    updates.publishedAt = undefined;
  } else if (productInput.status === "ACTIVE") {
    updates.publishedAt = new Date();
    updates.publishAt = undefined;
  } else if (productInput.status === "DRAFT") {
    updates.publishedAt = undefined;
    updates.publishAt = undefined;
  } else if (productInput.status === "INACTIVE") {
    updates.publishAt = undefined;
  }

  if (productInput.name && productInput.slug === undefined) {
    updates.slug = normalizeSlug(productInput.name);
  } else if (productInput.slug !== undefined) {
    updates.slug = normalizeSlug(productInput.slug);
  }

  if (updates.slug === "") {
    throw ApiError.badRequest("A valid product slug is required.");
  }

  if (productInput.sku !== undefined) {
    updates.sku = normalizeSku(productInput.sku);
  }

  if (productInput.barcode !== undefined) {
    updates.barcode = normalizeBarcode(productInput.barcode);
  }

  if (productInput.tags !== undefined) {
    updates.tags = [...new Set(productInput.tags.map((tag) => tag.trim()))];
  }

  if (productInput.collectionIds !== undefined) {
    updates.collectionIds = productInput.collectionIds;
  }

  if (actorId && Types.ObjectId.isValid(actorId)) {
    updates.updatedBy = new Types.ObjectId(actorId);
  }

  const oldCollectionIds = (product.collectionIds ?? []).map(String);

  const newCollectionIds = (
    productInput.collectionIds !== undefined
      ? productInput.collectionIds
      : (product.collectionIds ?? [])
  ).map(String);

  const oldSet = new Set(oldCollectionIds);
  const newSet = new Set(newCollectionIds);

  const removedIds = oldCollectionIds
    .filter((id) => !newSet.has(id))
    .map((id) => new Types.ObjectId(id));

  const addedIds = newCollectionIds
    .filter((id) => !oldSet.has(id))
    .map((id) => new Types.ObjectId(id));

  const session = await mongoose.startSession();
  let updatedProduct: ProductDocument | undefined;

  try {
    await session.withTransaction(async () => {
      if (tagIds !== undefined) {
        const uniqueTagIds = [...new Set(tagIds)];
        const existingTagCount = await ProductTag.countDocuments({
          _id: { $in: uniqueTagIds },
        })
          .session(session)
          .exec();

        if (existingTagCount !== uniqueTagIds.length) {
          throw ApiError.badRequest("One or more product tags do not exist.");
        }

        await ProductTagAssignment.deleteMany(
          { productId: product._id },
          { session },
        ).exec();

        if (uniqueTagIds.length > 0) {
          await ProductTagAssignment.insertMany(
            uniqueTagIds.map((tagId) => ({
              productId: product._id,
              tagId: new Types.ObjectId(tagId),
            })),
            { session },
          );
        }
      }

      Object.assign(product, updates);
      await product.save({ session });

      const CollectionModel = getModel("Collection");

      if (removedIds.length > 0) {
        await CollectionModel.updateMany(
          { _id: { $in: removedIds } },
          { $pull: { products: product._id } },
          { session },
        ).exec();
      }

      if (addedIds.length > 0) {
        await CollectionModel.updateMany(
          { _id: { $in: addedIds } },
          { $addToSet: { products: product._id } },
          { session },
        ).exec();
      }

      updatedProduct = product;
    });

    if (!updatedProduct) {
      throw new Error("Product update transaction returned no product.");
    }

    return updatedProduct;
  } catch (error) {
    throwDuplicateKey(error);
  } finally {
    await session.endSession();
  }
}

export async function updateProductStatus(
  id: string,
  status: ProductStatus,
  actorId?: string,
) {
  const product = await getProductById(id, {
    includeArchived: true,
  });

  if (product.status === "ARCHIVED" && status !== "ARCHIVED") {
    throw ApiError.conflict(
      "Archived products cannot be reactivated through status update.",
    );
  }

  product.status = status;
  if (status === "ACTIVE") {
    product.publishedAt = new Date();
    product.publishAt = undefined;
  } else if (status === "DRAFT") {
    product.publishedAt = undefined;
    product.publishAt = undefined;
  } else {
    product.publishAt = undefined;
  }

  if (actorId && Types.ObjectId.isValid(actorId)) {
    product.updatedBy = new Types.ObjectId(actorId);
  }

  if (status === "ARCHIVED") {
    product.archivedAt = new Date();
  } else {
    product.archivedAt = undefined;
  }

  await product.save();
  return product;
}

export async function archiveProduct(id: string, actorId?: string) {
  return updateProductStatus(id, "ARCHIVED", actorId);
}
