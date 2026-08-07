const express = require('express');
const router = express.Router();
const upload = require('../middleware/uploadCert');
const { requirePermission } = require('../middleware/rbacMiddleware');
const {
  uploadSignature,
  reprocessSignature,
  listSignatures,
  deleteSignature,
} = require('../controllers/signatureController');

router.use(requirePermission);

router.get('/', listSignatures);
router.post('/', upload.single('file'), uploadSignature);
router.post('/:id/reprocess', reprocessSignature);
router.delete('/:id', deleteSignature);

module.exports = router;

/**
 * NOTE: `requireAdmin` is a placeholder middleware — swap the import
 * above for whatever your existing Auxosys-Backend admin-auth
 * middleware is actually called (you already have one, since the
 * rest of the admin panel is protected). A minimal stand-in is
 * included at src/middleware/requireAdmin.js so this module runs
 * out of the box; replace, don't stack both.
 */
