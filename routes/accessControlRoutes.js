const express = require("express");
const router = express.Router();
const accessControlController = require("../controllers/accessControlController");

router.get("/", accessControlController.getAllRoles);
router.post("/", accessControlController.createRole);
router.put("/:id", accessControlController.updateRole);
router.delete("/:id", accessControlController.deleteRole);

module.exports = router;
