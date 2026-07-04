const express = require("express");
const router = express.Router();
const legalController = require("../controllers/legalController");

router.get("/admin/all", legalController.getAllLegalPages);
router.post("/", legalController.createPage);
router.put("/reorder", legalController.reorderPages);
router.put("/:id", legalController.updatePage);
router.delete("/:id", legalController.deletePage);

module.exports = router;
