import type { RequestHandler } from "express";
import { createSystemLog } from "../modules/system-logs/system-log.service";

function safeHeader(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim();
  return /^[a-zA-Z0-9._:-]{1,128}$/.test(normalized)
    ? normalized
    : undefined;
}

export const apiRequestLogMiddleware: RequestHandler = (req, res, next) => {
  const startedAt = Date.now();

  res.once("finish", () => {
    if (req.method === "OPTIONS") return;

    const statusCode = res.statusCode;
    const level: "INFO" | "WARN" | "ERROR" =
      statusCode >= 500 ? "ERROR" : statusCode >= 400 ? "WARN" : "INFO";

    const path = req.originalUrl.split("?")[0].slice(0, 2048);

    void createSystemLog({
      level,
      source: "API",
      message: `API ${req.method} ${path} returned ${statusCode}`,
      method: req.method.slice(0, 12),
      path,
      requestId: safeHeader(req.get("x-request-id")),
      correlationId: safeHeader(req.get("x-correlation-id")),
      metadata: {
        statusCode,
        durationMs: Math.max(0, Date.now() - startedAt),
      },
    }).catch(() => {
      // Logging failures must never affect the API response.
    });
  });

  next();
};
