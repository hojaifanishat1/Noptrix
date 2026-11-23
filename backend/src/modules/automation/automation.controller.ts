import { Request, Response } from "express";
import { ApiError } from "../../utils/ApiError";
import {
  createAutomationRule,
  deleteAutomationRule,
  getAutomationRule,
  listAutomationExecutions,
  listAutomationRules,
  setAutomationRuleEnabled,
  testAutomationRule,
  updateAutomationRule,
} from "./automation.service";
import {
  CreateAutomationRuleInput,
  UpdateAutomationRuleInput,
} from "./automation.validator";

function ownerId(req: Request): string {
  const id = req.ownerAuth?.userId;
  if (!id) throw ApiError.unauthorized("Owner authentication is required.");
  return id;
}

function param(req: Request): string {
  const id = req.params.ruleId;
  if (typeof id !== "string" || !id) throw ApiError.badRequest("Invalid rule ID.");
  return id;
}

export async function listRulesController(req: Request, res: Response) {
  const result = await listAutomationRules(
    req.query as unknown as {
      search?: string;
      trigger?: never;
      actionType?: "LOG_EVENT" | "SEND_NOTIFICATION";
      enabled?: boolean;
      page: number;
      limit: number;
    },
  );
  res.status(200).json({ success: true, data: result.items, pagination: result.pagination });
}

export async function createRuleController(req: Request, res: Response) {
  const rule = await createAutomationRule(ownerId(req), req.body as CreateAutomationRuleInput);
  res.status(201).json({ success: true, message: "Automation rule created.", data: rule });
}

export async function getRuleController(req: Request, res: Response) {
  const rule = await getAutomationRule(param(req));
  if (!rule) throw ApiError.notFound("Automation rule not found.");
  res.status(200).json({ success: true, data: rule });
}

export async function updateRuleController(req: Request, res: Response) {
  const rule = await updateAutomationRule(
    param(req),
    ownerId(req),
    req.body as UpdateAutomationRuleInput,
  );
  if (!rule) throw ApiError.notFound("Automation rule not found.");
  res.status(200).json({ success: true, message: "Automation rule updated.", data: rule });
}

export async function deleteRuleController(req: Request, res: Response) {
  const deleted = await deleteAutomationRule(param(req));
  if (!deleted) throw ApiError.notFound("Automation rule not found.");
  res.status(200).json({ success: true, message: "Automation rule deleted." });
}

export async function enableRuleController(req: Request, res: Response) {
  const rule = await setAutomationRuleEnabled(param(req), ownerId(req), true);
  if (!rule) throw ApiError.notFound("Automation rule not found.");
  res.status(200).json({ success: true, data: rule });
}

export async function disableRuleController(req: Request, res: Response) {
  const rule = await setAutomationRuleEnabled(param(req), ownerId(req), false);
  if (!rule) throw ApiError.notFound("Automation rule not found.");
  res.status(200).json({ success: true, data: rule });
}

export async function testRuleController(req: Request, res: Response) {
  const result = await testAutomationRule(
    param(req),
    req.body.payload as Record<string, unknown>,
  );
  if (!result) throw ApiError.notFound("Automation rule not found.");
  res.status(200).json({
    success: true,
    message: "Dry run completed. No business action was executed.",
    data: result,
  });
}

export async function listExecutionsController(req: Request, res: Response) {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const result = await listAutomationExecutions({ page, limit, status });
  res.status(200).json({ success: true, data: result.items, pagination: result.pagination });
}
