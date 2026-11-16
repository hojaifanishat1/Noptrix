import { Router } from "express";

import {
  getRiderOnboardingProgressController,
  getSellerOnboardingProgressController,
  updateRiderOnboardingProfileController,
  updateSellerOnboardingProfileController,
} from "./onboarding-profile.controller";


import {
  ownerAuth,
  ownerSecretVerified,
} from "../../middlewares/ownerAuth.middleware";

import { sellerAuth } from "../../middlewares/sellerAuth.middleware";
import { riderAuth } from "../../middlewares/riderAuth.middleware";
import { uploadCommon } from "../../middlewares/upload.middleware";

import {
  getOwnerOnboardingDocumentsController,
  getRiderOnboardingDocumentsController,
  getSellerOnboardingDocumentsController,
  reviewOnboardingDocumentController,
  uploadRiderOnboardingDocumentController,
  uploadSellerOnboardingDocumentController,
} from "./onboarding-document.controller";

const router = Router();

const ownerOnly = [ownerAuth, ownerSecretVerified];

// Seller onboarding
router.get("/seller/progress", sellerAuth, getSellerOnboardingProgressController);
router.patch("/seller/profile", sellerAuth, updateSellerOnboardingProfileController);
router.get(
  "/seller/documents",
  sellerAuth,
  getSellerOnboardingDocumentsController,
);

router.post(
  "/seller/documents",
  sellerAuth,
  uploadCommon.single("document"),
  uploadSellerOnboardingDocumentController,
);

// Rider onboarding
router.get("/rider/progress", riderAuth, getRiderOnboardingProgressController);
router.patch("/rider/profile", riderAuth, updateRiderOnboardingProfileController);
router.get(
  "/rider/documents",
  riderAuth,
  getRiderOnboardingDocumentsController,
);

router.post(
  "/rider/documents",
  riderAuth,
  uploadCommon.single("document"),
  uploadRiderOnboardingDocumentController,
);

// Owner document review
router.get(
  "/owner/documents",
  ...ownerOnly,
  getOwnerOnboardingDocumentsController,
);

router.patch(
  "/owner/documents/:documentId/review",
  ...ownerOnly,
  reviewOnboardingDocumentController,
);

export default router;
