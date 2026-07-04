const express = require("express");
const router = express.Router();
const subscriptionController = require("../controllers/subscriptionController");

router.get("/", subscriptionController.getAllSubscriptions);
router.patch("/:id/status", subscriptionController.updateStatus);
router.delete("/:id", subscriptionController.deleteSubscription);

module.exports = router;
