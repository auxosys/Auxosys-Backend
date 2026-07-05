const express = require("express");
const router = express.Router();
const careerController = require("../controllers/careerController");

router.get("/", careerController.getAllCareers);
router.get("/admin", careerController.getAllCareers);
router.get("/:id", careerController.getCareerById);
router.post("/", careerController.createCareer);
router.put("/:id", careerController.updateCareer);
router.patch("/:id/toggle", careerController.toggleJobStatus);
router.delete("/:id", careerController.deleteCareer);

const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });

router.post("/:id/apply", upload.fields([{ name: "resume", maxCount: 1 }, { name: "coverLetter", maxCount: 1 }]), careerController.applyForJob);
router.get("/applications/all", careerController.getAllApplications);
router.get("/applicants/:jobId", careerController.getApplicantsByJobId);
router.patch("/applicants/:id/status", careerController.updateApplicationStatus);

module.exports = router;
