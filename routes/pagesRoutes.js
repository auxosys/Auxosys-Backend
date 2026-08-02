const express = require("express");
const router = express.Router();
const pagesController = require("../controllers/pagesController");

// Public API
router.get("/public/list", pagesController.getAllPages);
router.get("/public/:slug", pagesController.getPageBySlug);

// Admin Protected API (assuming requires auth middleware in server.js)
router.get("/", pagesController.getAllPages);
router.post("/", pagesController.createPage);
router.put("/:id", pagesController.updatePage);
router.delete("/:id", pagesController.deletePage);

module.exports = router;
