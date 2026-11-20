import { Types } from "mongoose";

import { ApiError } from "../../utils/ApiError";

import {
  SellerOpportunity,
  SELLER_OPPORTUNITY_STATUSES,
  SELLER_OPPORTUNITY_VISIBILITIES,
  SellerOpportunityStatus,
} from "./seller-opportunity.model";

import {
  CreateSellerOpportunityInput,
  UpdateSellerOpportunityInput,
  SellerOpportunityQueryInput,
  UpdateSellerOpportunityStatusInput,
} from "./seller-opportunity.validator";

const STATUS_TRANSITIONS: Record<
  SellerOpportunityStatus,
  readonly SellerOpportunityStatus[]
> = {
  DRAFT: ["PUBLISHED", "CLOSED"],
  PUBLISHED: ["PAUSED", "CLOSED"],
  PAUSED: ["PUBLISHED", "CLOSED"],
  CLOSED: [],
};

const validateObjectId = (value: string, field: string): Types.ObjectId => {
  if (!Types.ObjectId.isValid(value)) {
    throw ApiError.badRequest(`Invalid ${field}.`);
  }
  return new Types.ObjectId(value);
};

const normalizeSlug = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 220);

const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const validateDeadline = (deadline?: Date): void => {
  if (deadline && deadline.getTime() <= Date.now()) {
    throw ApiError.badRequest("Application deadline must be in the future.");
  }
};

const publicFilter = () => ({
  status: SELLER_OPPORTUNITY_STATUSES.PUBLISHED,
  visibility: SELLER_OPPORTUNITY_VISIBILITIES.PUBLIC,
  $or: [
    { applicationDeadline: { $exists: false } },
    { applicationDeadline: null },
    { applicationDeadline: { $gt: new Date() } },
  ],
});

/*
|--------------------------------------------------------------------------
| Create
|--------------------------------------------------------------------------
*/

export const createSellerOpportunity = async (
  creatorId: string,
  input: CreateSellerOpportunityInput,
) => {
  const creatorObjectId = validateObjectId(creatorId, "creator ID");
  const slug = normalizeSlug(input.slug || input.title);

  if (!slug) {
    throw ApiError.badRequest("A valid opportunity slug is required.");
  }

  const existing = await SellerOpportunity.findOne({
    $or: [{ slug }, { title: input.title.trim() }],
  }).lean();

  if (existing) {
    throw ApiError.conflict("An opportunity with this title or slug already exists.");
  }

  validateDeadline(input.applicationDeadline);

  try {
    return await SellerOpportunity.create({
      ...input,
      title: input.title.trim(),
      slug,
      category: input.category.trim(),
      createdBy: creatorObjectId,
      updatedBy: creatorObjectId,
      status: SELLER_OPPORTUNITY_STATUSES.DRAFT,
    });
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: unknown }).code === 11000
    ) {
      throw ApiError.conflict("An opportunity with this slug already exists.");
    }
    throw error;
  }
};

/*
|--------------------------------------------------------------------------
| Read
|--------------------------------------------------------------------------
*/

export const getSellerOpportunityById = async (opportunityId: string) => {
  const id = validateObjectId(opportunityId, "opportunity ID");

  const opportunity = await SellerOpportunity.findById(id)
    .populate("createdBy", "name email")
    .populate("updatedBy", "name email")
    .lean();

  if (!opportunity) {
    throw ApiError.notFound("Seller opportunity not found.");
  }

  return opportunity;
};

export const getSellerOpportunityBySlug = async (slug: string) => {
  const normalizedSlug = normalizeSlug(slug);

  if (!normalizedSlug) {
    throw ApiError.badRequest("Invalid opportunity slug.");
  }

  const opportunity = await SellerOpportunity.findOne({
    slug: normalizedSlug,
    ...publicFilter(),
  })
    .select("-createdBy -updatedBy")
    .lean();

  if (!opportunity) {
    throw ApiError.notFound("Seller opportunity not found.");
  }

  return opportunity;
};

