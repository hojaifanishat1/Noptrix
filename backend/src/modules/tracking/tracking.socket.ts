import { Types } from "mongoose";
import type { Namespace, Socket } from "socket.io";

import { verifyAccessToken } from "../../utils/token";
import { getLiveChatSocketServer } from "../live-chat/live-chat.socket";

import { User, USER_STATUSES } from "../users/user.model";
import { Rider } from "../riders/rider.model";
import { Admin, ADMIN_STATUSES } from "../admins/admin.model";
import { Owner, OWNER_STATUSES } from "../owners/owner.model";
import { Role, ROLE_STATUSES } from "../roles/role.model";
import { loadRolePermissions } from "../../middlewares/permission.middleware";

import OrderModel from "../orders/order.model";
import { Tracking } from "./tracking.model";
import { TrackingEvent } from "./tracking-event.model";

type TrackingActor =
  | {
      id: string;
      type: "RIDER";
      riderDocumentId: string;
    }
  | {
      id: string;
      type: "CUSTOMER";
    }
  | {
      id: string;
      type: "ADMIN" | "OWNER";
    };

type TrackingSocket = Socket & {
  data: {
    actor?: TrackingActor;
  };
};

let trackingNamespace: Namespace | null = null;

const ACTIVE_STATUSES = [
  "ASSIGNED",
  "PICKED_UP",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
] as const;

const TERMINAL_STATUSES = ["DELIVERED", "CANCELLED"] as const;

const orderRoom = (id: string) => `tracking:order:${id}`;
const riderRoom = (id: string) => `tracking:rider:${id}`;
const monitorRoom = "tracking:authorized-monitors";

const objectId = (value: unknown): value is string =>
  typeof value === "string" && /^[a-f\d]{24}$/i.test(value);

