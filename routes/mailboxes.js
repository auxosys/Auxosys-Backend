const express = require('express');
const router = express.Router();
const requireAdmin = require('../middleware/requireAdmin');
const {
  listMailboxes,
  startGoogleOAuth,
  googleOAuthCallback,
  connectWithAppPassword,
  disconnectMailbox,
  getFolders,
} = require('../controllers/mailboxController');

// OAuth endpoints: the browser navigates here directly (redirect flow),
// so these can't require an Authorization header the way API calls do.
// Protect them instead by only allowing them when the admin is already
// logged into the admin panel session (adjust to however your panel's
// session/cookie auth works) — do not leave this fully open.
router.get('/oauth/start', startGoogleOAuth);
router.get('/oauth/callback', googleOAuthCallback);

router.use(requireAdmin);

router.get('/', listMailboxes);
router.post('/connect-app-password', connectWithAppPassword);
router.delete('/:id', disconnectMailbox);
router.get('/:id/folders', getFolders);

module.exports = router;