/*
|--------------------------------------------------------------------------
| Management Listing
|--------------------------------------------------------------------------
*/

export const getSellerOpportunities = async (
  query: SellerOpportunityQueryInput,
) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const filter: Record<string, unknown> = {};

  if (query.status) filter.status = query.status;
  if (query.visibility) filter.visibility = query.visibility;

  if (query.category) {
    filter.category = {
      $regex: escapeRegex(query.category),
      $options: "i",
    };
  }

  if (query.search) {
    const search = escapeRegex(query.search.trim());
    filter.$or = [
      { title: { $regex: search, $options: "i" } },
      { summary: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
      { category: { $regex: search, $options: "i" } },
    ];
  }

  const skip = (page - 1) * limit;

  const [opportunities, total] = await Promise.all([
    SellerOpportunity.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    SellerOpportunity.countDocuments(filter),
  ]);

  return {
    opportunities,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPreviousPage: page > 1,
    },
  };
};

/*
|--------------------------------------------------------------------------
| Public Listing
|--------------------------------------------------------------------------
*/

export const getPublicSellerOpportunities = async (
  query: SellerOpportunityQueryInput,
) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const filter: Record<string, unknown> = publicFilter();

  if (query.category) {
    filter.category = {
      $regex: escapeRegex(query.category),
      $options: "i",
    };
  }

  if (query.search) {
    const search = escapeRegex(query.search.trim());
    filter.$and = [
      {
        $or: [
          { title: { $regex: search, $options: "i" } },
          { summary: { $regex: search, $options: "i" } },
          { description: { $regex: search, $options: "i" } },
          { category: { $regex: search, $options: "i" } },
        ],
      },
    ];
  }

  const skip = (page - 1) * limit;

  const [opportunities, total] = await Promise.all([
    SellerOpportunity.find(filter)
      .select("-createdBy -updatedBy")
      .sort({ publishedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    SellerOpportunity.countDocuments(filter),
  ]);

  return {
    opportunities,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPreviousPage: page > 1,
    },
  };
};

/*
|--------------------------------------------------------------------------
| Update
|--------------------------------------------------------------------------
*/

export const updateSellerOpportunity = async (
  opportunityId: string,
  updaterId: string,
  input: UpdateSellerOpportunityInput,
) => {
  const id = validateObjectId(opportunityId, "opportunity ID");
  const updaterObjectId = validateObjectId(updaterId, "updater ID");

  const opportunity = await SellerOpportunity.findById(id);

  if (!opportunity) {
    throw ApiError.notFound("Seller opportunity not found.");
  }

  if (opportunity.status === SELLER_OPPORTUNITY_STATUSES.CLOSED) {
    throw ApiError.badRequest("Closed opportunities cannot be updated.");
  }

  const nextDeadline =
    input.applicationDeadline !== undefined
      ? input.applicationDeadline
      : opportunity.applicationDeadline;

  if (opportunity.status === SELLER_OPPORTUNITY_STATUSES.PUBLISHED) {
    validateDeadline(nextDeadline);
  }

  const nextSlug =
    input.slug !== undefined
      ? normalizeSlug(input.slug)
      : opportunity.slug;

  if (!nextSlug) {
    throw ApiError.badRequest("A valid opportunity slug is required.");
  }

  if (nextSlug !== opportunity.slug) {
    const duplicate = await SellerOpportunity.findOne({
      slug: nextSlug,
      _id: { $ne: opportunity._id },
    }).lean();

    if (duplicate) {
      throw ApiError.conflict("An opportunity with this slug already exists.");
    }
  }

  if (input.title && input.title.trim() !== opportunity.title) {
    const duplicateTitle = await SellerOpportunity.findOne({
      title: input.title.trim(),
      _id: { $ne: opportunity._id },
    }).lean();

    if (duplicateTitle) {
      throw ApiError.conflict("An opportunity with this title already exists.");
    }
  }

  Object.assign(opportunity, input);

  if (input.title !== undefined) opportunity.title = input.title.trim();
  if (input.slug !== undefined) opportunity.slug = nextSlug;
  if (input.category !== undefined) opportunity.category = input.category.trim();

  opportunity.updatedBy = updaterObjectId;

  await opportunity.save();
  return opportunity;
};

