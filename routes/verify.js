const express = require('express');
const router = express.Router();
const { verifyCertificate, searchCertificates } = require('../controllers/verifyController');

// Deliberately NOT behind requireAdmin — this is the public verification API.
// If your app has a global rate-limiter, make sure it also covers this router;
// QR/verify endpoints are common scraping/abuse targets.
router.get('/search', searchCertificates);
router.get('/:id', verifyCertificate);

module.exports = router;
