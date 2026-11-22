import { Request, Response } from "express";

import { asyncHandler } from "../../utils/asyncHandler";

import { ApiError } from "../../utils/ApiError";

import { getAuthenticatedUserId } from "../../middlewares/adminAuth.middleware";
import { createAuditLog } from "../audit-logs/audit-log.service";

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
| Security Audit Helper
|--------------------------------------------------------------------------
*/

const auditPermissionChange = async (
  req: Request,
  resourceId: string | undefined,
  description: string,
  metadata: Record<string, unknown> = {},
): Promise<void> => {
  await createAuditLog({
    actorId: getAuthenticatedUserId(req),
    actorType: "OWNER",
    actorRole: "OWNER",
    action: "PERMISSION_CHANGED",
    resource: "permission",
    ...(resourceId ? { resourceId } : {}),
    description,
    method: req.method,
    path: req.originalUrl,
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
    metadata,
    success: true,
  });
};

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

    await auditPermissionChange(
      req,
      String(permission._id),
      "Permission created",
      { permissionKey: permission.key },
    );

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

    await auditPermissionChange(
      req,
      permissionId,
      "Permission updated",
      { changedFields: Object.keys(input).join(",") },
    );

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

    await auditPermissionChange(
      req,
      permissionId,
      "Permission activated",
    );

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

    await auditPermissionChange(
      req,
      permissionId,
      "Permission deactivated",
    );

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

    await auditPermissionChange(
      req,
      permissionId,
      "Permission deleted",
    );

    res.status(200).json({
      success: true,
      message: "Permission deleted successfully.",
    });
  },
);
