const express = require("express");
const router = express.Router();
const cookieController = require("../controllers/cookieController");
const { requirePermission } = require("../middleware/rbacMiddleware");

// Public routes (Frontend banner)
router.post("/consent", cookieController.submitConsent);
router.get("/config", cookieController.getConfig);
router.post("/config", cookieController.updateConfig);

// Protected Admin routes
// Notice we use the requirePermission middleware for all /admin routes
router.get("/admin/dashboard", requirePermission, cookieController.getDashboardStats);
router.get("/admin/logs", requirePermission, cookieController.getConsentLogs);
router.get("/admin/export", requirePermission, cookieController.exportLogs);
router.get("/admin/consent/:id", requirePermission, cookieController.getConsentDetails);

module.exports = router;
