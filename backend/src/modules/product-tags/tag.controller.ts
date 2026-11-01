import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponse } from "../../utils/ApiResponse";
import * as service from "./tag.service";

export const listTagsController = asyncHandler(
  async (req: Request, res: Response) => {
    res
      .status(200)
      .json(
        ApiResponse.ok(
          await service.listProductTags({
            page: Number(req.query.page ?? 1),
            limit: Number(req.query.limit ?? 20),
            search:
              typeof req.query.search === "string"
                ? req.query.search
                : undefined,
          }),
          "Product tags retrieved successfully.",
        ).serialize(),
      );
  },
);
export const createTagController = asyncHandler(
  async (req: Request, res: Response) => {
    res
      .status(201)
      .json(
        ApiResponse.created(
          await service.createProductTag(req.body),
          "Product tag created successfully.",
        ).serialize(),
      );
  },
);
export const updateTagController = asyncHandler(
  async (req: Request<{ id: string }>, res: Response) => {
    res
      .status(200)
      .json(
        ApiResponse.ok(
          await service.updateProductTag(req.params.id, req.body),
          "Product tag updated successfully.",
        ).serialize(),
      );
  },
);
export const deleteTagController = asyncHandler(
  async (req: Request<{ id: string }>, res: Response) => {
    await service.deleteProductTag(req.params.id);
    res.status(204).send();
  },
);
export const assignTagController = asyncHandler(
  async (req: Request, res: Response) => {
    res
      .status(201)
      .json(
        ApiResponse.created(
          await service.assignProductTag(req.body.productId, req.body.tagId),
          "Tag assigned successfully.",
        ).serialize(),
      );
  },
);
export const listProductTagsController = asyncHandler(
  async (req: Request<{ productId: string }>, res: Response) => {
    res
      .status(200)
      .json(
        ApiResponse.ok(
          await service.listTagsForProduct(req.params.productId),
          "Product tags retrieved successfully.",
        ).serialize(),
      );
  },
);
export const unassignTagController = asyncHandler(
  async (req: Request, res: Response) => {
    await service.unassignProductTag(
      String(req.params.productId),
      String(req.params.tagId),
    );
    res.status(204).send();
  },
);
