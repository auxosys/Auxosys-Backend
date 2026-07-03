const express = require("express");
const router = express.Router();
const careerController = require("../controllers/careerController");

router.get("/", careerController.getAllCareers);
router.get("/admin", careerController.getAllCareers);
router.get("/:id", careerController.getCareerById);
router.post("/", careerController.createCareer);
router.put("/:id", careerController.updateCareer);
router.delete("/:id", careerController.deleteCareer);

router.post("/:id/apply", careerController.applyForJob);
router.get("/applications/all", careerController.getAllApplications);
router.get("/applicants/:jobId", careerController.getApplicantsByJobId);

module.exports = router;
