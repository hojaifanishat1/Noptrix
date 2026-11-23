import {
  type UploadApiErrorResponse,
  type UploadApiOptions,
  type UploadApiResponse,
} from "cloudinary";

import {
  getCloudinary,
  isCloudinaryConfiguredStatus,
} from "../config/cloudinary";

import { logger } from "../utils/logger";

/*
|--------------------------------------------------------------------------
| Cloudinary Service
|--------------------------------------------------------------------------
|
| Responsibilities:
|
| - Upload files
| - Upload Buffers
| - Upload Base64 data
| - Delete assets
| - Bulk delete assets
| - Replace assets
| - Get resource metadata
| - Generate secure delivery URLs
| - Expose service health information
|
| Cloudinary SDK configuration itself belongs to:
|
|     config/cloudinary.ts
|
| This service only consumes the configured SDK.
|
|--------------------------------------------------------------------------
*/

/*
|--------------------------------------------------------------------------
| Types
|--------------------------------------------------------------------------
*/

export interface CloudinaryUploadResult {
  readonly publicId: string;
  readonly secureUrl: string;
  readonly url: string;
  readonly assetId: string;
  readonly version: number;
  readonly resourceType: string;
  readonly format: string;
  readonly bytes: number;
  readonly width?: number;
  readonly height?: number;
  readonly originalFilename?: string;
}

export interface CloudinaryUploadOptions {
  readonly folder?: string;

  readonly publicId?: string;

  readonly resourceType?: UploadApiOptions["resource_type"];

  readonly accessMode?: UploadApiOptions["access_mode"];

  readonly overwrite?: boolean;

  readonly useUniqueFilename?: boolean;

  readonly invalidate?: boolean;

  readonly transformation?: UploadApiOptions["transformation"];

  readonly tags?: string[];

  readonly context?: Record<string, string>;
}

export interface CloudinaryUploadBufferInput {
  readonly buffer: Buffer;

  readonly filename?: string;

  readonly mimeType?: string;
}

export interface CloudinaryDeleteResult {
  readonly publicId: string;

  readonly result: string;
}

export interface CloudinaryResourceResult {
  readonly publicId: string;

  readonly secureUrl: string;

  readonly resourceType: string;

  readonly format: string;

  readonly bytes: number;

  readonly width?: number;

  readonly height?: number;

  readonly createdAt?: string;
}

export interface CloudinaryServiceHealth {
  readonly configured: boolean;

  readonly ready: boolean;
}

/*
|--------------------------------------------------------------------------
| Internal Cloudinary Resource Response
|--------------------------------------------------------------------------
|
| We intentionally define the exact fields that our application
| needs instead of depending on Cloudinary's broad SDK response type.
|
|--------------------------------------------------------------------------
*/

interface CloudinaryResourceResponse {
  public_id: string;

  secure_url: string;

  resource_type: string;

  format: string;

  bytes: number;

  width?: number;

  height?: number;

  created_at?: string;
}

/*
|--------------------------------------------------------------------------
| Constants
|--------------------------------------------------------------------------
*/

const DEFAULT_RESOURCE_TYPE: UploadApiOptions["resource_type"] = "image";

const MAX_FILENAME_LENGTH = 255;

/*
|--------------------------------------------------------------------------
| Configuration Guard
|--------------------------------------------------------------------------
*/

const ensureCloudinaryConfigured = (): void => {
  if (!isCloudinaryConfiguredStatus()) {
    throw new Error(
      "Cloudinary is not configured. Configure Cloudinary before performing cloud operations.",
    );
  }
};

/*
|--------------------------------------------------------------------------
| Folder Sanitization
|--------------------------------------------------------------------------
*/

const sanitizeFolder = (folder?: string): string | undefined => {
  if (!folder) {
    return undefined;
  }

  const sanitized = folder
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .replace(/\/{2,}/g, "/");

  return sanitized || undefined;
};

/*
|--------------------------------------------------------------------------
| Public ID Sanitization
|--------------------------------------------------------------------------
*/

const sanitizePublicId = (publicId?: string): string | undefined => {
  if (!publicId) {
    return undefined;
  }

  const sanitized = publicId.trim().replace(/^\/+|\/+$/g, "");

  return sanitized || undefined;
};

/*
|--------------------------------------------------------------------------
| Buffer Validation
|--------------------------------------------------------------------------
*/

const validateBuffer = (buffer: Buffer): void => {
  if (!Buffer.isBuffer(buffer)) {
    throw new TypeError("Cloudinary upload requires a valid Buffer.");
  }

  if (buffer.length === 0) {
    throw new Error("Cannot upload an empty Buffer to Cloudinary.");
  }
};

