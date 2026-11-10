import { Router } from "express";

import { userAuth } from "../../middlewares/userAuth.middleware";

import {
  adminAuth,
  adminSecretVerified,
} from "../../middlewares/adminAuth.middleware";

import { requirePermissionMatch } from "../../middlewares/permission.middleware";

import { validate } from "../../middlewares/validation.middleware";

import {
  createJobApplicationController,
  getMyJobApplicationsController,
  getMyJobApplicationController,
  withdrawJobApplicationController,
  getAllJobApplicationsController,
  getJobApplicationController,
  updateJobApplicationStatusController,
  getVacancyApplicationSummaryController,
  getRecruitmentReportsController,
  requestRiderConversionController,
} from "./application.controller";

import { requireJobApplicationStatusPermission } from "./application-authorization.middleware";

import {
  createJobApplicationSchema,
  updateJobApplicationStatusSchema,
  jobApplicationIdParamSchema,
  jobApplicationQuerySchema,
  recruitmentReportsQuerySchema,
  vacancyIdParamSchema,
} from "./application.validator";

const router = Router();

/*
|--------------------------------------------------------------------------
| USER / APPLICANT
|--------------------------------------------------------------------------
*/

router.post(
  "/",
  userAuth,
  validate(createJobApplicationSchema, "body"),
  createJobApplicationController,
);

router.get(
  "/me",
  userAuth,
  validate(jobApplicationQuerySchema, "query"),
  getMyJobApplicationsController,
);

router.get(
  "/me/:applicationId",
  userAuth,
  validate(jobApplicationIdParamSchema, "params"),
  getMyJobApplicationController,
);

router.post(
  "/me/:applicationId/withdraw",
  userAuth,
  validate(jobApplicationIdParamSchema, "params"),
  withdrawJobApplicationController,
);

/*
|--------------------------------------------------------------------------
| ADMIN / OWNER MANAGEMENT
|--------------------------------------------------------------------------
|
| OWNER:
|   Full automatic access.
|
| Other administrators:
|   Only explicitly granted permissions.
|
|--------------------------------------------------------------------------
*/

const managementAuth = [adminAuth, adminSecretVerified];

/*
|--------------------------------------------------------------------------
| RECRUITMENT REPORTS
|--------------------------------------------------------------------------
*/

router.get(
  "/reports/summary",
  ...managementAuth,
  requirePermissionMatch("job_applications.read", "job_applications.manage"),
  validate(recruitmentReportsQuerySchema, "query"),
  getRecruitmentReportsController,
);

/*
|--------------------------------------------------------------------------
| VACANCY APPLICATION SUMMARY
|--------------------------------------------------------------------------
*/

router.get(
  "/vacancy/:vacancyId/summary",
  ...managementAuth,
  requirePermissionMatch("job_applications.read", "job_applications.manage"),
  validate(vacancyIdParamSchema, "params"),
  getVacancyApplicationSummaryController,
);

/*
|--------------------------------------------------------------------------
| ALL APPLICATIONS
|--------------------------------------------------------------------------
*/

router.get(
  "/",
  ...managementAuth,
  requirePermissionMatch("job_applications.read", "job_applications.manage"),
  validate(jobApplicationQuerySchema, "query"),
  getAllJobApplicationsController,
);

/*
|--------------------------------------------------------------------------
| STATUS UPDATE
|--------------------------------------------------------------------------
|
| Permission depends on requested status:
|
| SELECTED:
|   job_applications.approve
|
| REJECTED:
|   job_applications.reject
|
| Other status:
|   job_applications.update
|
| manage:
|   Full job application management.
|
|--------------------------------------------------------------------------
*/

router.patch(
  "/:applicationId/status",
  ...managementAuth,
  validate(jobApplicationIdParamSchema, "params"),
  validate(updateJobApplicationStatusSchema, "body"),
  requireJobApplicationStatusPermission,
  updateJobApplicationStatusController,
);

router.post(
  "/:applicationId/rider-conversion-request",
  ...managementAuth,
  validate(jobApplicationIdParamSchema, "params"),
  requirePermissionMatch(
    "job_applications.approve",
    "job_applications.manage",
  ),
  requestRiderConversionController,
);

/*
|--------------------------------------------------------------------------
| SINGLE APPLICATION
|--------------------------------------------------------------------------
*/

router.get(
  "/:applicationId",
  ...managementAuth,
  requirePermissionMatch("job_applications.read", "job_applications.manage"),
  validate(jobApplicationIdParamSchema, "params"),
  getJobApplicationController,
);

export default router;
