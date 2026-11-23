import { Request, Response } from "express";

import { asyncHandler } from "../../utils/asyncHandler";

import { ApiError } from "../../utils/ApiError";

import { getAuthenticatedOwnerId } from "../../middlewares/ownerAuth.middleware";

import {
  assignPermissionToRole,
  removePermissionFromRole,
  getRolePermissions,
  getRolePermissionKeys,
  getRolesForPermission,
  assignPermissionsToRole,
  removePermissionsFromRole,
} from "./role.permission.service";

/*
|--------------------------------------------------------------------------
| Route Parameter Helper
|--------------------------------------------------------------------------
*/

const getRouteParam = (
  value: string | string[] | undefined,
  fieldName: string,
): string => {
  if (typeof value !== "string" || !value.trim()) {
    throw ApiError.badRequest(`${fieldName} is required.`, {
      code: `${fieldName.replace(/\s+/g, "_").toUpperCase()}_REQUIRED`,
    });
  }

  return value.trim();
};

/*
|--------------------------------------------------------------------------
| Assign Permission To Role
|--------------------------------------------------------------------------
*/

export const assignPermissionController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { roleId, permissionId } = req.body;

    const ownerId = getAuthenticatedOwnerId(req);

    const relationship = await assignPermissionToRole(
      roleId,
      permissionId,
      ownerId,
    );

    res.status(201).json({
      success: true,
      message: "Permission assigned to role successfully.",
      data: {
        relationship,
      },
    });
  },
);

/*
|--------------------------------------------------------------------------
| Remove Permission From Role
|--------------------------------------------------------------------------
*/

export const removePermissionController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { roleId, permissionId } = req.body;

    getAuthenticatedOwnerId(req);

    await removePermissionFromRole(roleId, permissionId);

    res.status(200).json({
      success: true,
      message: "Permission removed from role successfully.",
    });
  },
);

/*
|--------------------------------------------------------------------------
| Get Role Permissions
|--------------------------------------------------------------------------
*/

export const getRolePermissionsController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const roleId = getRouteParam(req.params.roleId, "Role ID");

    getAuthenticatedOwnerId(req);

    const permissions = await getRolePermissions(roleId);

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
| Get Role Permission Keys
|--------------------------------------------------------------------------
*/

export const getRolePermissionKeysController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const roleId = getRouteParam(req.params.roleId, "Role ID");

    getAuthenticatedOwnerId(req);

    const permissionKeys = await getRolePermissionKeys(roleId);

    res.status(200).json({
      success: true,
      data: {
        permissionKeys,
      },
    });
  },
);

/*
|--------------------------------------------------------------------------
| Get Roles For Permission
|--------------------------------------------------------------------------
*/

export const getRolesForPermissionController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const permissionId = getRouteParam(
      req.params.permissionId,
      "Permission ID",
    );

    getAuthenticatedOwnerId(req);

    const roles = await getRolesForPermission(permissionId);

    res.status(200).json({
      success: true,
      data: {
        roles,
      },
    });
  },
);

/*
|--------------------------------------------------------------------------
| Bulk Assign Permissions
|--------------------------------------------------------------------------
*/

export const bulkAssignPermissionsController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { roleId, permissionIds } = req.body;

    const ownerId = getAuthenticatedOwnerId(req);

    const relationships = await assignPermissionsToRole(
      roleId,
      permissionIds,
      ownerId,
    );

    res.status(201).json({
      success: true,
      message: "Permissions assigned successfully.",
      data: {
        relationships,
      },
    });
  },
);

/*
|--------------------------------------------------------------------------
| Bulk Remove Permissions
|--------------------------------------------------------------------------
*/

export const bulkRemovePermissionsController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { roleId, permissionIds } = req.body;

    getAuthenticatedOwnerId(req);

    await removePermissionsFromRole(roleId, permissionIds);

    res.status(200).json({
      success: true,
      message: "Permissions removed successfully.",
    });
  },
);
