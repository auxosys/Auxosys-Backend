const express = require("express");
const router = express.Router();
const clientController = require("../controllers/clientController");
const { requirePermission } = require("../middleware/rbacMiddleware");

router.use(requirePermission); // Ensure all routes are protected

router.get("/", clientController.listClients);
router.post("/", clientController.createClient);
router.post("/reorder", clientController.reorderClients);
router.get("/:id", clientController.getClient);
router.put("/:id", clientController.updateClient);
router.patch("/:id/archive", clientController.archiveClient);
router.patch("/:id/unarchive", clientController.unarchiveClient);
router.delete("/:id", clientController.deleteClient);

module.exports = router;
