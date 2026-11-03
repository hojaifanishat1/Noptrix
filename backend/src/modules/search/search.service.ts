import { Types } from "mongoose";
import type { SortOrder } from "mongoose";

type SearchSort = Record<string, SortOrder>;
type SearchFilter = Record<string, unknown>;

import { ProductModel } from "../products/product.model";
import SearchLogModel from "./searchLog.model";
import type { ProductSearchFilters, SearchSuggestion } from "./search.types";

const MAX_SEARCH_LIMIT = 50;
const MAX_QUERY_LENGTH = 100;

const PUBLIC_PRODUCT_FIELDS = [
  "name",
  "slug",
  "shortDescription",
  "type",
  "sku",
  "categoryId",
  "subcategoryId",
  "brandId",
  "collectionIds",
  "price",
  "compareAtPrice",
  "currency",
  "trackInventory",
  "stockQuantity",
  "inventoryPolicy",
  "requiresShipping",
  "tags",
  "featured",
  "createdAt",
  "updatedAt",
].join(" ");

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeQuery(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function buildPublicProductFilter(filters: ProductSearchFilters) {
  const query: SearchFilter = {
    status: "ACTIVE",
    $or: [{ archivedAt: { $exists: false } }, { archivedAt: null }],
  };

  if (filters.q) {
    const escaped = escapeRegex(filters.q.trim().slice(0, MAX_QUERY_LENGTH));
    const expression = new RegExp(escaped, "i");

    query.$and = [
      {
        $or: [
          { name: expression },
          { slug: expression },
          { sku: expression },
          { barcode: expression },
          { shortDescription: expression },
          { description: expression },
          { tags: expression },
          { "seo.title": expression },
          { "seo.keywords": expression },
        ],
      },
    ];
  }

  if (filters.categoryId) {
    query.categoryId = new Types.ObjectId(filters.categoryId);
  }

  if (filters.subcategoryId) {
    query.subcategoryId = new Types.ObjectId(filters.subcategoryId);
  }

  if (filters.brandId) {
    query.brandId = new Types.ObjectId(filters.brandId);
  }

  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    const priceFilter: { $gte?: number; $lte?: number } = {};

    if (filters.minPrice !== undefined) {
      priceFilter.$gte = filters.minPrice;
    }

    if (filters.maxPrice !== undefined) {
      priceFilter.$lte = filters.maxPrice;
    }

    query.price = priceFilter;
  }

  if (filters.featured !== undefined) {
    query.featured = filters.featured;
  }

  if (filters.inStock === true) {
    const existingAnd = query.$and;
    query.$and = [
      ...(Array.isArray(existingAnd) ? existingAnd : []),
      {
        $or: [
          { type: { $ne: "VARIABLE" }, trackInventory: false },
          { stockQuantity: { $gt: 0 } },
          { type: { $ne: "VARIABLE" }, inventoryPolicy: "CONTINUE" },
        ],
      },
    ];
  } else if (filters.inStock === false) {
    const existingAnd = query.$and;
    query.$and = [
      ...(Array.isArray(existingAnd) ? existingAnd : []),
      { $or: [{ type: "VARIABLE" }, { trackInventory: true }] },
      { $or: [{ type: "VARIABLE" }, { inventoryPolicy: "DENY" }] },
    ];
    query.stockQuantity = { $lte: 0 };
  }

  return query;
}

function getSort(filters: ProductSearchFilters): SearchSort {
  switch (filters.sortBy) {
    case "newest":
      return { createdAt: -1 as const, _id: -1 as const };

    case "price_asc":
      return { price: 1 as const, _id: 1 as const };

    case "price_desc":
      return { price: -1 as const, _id: -1 as const };

    case "name_asc":
      return { name: 1 as const, _id: 1 as const };

    case "name_desc":
      return { name: -1 as const, _id: -1 as const };

    default:
      return {
        featured: -1 as const,
        sortOrder: 1 as const,
        updatedAt: -1 as const,
        _id: -1 as const,
      };
  }
}

