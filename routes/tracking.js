/**
 * tracking.js
 * Express routes for Open & Click tracking.
 */

const express = require('express');
const { makeTrackingController } = require('../controllers/trackingController');

function makeTrackingRouter(supabase) {
  const router = express.Router();
  const controller = makeTrackingController(supabase);

  // Open tracking pixel
  router.get('/open/:logId.gif', controller.trackOpen);

  // Click tracking redirect
  router.get('/click/:logId', controller.trackClick);

  return router;
}

module.exports = makeTrackingRouter;
