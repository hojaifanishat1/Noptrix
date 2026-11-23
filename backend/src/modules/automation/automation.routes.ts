import { Router } from "express";
import { ownerAuth, ownerSecretVerified } from "../../middlewares/ownerAuth.middleware";
import { validate } from "../../middlewares/validation.middleware";
import { asyncHandler } from "../../utils/asyncHandler";
import {
  createRuleController,
  deleteRuleController,
  disableRuleController,
  enableRuleController,
  getRuleController,
  listExecutionsController,
  listRulesController,
  testRuleController,
  updateRuleController,
} from "./automation.controller";
import {
  automationIdParamsSchema,
  automationListQuerySchema,
  automationTestSchema,
  createAutomationRuleSchema,
  updateAutomationRuleSchema,
} from "./automation.validator";

const router = Router();

router.use(ownerAuth, ownerSecretVerified);

router.get("/", validate(automationListQuerySchema, "query"), asyncHandler(listRulesController));
router.post("/", validate(createAutomationRuleSchema, "body"), asyncHandler(createRuleController));
router.get("/executions", asyncHandler(listExecutionsController));

router.get("/:ruleId", validate(automationIdParamsSchema, "params"), asyncHandler(getRuleController));
router.patch(
  "/:ruleId",
  validate(automationIdParamsSchema, "params"),
  validate(updateAutomationRuleSchema, "body"),
  asyncHandler(updateRuleController),
);
router.delete("/:ruleId", validate(automationIdParamsSchema, "params"), asyncHandler(deleteRuleController));
router.post("/:ruleId/enable", validate(automationIdParamsSchema, "params"), asyncHandler(enableRuleController));
router.post("/:ruleId/disable", validate(automationIdParamsSchema, "params"), asyncHandler(disableRuleController));
router.post(
  "/:ruleId/test",
  validate(automationIdParamsSchema, "params"),
  validate(automationTestSchema, "body"),
  asyncHandler(testRuleController),
);

export default router;
