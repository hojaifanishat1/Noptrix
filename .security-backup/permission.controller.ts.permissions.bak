import { Request, Response } from "express";

import { asyncHandler } from "../../utils/asyncHandler";

import { ApiError } from "../../utils/ApiError";

import { getAuthenticatedUserId } from "../../middlewares/adminAuth.middleware";

import {
  createPermission,
  getAllPermissions,
  getPermissionById,
  updatePermission,
  activatePermission,
  deactivatePermission,
  deletePermission,
} from "./permission.service";

import type {
  CreatePermissionInput,
  UpdatePermissionInput,
} from "./permission.service";

/*
|--------------------------------------------------------------------------
| Create Permission
|--------------------------------------------------------------------------
*/

export const createPermissionController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const input = req.body as CreatePermissionInput;

    const createdBy = getAuthenticatedUserId(req);

    const permission = await createPermission(input, createdBy);

    res.status(201).json({
      success: true,
      message: "Permission created successfully.",
      data: {
        permission,
      },
    });
  },
);

/*
|--------------------------------------------------------------------------
| Get All Permissions
|--------------------------------------------------------------------------
*/

export const getAllPermissionsController = asyncHandler(
  async (_req: Request, res: Response): Promise<void> => {
    const permissionDocuments = await getAllPermissions();

    const permissions = permissionDocuments.map((permission) => {
      const document = permission.toObject();

      return {
        ...document,
        id: document._id.toString(),
      };
    });

    res.status(200).json({
      success: true,
      data: {
        permissions,
      },
    });
  },
);

/*
|--------------------------------------------------------------------------
| Get Permission By ID
|--------------------------------------------------------------------------
*/

export const getPermissionController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { permissionId } = req.params;

    if (typeof permissionId !== "string" || !permissionId) {
      throw ApiError.badRequest("Permission ID is required.", {
        code: "PERMISSION_ID_REQUIRED",
      });
    }

    const permission = await getPermissionById(permissionId);

    res.status(200).json({
      success: true,
      data: {
        permission,
      },
    });
  },
);

/*
|--------------------------------------------------------------------------
| Update Permission
|--------------------------------------------------------------------------
*/

export const updatePermissionController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { permissionId } = req.params;

    if (typeof permissionId !== "string" || !permissionId) {
      throw ApiError.badRequest("Permission ID is required.", {
        code: "PERMISSION_ID_REQUIRED",
      });
    }

    const input = req.body as UpdatePermissionInput;

    const updatedBy = getAuthenticatedUserId(req);

    const permission = await updatePermission(permissionId, input, updatedBy);

    res.status(200).json({
      success: true,
      message: "Permission updated successfully.",
      data: {
        permission,
      },
    });
  },
);

/*
|--------------------------------------------------------------------------
| Activate Permission
|--------------------------------------------------------------------------
*/

export const activatePermissionController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { permissionId } = req.params;

    if (typeof permissionId !== "string" || !permissionId) {
      throw ApiError.badRequest("Permission ID is required.", {
        code: "PERMISSION_ID_REQUIRED",
      });
    }

    const updatedBy = getAuthenticatedUserId(req);

    const permission = await activatePermission(permissionId, updatedBy);

    res.status(200).json({
      success: true,
      message: "Permission activated successfully.",
      data: {
        permission,
      },
    });
  },
);

/*
|--------------------------------------------------------------------------
| Deactivate Permission
|--------------------------------------------------------------------------
*/

export const deactivatePermissionController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { permissionId } = req.params;

    if (typeof permissionId !== "string" || !permissionId) {
      throw ApiError.badRequest("Permission ID is required.", {
        code: "PERMISSION_ID_REQUIRED",
      });
    }

    const updatedBy = getAuthenticatedUserId(req);

    const permission = await deactivatePermission(permissionId, updatedBy);

    res.status(200).json({
      success: true,
      message: "Permission deactivated successfully.",
      data: {
        permission,
      },
    });
  },
);

/*
|--------------------------------------------------------------------------
| Delete Permission
|--------------------------------------------------------------------------
*/

export const deletePermissionController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { permissionId } = req.params;

    if (typeof permissionId !== "string" || !permissionId) {
      throw ApiError.badRequest("Permission ID is required.", {
        code: "PERMISSION_ID_REQUIRED",
      });
    }

    await deletePermission(permissionId);

    res.status(200).json({
      success: true,
      message: "Permission deleted successfully.",
    });
  },
);