/*
|--------------------------------------------------------------------------
| Status
|--------------------------------------------------------------------------
*/

export const updateSellerOpportunityStatus = async (
  opportunityId: string,
  updaterId: string,
  input: UpdateSellerOpportunityStatusInput,
) => {
  const id = validateObjectId(opportunityId, "opportunity ID");
  const updaterObjectId = validateObjectId(updaterId, "updater ID");

  const opportunity = await SellerOpportunity.findById(id);

  if (!opportunity) {
    throw ApiError.notFound("Seller opportunity not found.");
  }

  const nextStatus = input.status as SellerOpportunityStatus;

  if (opportunity.status === nextStatus) {
    throw ApiError.badRequest(
      `Opportunity is already ${nextStatus.toLowerCase()}.`,
    );
  }

  if (!STATUS_TRANSITIONS[opportunity.status].includes(nextStatus)) {
    throw ApiError.badRequest(
      `Cannot change opportunity status from ${opportunity.status} to ${nextStatus}.`,
    );
  }

  if (nextStatus === SELLER_OPPORTUNITY_STATUSES.PUBLISHED) {
    validateDeadline(opportunity.applicationDeadline);

    if (opportunity.targetSellerCount < 1) {
      throw ApiError.badRequest("Target seller count must be at least one.");
    }

    opportunity.publishedAt = opportunity.publishedAt ?? new Date();
    opportunity.closedAt = undefined;
  }

  if (nextStatus === SELLER_OPPORTUNITY_STATUSES.CLOSED) {
    opportunity.closedAt = new Date();
  }

  opportunity.status = nextStatus;
  opportunity.updatedBy = updaterObjectId;

  await opportunity.save();
  return opportunity;
};

export const publishSellerOpportunity = (id: string, updaterId: string) =>
  updateSellerOpportunityStatus(id, updaterId, { status: "PUBLISHED" });

export const pauseSellerOpportunity = (id: string, updaterId: string) =>
  updateSellerOpportunityStatus(id, updaterId, { status: "PAUSED" });

export const closeSellerOpportunity = (id: string, updaterId: string) =>
  updateSellerOpportunityStatus(id, updaterId, { status: "CLOSED" });

/*
|--------------------------------------------------------------------------
| Delete
|--------------------------------------------------------------------------
*/

export const deleteSellerOpportunity = async (
  opportunityId: string,
  updaterId: string,
) => {
  const id = validateObjectId(opportunityId, "opportunity ID");
  validateObjectId(updaterId, "updater ID");

  const opportunity = await SellerOpportunity.findById(id);

  if (!opportunity) {
    throw ApiError.notFound("Seller opportunity not found.");
  }

  if (opportunity.status !== SELLER_OPPORTUNITY_STATUSES.DRAFT) {
    throw ApiError.badRequest("Only draft opportunities can be deleted.");
  }

  const { SellerApplication } =
    await import("../seller-applications/seller-application.model.js");

  const applicationCount = await SellerApplication.countDocuments({
    opportunityId: id,
  });

  if (applicationCount > 0) {
    throw ApiError.conflict(
      "This opportunity cannot be deleted because applications are associated with it.",
      {
        code: "OPPORTUNITY_HAS_APPLICATIONS",
        details: { applicationCount },
      },
    );
  }

  await SellerOpportunity.deleteOne({ _id: id });

  return {
    opportunityId,
    deleted: true,
  };
};
