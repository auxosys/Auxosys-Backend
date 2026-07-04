const express = require("express");
const router = express.Router();
const settingsController = require("../controllers/settingsController");

router.get("/", settingsController.getSettings);
router.patch("/change-password", settingsController.changePassword);
router.patch("/:id", settingsController.updateSettings);

module.exports = router;
