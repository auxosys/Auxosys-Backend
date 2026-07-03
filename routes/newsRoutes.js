const express = require("express");
const router = express.Router();
const newsController = require("../controllers/newsController");

router.get("/", newsController.getAllNews);
router.get("/admin/all", newsController.getAllNews);
router.get("/:slug", newsController.getNewsBySlug);
router.post("/", newsController.createNews);
router.put("/:id", newsController.updateNews);
router.delete("/:id", newsController.deleteNews);

module.exports = router;
