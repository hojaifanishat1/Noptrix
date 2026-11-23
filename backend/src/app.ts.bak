import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import { env } from "./config/env";
import apiRoutes from "./routes";

import { maintenanceModeMiddleware } from "./modules/maintenance/maintenance.middleware";

import { securityMiddleware } from "./middlewares/security.middleware";

import { globalRateLimiter } from "./middlewares/rateLimit.middleware";

import {
  notFoundMiddleware,
  errorMiddleware,
} from "./middlewares/error.middleware";

/*
|--------------------------------------------------------------------------
| Express Application
|--------------------------------------------------------------------------
*/

const app = express();

/*
|--------------------------------------------------------------------------
| Trust Proxy
|--------------------------------------------------------------------------
|
| Required when the application runs behind:
| - Nginx
| - Cloudflare
| - Load Balancer
| - Reverse Proxy
|
| This allows Express to correctly resolve client IPs
| for rate limiting, audit logs and security middleware.
|--------------------------------------------------------------------------
*/

app.set("trust proxy", 1);

/*
|--------------------------------------------------------------------------
| Security Middleware
|--------------------------------------------------------------------------
*/

app.use(securityMiddleware);

/*
|--------------------------------------------------------------------------
| CORS
|--------------------------------------------------------------------------
*/

app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  }),
);

/*
|--------------------------------------------------------------------------
| Global Rate Limiting
|--------------------------------------------------------------------------
*/

app.use(globalRateLimiter);

/*
|--------------------------------------------------------------------------
| Body Parsers
|--------------------------------------------------------------------------
*/

app.use(
  express.json({
    limit: "2mb",
    verify: (req, _res, buffer) => {
      (
        req as typeof req & {
          rawBody?: Buffer;
        }
      ).rawBody = Buffer.from(buffer);
    },
  }),
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "2mb",
  }),
);

/*
|--------------------------------------------------------------------------
| Cookie Parser
|--------------------------------------------------------------------------
|
| Parses the Cookie request header and exposes cookies through:
|
|     req.cookies
|
| Required for:
| - Owner refresh token
| - Authentication cookies
| - Session cookies
| - Future secure HTTP-only cookies
|--------------------------------------------------------------------------
*/

app.use(cookieParser());

/*
|--------------------------------------------------------------------------
| Root Route
|--------------------------------------------------------------------------
*/

app.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "NOPTRIX API is Running",
    service: "backend",
    environment: process.env.NODE_ENV ?? "development",
    timestamp: new Date().toISOString(),
  });
});

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

// Maintenance mode runs before API routes.
// Health and maintenance management endpoints are exempt.
app.use("/api", maintenanceModeMiddleware, apiRoutes);

/*
|--------------------------------------------------------------------------
| 404 Handler
|--------------------------------------------------------------------------
|
| Must be registered after all valid routes.
|--------------------------------------------------------------------------
*/

app.use(notFoundMiddleware);

/*
|--------------------------------------------------------------------------
| Global Error Handler
|--------------------------------------------------------------------------
|
| Must be the final middleware.
|--------------------------------------------------------------------------
*/

app.use(errorMiddleware);

/*
|--------------------------------------------------------------------------
| Export Application
|--------------------------------------------------------------------------
*/

export default app;
