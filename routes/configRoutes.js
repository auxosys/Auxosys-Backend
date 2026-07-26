const express = require("express");
const router = express.Router();
const configController = require("../controllers/configController");

router.get("/related-pages", configController.getRelatedPages);

module.exports = router;
