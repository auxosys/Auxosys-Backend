const express = require('express');
const router = express.Router();
const { requirePermission } = require('../middleware/rbacMiddleware');
const {
  createCertificate,
  previewCertificate,
  listCertificates,
  getCertificate,
  revokeCertificate,
  downloadCertificate,
  sendCertificateEmail,
  updateCertificate,
} = require('../controllers/certificateController');

// Public route for downloading PDFs
router.get('/:id/download', downloadCertificate);

router.use(requirePermission);

router.get('/', listCertificates);
router.post('/', createCertificate);
router.post('/preview', previewCertificate);
router.get('/:id', getCertificate);
router.put('/:id', updateCertificate);
router.post('/:id/revoke', revokeCertificate);
router.post('/:id/send-email', sendCertificateEmail);

module.exports = router;