function ack(callback: unknown, payload: Record<string, unknown>): void {
  if (typeof callback === "function") {
    try {
      (callback as (data: Record<string, unknown>) => void)(payload);
    } catch {
      // A disconnected client must not crash the socket handler.
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validCoordinates(
  latitude: unknown,
  longitude: unknown,
): latitude is number {
  return (
    typeof latitude === "number" &&
    Number.isFinite(latitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    typeof longitude === "number" &&
    Number.isFinite(longitude) &&
    longitude >= -180 &&
    longitude <= 180
  );
}

async function authenticate(socket: TrackingSocket): Promise<TrackingActor> {
  const authToken = socket.handshake.auth?.token;
  const authorization = socket.handshake.headers.authorization;

  const token =
    typeof authToken === "string"
      ? authToken.trim()
      : typeof authorization === "string" && /^Bearer\s+/i.test(authorization)
        ? authorization.replace(/^Bearer\s+/i, "").trim()
        : "";

  if (!token) {
    throw new Error("Authentication required.");
  }

  const payload = verifyAccessToken(token);

  if (payload.tokenType !== "access") {
    throw new Error("An access token is required.");
  }

  const subject = String(payload.sub ?? "");
  const role = String(payload.role ?? "CUSTOMER").toUpperCase();

  if (!objectId(subject)) {
    throw new Error("Invalid token subject.");
  }

  const userId = new Types.ObjectId(subject);

  const user = await User.findById(userId).select("_id status").lean();

  if (!user || user.status !== USER_STATUSES.ACTIVE) {
    throw new Error("Active user account required.");
  }

  if (role === "RIDER") {
    const rider = await Rider.findOne({
      userId,
      status: "ACTIVE",
    })
      .select("_id userId status")
      .lean();

    if (!rider) {
      throw new Error("Active rider account required.");
    }

    return {
      id: subject,
      type: "RIDER",
      riderDocumentId: String(rider._id),
    };
  }

  if (role === "OWNER") {
    if ((payload as { secretVerified?: boolean }).secretVerified !== true) {
      throw new Error("Owner secret verification required.");
    }

    const owner = await Owner.findOne({ userId })
      .select("_id userId status")
      .lean();

    if (!owner || owner.status !== OWNER_STATUSES.ACTIVE) {
      throw new Error("Active owner account required.");
    }

    return { id: subject, type: "OWNER" };
  }

  if (role === "ADMIN") {
    let admin = await Admin.findOne({ userId }).lean();

    if (!admin) {
      admin = await Admin.findById(userId).lean();
    }

    if (!admin || admin.status !== ADMIN_STATUSES.ACTIVE) {
      throw new Error("Active admin account required.");
    }

    const adminRole = await Role.findById(admin.roleId).lean();

    if (!adminRole || adminRole.status !== ROLE_STATUSES.ACTIVE) {
      throw new Error("Active admin role required.");
    }

    const permissions = await loadRolePermissions(String(admin.roleId));
    const allowedPermissions = [
      "tracking.read",
      "tracking.manage",
      "delivery.read",
      "delivery.manage",
    ];

    if (
      !permissions.some((permission) => allowedPermissions.includes(permission))
    ) {
      throw new Error("Tracking permission required.");
    }

    return {
      id: String(admin.userId),
      type: "ADMIN",
    };
  }

  if (role !== "CUSTOMER" && role !== "USER") {
    throw new Error("Unsupported account role.");
  }

  return { id: subject, type: "CUSTOMER" };
}

function publicTracking(tracking: {
  _id: unknown;
  orderId: unknown;
  riderId?: unknown;
  status: string;
  currentLatitude?: number;
  currentLongitude?: number;
  currentAddress?: string;
  lastLocationAt?: Date;
  estimatedDeliveryAt?: Date;
}) {
  return {
    trackingId: String(tracking._id),
    orderId: String(tracking.orderId),
    riderId: tracking.riderId ? String(tracking.riderId) : null,
    status: tracking.status,
    latitude: tracking.currentLatitude ?? null,
    longitude: tracking.currentLongitude ?? null,
    address: tracking.currentAddress ?? null,
    lastLocationAt: tracking.lastLocationAt ?? null,
    estimatedDeliveryAt: tracking.estimatedDeliveryAt ?? null,
    isTerminal: TERMINAL_STATUSES.includes(
      tracking.status as (typeof TERMINAL_STATUSES)[number],
    ),
  };
}

async function publishLocation(
  trackingId: string,
  riderDocumentId: string,
  latitude: number,
  longitude: number,
  address?: string,
  message?: string,
) {
  const tracking = await Tracking.findOne({
    _id: new Types.ObjectId(trackingId),
    riderId: new Types.ObjectId(riderDocumentId),
    status: { $in: ACTIVE_STATUSES },
  });

  if (!tracking) {
    throw new Error("No active tracking assignment was found.");
  }

  tracking.currentLatitude = latitude;
  tracking.currentLongitude = longitude as number;
  tracking.lastLocationAt = new Date();

  if (address !== undefined) {
    tracking.currentAddress = address;
  }

  await tracking.save();

  await TrackingEvent.create({
    trackingId: tracking._id,
    orderId: tracking.orderId,
    riderId: tracking.riderId,
    type: "LOCATION_UPDATED",
    status: tracking.status,
    latitude,
    longitude,
    address: tracking.currentAddress,
    message,
  });

  return {
    ...publicTracking(tracking),
    latitude,
    longitude,
    address: tracking.currentAddress ?? null,
  };
}

export function initializeTrackingSocket(): Namespace {
  const io = getLiveChatSocketServer();

  if (!io) {
    throw new Error(
      "Initialize the Live Chat Socket.IO server before tracking.",
    );
  }

  if (trackingNamespace) {
    return trackingNamespace;
  }

  const namespace = io.of("/tracking");
  trackingNamespace = namespace;

  namespace.use((rawSocket, next) => {
    void authenticate(rawSocket as TrackingSocket)
      .then((actor) => {
        (rawSocket as TrackingSocket).data.actor = actor;
        next();
      })
      .catch(() => {
        next(new Error("Tracking authentication failed."));
      });
  });

  namespace.on("connection", (rawSocket) => {
    const socket = rawSocket as TrackingSocket;
    const actor = socket.data.actor;

    if (!actor) {
      socket.disconnect(true);
      return;
    }

    if (actor.type === "RIDER") {
      void socket.join(riderRoom(actor.riderDocumentId));
    }

    if (actor.type === "OWNER" || actor.type === "ADMIN") {
      void socket.join(monitorRoom);
    }

    socket.on(
      "tracking:subscribe",
      async (data: unknown, callback?: unknown) => {
        try {
          if (
            actor.type !== "CUSTOMER" ||
            !isRecord(data) ||
            !objectId(data.orderId)
          ) {
            ack(callback, {
              success: false,
              message:
                "Customer authentication and a valid orderId are required.",
            });
            return;
          }

          const order = await OrderModel.findOne({
            _id: new Types.ObjectId(data.orderId),
            userId: new Types.ObjectId(actor.id),
          })
            .select("_id")
            .lean();

          if (!order) {
            ack(callback, {
              success: false,
              message: "Order not found or access denied.",
            });
            return;
          }

          const tracking = await Tracking.findOne({
            orderId: order._id,
          }).lean();

          if (!tracking) {
            ack(callback, {
              success: false,
              message: "Tracking record not found.",
            });
            return;
          }

          await socket.join(orderRoom(String(order._id)));

          ack(callback, {
            success: true,
            data: publicTracking(tracking),
          });
        } catch {
          ack(callback, {
            success: false,
            message: "Unable to subscribe to tracking.",
          });
        }
      },
    );

    socket.on(
      "tracking:unsubscribe",
      async (data: unknown, callback?: unknown) => {
        try {
          if (
            actor.type !== "CUSTOMER" ||
            !isRecord(data) ||
            !objectId(data.orderId)
          ) {
            ack(callback, {
              success: false,
              message: "Invalid orderId.",
            });
            return;
          }

          // Verify ownership before leaving the requested order room.
          const order = await OrderModel.findOne({
            _id: new Types.ObjectId(data.orderId),
            userId: new Types.ObjectId(actor.id),
          })
            .select("_id")
            .lean();

          if (!order) {
            ack(callback, {
              success: false,
              message: "Order not found or access denied.",
            });
            return;
          }

          await socket.leave(orderRoom(String(order._id)));
          ack(callback, { success: true });
        } catch {
          ack(callback, {
            success: false,
            message: "Unable to unsubscribe.",
          });
        }
      },
    );

    socket.on(
      "tracking:location:update",
      async (data: unknown, callback?: unknown) => {
        try {
          if (actor.type !== "RIDER") {
            ack(callback, {
              success: false,
              message: "Only riders can submit GPS updates.",
            });
            return;
          }

          if (
            !isRecord(data) ||
            !objectId(data.trackingId) ||
            !validCoordinates(data.latitude, data.longitude)
          ) {
            ack(callback, {
              success: false,
              message: "Valid trackingId, latitude and longitude are required.",
            });
            return;
          }

          const address =
            typeof data.address === "string"
              ? data.address.trim().slice(0, 500)
              : undefined;

          const message =
            typeof data.message === "string"
              ? data.message.trim().slice(0, 500)
              : undefined;

          const latitude = data.latitude;
          const longitude = data.longitude;

          if (
            typeof latitude !== "number" ||
            !Number.isFinite(latitude) ||
            latitude < -90 ||
            latitude > 90 ||
            typeof longitude !== "number" ||
            !Number.isFinite(longitude) ||
            longitude < -180 ||
            longitude > 180
          ) {
            if (typeof callback === "function") {
              callback({
                success: false,
                message: "Valid latitude and longitude are required.",
              });
            }
            return;
          }

          const update = await publishLocation(
            data.trackingId as string,
            actor.riderDocumentId,
            latitude,
            longitude,
            address,
            message,
          );

          namespace
            .to(orderRoom(update.orderId))
            .emit("tracking:location", update);

          namespace.to(monitorRoom).emit("tracking:location", update);

          ack(callback, {
            success: true,
            data: update,
          });
        } catch (error) {
          ack(callback, {
            success: false,
            message:
              error instanceof Error
                ? error.message
                : "Unable to update location.",
          });
        }
      },
    );

    socket.on("tracking:monitor:join", (callback?: unknown) => {
      if (actor.type !== "OWNER" && actor.type !== "ADMIN") {
        ack(callback, {
          success: false,
          message: "Monitoring permission required.",
        });
        return;
      }

      ack(callback, { success: true });
    });
  });

  return namespace;
}

/**
 * Publish a tracking status update to authorized tracking rooms.
 * Call after the status has been successfully saved by the service.
 */
export function broadcastTrackingStatus(tracking: {
  _id: unknown;
  orderId: unknown;
  riderId?: unknown;
  status: string;
  currentLatitude?: number;
  currentLongitude?: number;
  currentAddress?: string;
  lastLocationAt?: Date;
  estimatedDeliveryAt?: Date;
}) {
  if (!trackingNamespace) return;

  const payload = publicTracking(tracking);
  const orderId = String(tracking.orderId);

  trackingNamespace.to(orderRoom(orderId)).emit("tracking:status", payload);

  trackingNamespace.to(monitorRoom).emit("tracking:status", payload);

  if (
    TERMINAL_STATUSES.includes(
      tracking.status as (typeof TERMINAL_STATUSES)[number],
    )
  ) {
    trackingNamespace
      .to(orderRoom(orderId))
      .emit("tracking:completed", payload);
  }
}

export const getTrackingSocketNamespace = () => trackingNamespace;