export async function searchProducts(filters: ProductSearchFilters) {
  const page = Math.max(1, Math.floor(filters.page || 1));
  const limit = Math.min(
    MAX_SEARCH_LIMIT,
    Math.max(1, Math.floor(filters.limit || 20)),
  );
  const skip = (page - 1) * limit;

  const query = buildPublicProductFilter(filters);

  const [items, total] = await Promise.all([
    filters.q && filters.sortBy === "relevance"
      ? ProductModel.aggregate([
          { $match: query },
          {
            $addFields: {
              _searchScore: {
                $switch: {
                  branches: [
                    {
                      case: {
                        $eq: [
                          { $toLower: "$name" },
                          normalizeQuery(filters.q!),
                        ],
                      },
                      then: 4,
                    },
                    {
                      case: {
                        $regexMatch: {
                          input: "$name",
                          regex: `^${escapeRegex(filters.q!)}`,
                          options: "i",
                        },
                      },
                      then: 3,
                    },
                    {
                      case: {
                        $regexMatch: {
                          input: "$name",
                          regex: escapeRegex(filters.q!),
                          options: "i",
                        },
                      },
                      then: 2,
                    },
                  ],
                  default: 1,
                },
              },
            },
          },
          {
            $sort: {
              _searchScore: -1,
              featured: -1,
              sortOrder: 1,
              updatedAt: -1,
              _id: -1,
            },
          },
          { $skip: skip },
          { $limit: limit },
          { $project: { _searchScore: 0, costPrice: 0, __v: 0 } },
        ])
      : ProductModel.find(query)
          .select(PUBLIC_PRODUCT_FIELDS)
          .sort(getSort(filters))
          .skip(skip)
          .limit(limit)
          .lean(),

    ProductModel.countDocuments(query),
  ]);

  if (filters.q) {
    try {
      await SearchLogModel.create({
        query: filters.q.trim().slice(0, MAX_QUERY_LENGTH),
        normalizedQuery: normalizeQuery(filters.q),
        resultCount: total,
        categoryId: filters.categoryId
          ? new Types.ObjectId(filters.categoryId)
          : undefined,
        brandId: filters.brandId
          ? new Types.ObjectId(filters.brandId)
          : undefined,
      });
    } catch {
      // Search logging must not cause a product search to fail.
    }
  }

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPreviousPage: page > 1,
    },
    filters: {
      q: filters.q,
      categoryId: filters.categoryId,
      subcategoryId: filters.subcategoryId,
      brandId: filters.brandId,
      minPrice: filters.minPrice,
      maxPrice: filters.maxPrice,
      featured: filters.featured,
      inStock: filters.inStock,
      sortBy: filters.sortBy,
    },
  };
}

export async function getSearchSuggestions(
  q: string,
  limit = 5,
): Promise<SearchSuggestion[]> {
  const term = q.trim().slice(0, 80);

  if (term.length < 2) return [];

  const expression = new RegExp(escapeRegex(term), "i");

  const products = await ProductModel.find({
    status: "ACTIVE",
    $and: [
      {
        $or: [{ archivedAt: { $exists: false } }, { archivedAt: null }],
      },
      {
        $or: [{ name: expression }, { slug: expression }],
      },
    ],
  })
    .select("name slug price currency")
    .sort({ featured: -1, sortOrder: 1, updatedAt: -1 })
    .limit(Math.min(10, Math.max(1, limit)))
    .lean();

  return products.map((product) => ({
    name: product.name,
    slug: product.slug,
    price: product.price,
    currency: product.currency,
  }));
}

export async function getPopularSearches(limit = 10) {
  const safeLimit = Math.min(20, Math.max(1, limit));
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  return SearchLogModel.aggregate([
    {
      $match: {
        createdAt: { $gte: since },
        normalizedQuery: { $ne: "" },
      },
    },
    {
      $group: {
        _id: "$normalizedQuery",
        searches: { $sum: 1 },
        latestSearchAt: { $max: "$createdAt" },
        bestResultCount: { $max: "$resultCount" },
      },
    },
    { $sort: { searches: -1, latestSearchAt: -1 } },
    { $limit: safeLimit },
    {
      $project: {
        _id: 0,
        query: "$_id",
        searches: 1,
        latestSearchAt: 1,
        bestResultCount: 1,
      },
    },
  ]);
}

export async function getSearchAnalytics() {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [summary, noResultQueries, topQueries] = await Promise.all([
    SearchLogModel.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: null,
          totalSearches: { $sum: 1 },
          uniqueQueries: { $addToSet: "$normalizedQuery" },
          noResultSearches: {
            $sum: { $cond: [{ $eq: ["$resultCount", 0] }, 1, 0] },
          },
        },
      },
      {
        $project: {
          _id: 0,
          totalSearches: 1,
          uniqueQueryCount: { $size: "$uniqueQueries" },
          noResultSearches: 1,
        },
      },
    ]),
    SearchLogModel.aggregate([
      { $match: { createdAt: { $gte: since }, resultCount: 0 } },
      {
        $group: {
          _id: "$normalizedQuery",
          searches: { $sum: 1 },
          lastSearchedAt: { $max: "$createdAt" },
        },
      },
      { $sort: { searches: -1 } },
      { $limit: 20 },
      {
        $project: {
          _id: 0,
          query: "$_id",
          searches: 1,
          lastSearchedAt: 1,
        },
      },
    ]),
    getPopularSearches(10),
  ]);

  return {
    periodDays: 30,
    summary: summary[0] ?? {
      totalSearches: 0,
      uniqueQueryCount: 0,
      noResultSearches: 0,
    },
    topQueries,
    noResultQueries,
  };
}
