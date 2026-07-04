const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");

router.post("/login", authController.login);
router.post("/logout", authController.logout);
// The admin panel checks /profile/me
router.get("/me", authController.getProfile);

module.exports = router;
