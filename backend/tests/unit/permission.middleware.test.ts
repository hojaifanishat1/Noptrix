import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { requirePermission } from "../../src/middlewares/permission.middleware";

describe("requirePermission", () => {
  it("allows authenticated owners through the permission check", async () => {
    const app = express();
    app.get(
      "/protected",
      (req, _res, next) => {
        req.ownerAuth = {
          ownerId: "owner-id",
          userId: "owner-id",
          role: "OWNER",
          secretVerified: true,
          claims: {},
        };
        next();
      },
      requirePermission("orders.read"),
      (_req, res) => res.sendStatus(204),
    );

    const response = await request(app).get("/protected");

    expect(response.status).toBe(204);
  });

  it("rejects requests without an authenticated user or admin", async () => {
    const app = express();
    app.get("/protected", requirePermission("orders.read"), (_req, res) =>
      res.sendStatus(204),
    );

    const response = await request(app).get("/protected");

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Authentication required.");
  });
});
