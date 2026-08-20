const express = require("express");
const router = express.Router();
const offerLetterGeneratorController = require("../controllers/offerLetterGeneratorController");
const authMiddleware = require("../middleware/rbacMiddleware");

// Ensure only authorized users can access
router.use(authMiddleware.requirePermission);
// You can add more specific RBAC middleware here if needed

// --- Settings ---
router.get("/settings", offerLetterGeneratorController.getCompanySettings);
router.post("/settings", offerLetterGeneratorController.updateCompanySettings);

// --- Clauses ---
router.get("/clauses", offerLetterGeneratorController.getClauses);
router.post("/clauses", offerLetterGeneratorController.createClause);
router.put("/clauses/:id", offerLetterGeneratorController.updateClause);
router.delete("/clauses/:id", offerLetterGeneratorController.deleteClause);

// --- Signatories ---
router.get("/signatories", offerLetterGeneratorController.getSignatories);
router.post("/signatories", offerLetterGeneratorController.createSignatory);
router.put("/signatories/:id", offerLetterGeneratorController.updateSignatory);
router.delete("/signatories/:id", offerLetterGeneratorController.deleteSignatory);

// --- PDF Generation ---
router.post("/generate-pdf", offerLetterGeneratorController.generatePdf);

module.exports = router;