/*
|--------------------------------------------------------------------------
| Tag Validation
|--------------------------------------------------------------------------
*/

const sanitizeTags = (tags?: string[]): string[] | undefined => {
  if (!tags) {
    return undefined;
  }

  if (!Array.isArray(tags)) {
    throw new TypeError("Cloudinary tags must be an array.");
  }

  const sanitized = tags
    .filter((tag): tag is string => typeof tag === "string")
    .map((tag) => tag.trim())
    .filter(Boolean);

  return sanitized.length > 0 ? sanitized : undefined;
};

/*
|--------------------------------------------------------------------------
| Context Validation
|--------------------------------------------------------------------------
*/

const sanitizeContext = (
  context?: Record<string, string>,
): Record<string, string> | undefined => {
  if (!context) {
    return undefined;
  }

  const sanitized: Record<string, string> = {};

  for (const [key, value] of Object.entries(context)) {
    if (typeof key !== "string" || typeof value !== "string") {
      continue;
    }

    const cleanKey = key.trim();

    const cleanValue = value.trim();

    if (cleanKey && cleanValue) {
      sanitized[cleanKey] = cleanValue;
    }
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
};

/*
|--------------------------------------------------------------------------
| Upload Options Builder
|--------------------------------------------------------------------------
*/

const buildUploadOptions = (
  options?: CloudinaryUploadOptions,
): UploadApiOptions => {
  const uploadOptions: UploadApiOptions = {
    resource_type: options?.resourceType ?? DEFAULT_RESOURCE_TYPE,

    overwrite: options?.overwrite ?? false,

    unique_filename: options?.useUniqueFilename ?? true,

    invalidate: options?.invalidate ?? true,
  };

  if (options?.accessMode) {
    uploadOptions.access_mode = options.accessMode;
  }

  const folder = sanitizeFolder(options?.folder);

  const publicId = sanitizePublicId(options?.publicId);

  const tags = sanitizeTags(options?.tags);

  const context = sanitizeContext(options?.context);

  if (folder) {
    uploadOptions.folder = folder;
  }

  if (publicId) {
    uploadOptions.public_id = publicId;
  }

  if (options?.transformation) {
    uploadOptions.transformation = options.transformation;
  }

  if (tags) {
    uploadOptions.tags = tags;
  }

  if (context) {
    uploadOptions.context = context;
  }

  return uploadOptions;
};

export const createPrivateCloudinaryDownloadUrl = (
  publicId: string,
  format: string,
  resourceType: "image" | "raw",
): string => {
  ensureCloudinaryConfigured();

  return getCloudinary().utils.private_download_url(publicId, format, {
    resource_type: resourceType,
    type: "authenticated",
    expires_at: Math.floor(Date.now() / 1000) + 15 * 60,
    attachment: true,
  });
};

/*
|--------------------------------------------------------------------------
| Upload Response Mapper
|--------------------------------------------------------------------------
*/

const mapUploadResponse = (
  response: UploadApiResponse,
): CloudinaryUploadResult => {
  return {
    publicId: response.public_id,

    secureUrl: response.secure_url,

    url: response.url,

    assetId: response.asset_id,

    version: response.version,

    resourceType: response.resource_type,

    format: response.format,

    bytes: response.bytes,

    width: response.width,

    height: response.height,

    originalFilename: response.original_filename,
  };
};

/*
|--------------------------------------------------------------------------
| Resource Response Mapper
|--------------------------------------------------------------------------
|
| This avoids relying on ResourceApiResponse from the installed
| Cloudinary SDK because its exposed TypeScript shape differs
| between SDK versions.
|
|--------------------------------------------------------------------------
*/

const mapResourceResponse = (
  response: CloudinaryResourceResponse,
): CloudinaryResourceResult => {
  return {
    publicId: response.public_id,

    secureUrl: response.secure_url,

    resourceType: response.resource_type,

    format: response.format,

    bytes: response.bytes,

    width: response.width,

    height: response.height,

    createdAt: response.created_at,
  };
};

/*
|--------------------------------------------------------------------------
| Upload From Path / Data URI
|--------------------------------------------------------------------------
*/

export const uploadToCloudinary = async (
  file: string,
  options?: CloudinaryUploadOptions,
): Promise<CloudinaryUploadResult> => {
  ensureCloudinaryConfigured();

  if (typeof file !== "string" || !file.trim()) {
    throw new TypeError(
      "Cloudinary upload requires a valid file path or data URI.",
    );
  }

  const cloudinary = getCloudinary();

  const uploadOptions = buildUploadOptions(options);

  try {
    const response = await cloudinary.uploader.upload(file, uploadOptions);

    logger.info(
      {
        publicId: response.public_id,

        resourceType: response.resource_type,

        bytes: response.bytes,
      },
      "Cloudinary asset uploaded successfully.",
    );

    return mapUploadResponse(response);
  } catch (error) {
    logger.error(
      {
        error,

        resourceType: uploadOptions.resource_type,
      },
      "Cloudinary asset upload failed.",
    );

    throw error;
  }
};

/*
|--------------------------------------------------------------------------
| Upload Buffer
|--------------------------------------------------------------------------
*/

export const uploadBufferToCloudinary = async (
  input: CloudinaryUploadBufferInput,
  options?: CloudinaryUploadOptions,
): Promise<CloudinaryUploadResult> => {
  ensureCloudinaryConfigured();

  if (!input) {
    throw new TypeError("Cloudinary buffer upload input is required.");
  }

  validateBuffer(input.buffer);

  if (input.filename && input.filename.length > MAX_FILENAME_LENGTH) {
    throw new Error(
      `Filename cannot exceed ${MAX_FILENAME_LENGTH} characters.`,
    );
  }

  const cloudinary = getCloudinary();

  const uploadOptions = buildUploadOptions(options);

  return new Promise((resolve, reject) => {
    let settled = false;

    const stream = cloudinary.uploader.upload_stream(
      uploadOptions,

      (
        error: UploadApiErrorResponse | undefined,

        result: UploadApiResponse | undefined,
      ) => {
        if (settled) {
          return;
        }

        if (error) {
          settled = true;

          logger.error(
            {
              error,
            },
            "Cloudinary buffer upload failed.",
          );

          reject(error);

          return;
        }

        if (!result) {
          settled = true;

          const error = new Error(
            "Cloudinary returned an empty upload response.",
          );

          logger.error(
            {
              error,
            },
            "Cloudinary buffer upload returned no result.",
          );

          reject(error);

          return;
        }

        settled = true;

        logger.info(
          {
            publicId: result.public_id,

            resourceType: result.resource_type,

            bytes: result.bytes,
          },
          "Cloudinary buffer uploaded successfully.",
        );

        resolve(mapUploadResponse(result));
      },
    );

    stream.on("error", (error) => {
      if (settled) {
        return;
      }

      settled = true;

      logger.error(
        {
          error,
        },
        "Cloudinary upload stream failed.",
      );

      reject(error);
    });

    stream.end(input.buffer);
  });
};

/*
|--------------------------------------------------------------------------
| Upload Base64
|--------------------------------------------------------------------------
*/

export const uploadBase64ToCloudinary = async (
  base64: string,
  options?: CloudinaryUploadOptions,
): Promise<CloudinaryUploadResult> => {
  if (typeof base64 !== "string" || !base64.trim()) {
    throw new TypeError("A valid Base64 string is required.");
  }

  const normalizedBase64 = base64.startsWith("data:")
    ? base64
    : `data:image/jpeg;base64,${base64}`;

  return uploadToCloudinary(normalizedBase64, options);
};

/*
|--------------------------------------------------------------------------
| Delete Single Asset
|--------------------------------------------------------------------------
*/

export const deleteFromCloudinary = async (
  publicId: string,
  resourceType: UploadApiOptions["resource_type"] = DEFAULT_RESOURCE_TYPE,
  deliveryType?: "upload" | "private" | "authenticated",
): Promise<CloudinaryDeleteResult> => {
  ensureCloudinaryConfigured();

  const sanitizedPublicId = sanitizePublicId(publicId);

  if (!sanitizedPublicId) {
    throw new TypeError("A valid Cloudinary public ID is required.");
  }

  const cloudinary = getCloudinary();

  try {
    const response = await cloudinary.uploader.destroy(
      sanitizedPublicId,

      {
        resource_type: resourceType,
        invalidate: true,
        ...(deliveryType ? { type: deliveryType } : {}),
      } as never,
    );

    logger.info(
      {
        publicId: sanitizedPublicId,

        result: response.result,
      },
      "Cloudinary asset deletion completed.",
    );

    return {
      publicId: sanitizedPublicId,

      result: response.result,
    };
  } catch (error) {
    logger.error(
      {
        error,

        publicId: sanitizedPublicId,
      },
      "Cloudinary asset deletion failed.",
    );

    throw error;
  }
};

/*
|--------------------------------------------------------------------------
| Delete Multiple Assets
|--------------------------------------------------------------------------
*/

export const deleteManyFromCloudinary = async (
  publicIds: string[],

  resourceType: UploadApiOptions["resource_type"] = DEFAULT_RESOURCE_TYPE,
): Promise<CloudinaryDeleteResult[]> => {
  ensureCloudinaryConfigured();

  if (!Array.isArray(publicIds)) {
    throw new TypeError("Cloudinary public IDs must be provided as an array.");
  }

  const sanitizedPublicIds = publicIds
    .map(sanitizePublicId)
    .filter((id): id is string => Boolean(id));

  if (sanitizedPublicIds.length === 0) {
    return [];
  }

  const cloudinary = getCloudinary();

  try {
    const response = await cloudinary.api.delete_resources(
      sanitizedPublicIds,

      {
        resource_type: resourceType,

        invalidate: true,
      },
    );

    const deleted = response.deleted ?? {};

    const results = Object.entries(deleted).map(([publicId, result]) => ({
      publicId,

      result: String(result),
    }));

    logger.info(
      {
        count: results.length,
      },
      "Cloudinary bulk asset deletion completed.",
    );

    return results;
  } catch (error) {
    logger.error(
      {
        error,

        count: sanitizedPublicIds.length,
      },
      "Cloudinary bulk asset deletion failed.",
    );

    throw error;
  }
};

/*
|--------------------------------------------------------------------------
| Replace Asset
|--------------------------------------------------------------------------
|
| Strategy:
|
| 1. Upload new asset
| 2. Confirm successful upload
| 3. Delete old asset
|
| If old asset deletion fails, the new asset is kept.
| This prevents accidental data loss.
|
|--------------------------------------------------------------------------
*/

export const replaceCloudinaryAsset = async (
  oldPublicId: string | undefined,

  file: string,

  options?: CloudinaryUploadOptions,
): Promise<CloudinaryUploadResult> => {
  const newAsset = await uploadToCloudinary(file, options);

  const oldId = sanitizePublicId(oldPublicId);

  if (oldId && oldId !== newAsset.publicId) {
    try {
      await deleteFromCloudinary(
        oldId,

        options?.resourceType ?? DEFAULT_RESOURCE_TYPE,
      );
    } catch (error) {
      logger.error(
        {
          error,

          oldPublicId: oldId,

          newPublicId: newAsset.publicId,
        },
        "New Cloudinary asset uploaded but old asset cleanup failed.",
      );
    }
  }

  return newAsset;
};

/*
|--------------------------------------------------------------------------
| Get Resource
|--------------------------------------------------------------------------
*/

export const getCloudinaryResource = async (
  publicId: string,

  resourceType: UploadApiOptions["resource_type"] = DEFAULT_RESOURCE_TYPE,
): Promise<CloudinaryResourceResult> => {
  ensureCloudinaryConfigured();

  const sanitizedPublicId = sanitizePublicId(publicId);

  if (!sanitizedPublicId) {
    throw new TypeError("A valid Cloudinary public ID is required.");
  }

  const cloudinary = getCloudinary();

  try {
    const response = await cloudinary.api.resource(
      sanitizedPublicId,

      {
        resource_type: resourceType,
      },
    );

    return mapResourceResponse(response as CloudinaryResourceResponse);
  } catch (error) {
    logger.error(
      {
        error,

        publicId: sanitizedPublicId,
      },
      "Cloudinary resource lookup failed.",
    );

    throw error;
  }
};

/*
|--------------------------------------------------------------------------
| Generate Secure Cloudinary URL
|--------------------------------------------------------------------------
*/

export const generateCloudinaryUrl = (
  publicId: string,

  options?: {
    readonly resourceType?: UploadApiOptions["resource_type"];

    readonly transformation?: UploadApiOptions["transformation"];
  },
): string => {
  ensureCloudinaryConfigured();

  const sanitizedPublicId = sanitizePublicId(publicId);

  if (!sanitizedPublicId) {
    throw new TypeError("A valid Cloudinary public ID is required.");
  }

  const cloudinary = getCloudinary();

  return cloudinary.url(
    sanitizedPublicId,

    {
      resource_type: options?.resourceType ?? DEFAULT_RESOURCE_TYPE,

      secure: true,

      transformation: options?.transformation,
    },
  );
};

/*
|--------------------------------------------------------------------------
| Service Health
|--------------------------------------------------------------------------
*/

export const checkCloudinaryService = (): CloudinaryServiceHealth => {
  const configured = isCloudinaryConfiguredStatus();

  return {
    configured,

    ready: configured,
  };
};
