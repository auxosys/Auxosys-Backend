const express = require("express");
const router = express.Router();
const contactController = require("../controllers/contactController");

router.get("/", contactController.getAllMessages);
router.patch("/:id/status", contactController.updateStatus);
router.patch("/:id/star", contactController.updateStar);
router.delete("/:id", contactController.deleteMessage);

module.exports = router;
