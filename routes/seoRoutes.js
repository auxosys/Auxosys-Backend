const express = require("express");
const router = express.Router();
const seoController = require("../controllers/seoController");
const multer = require("multer");

const upload = multer({ dest: "uploads/" });

router.get("/", seoController.getGlobalSeo);
router.patch("/", seoController.updateGlobalSeo);
router.post("/og-image", upload.single("image"), seoController.uploadOgImage);
router.post("/org-logo", upload.single("image"), seoController.uploadOrgLogo);

module.exports = router;
