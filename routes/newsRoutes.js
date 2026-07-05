const express = require("express");
const router = express.Router();
const newsController = require("../controllers/newsController");
const multer = require("multer");
const upload = multer({ dest: "uploads/" });

router.get("/", newsController.getAllNews);
router.get("/admin/all", newsController.getAllNews);
router.get("/admin/:slug", newsController.getNewsBySlug);
router.get("/:slug", newsController.getNewsBySlug);
router.post("/", upload.single("featuredImage"), newsController.createNews);
router.put("/:id", upload.single("featuredImage"), newsController.updateNews);
router.delete("/:id", newsController.deleteNews);

module.exports = router;
