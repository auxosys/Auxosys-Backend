const express = require('express');
const router = express.Router();
const requireAdmin = require('../middleware/requireAdmin');
const upload = require('../middleware/upload');

const {
  listMessages, syncFolder, getMessage, updateMessageFlags, moveMessage,
} = require('../controllers/messageController');
const { send } = require('../controllers/composeController');
const { downloadAttachment } = require('../controllers/attachmentController');

router.use(requireAdmin);

router.get('/:mailboxId/messages', listMessages);
router.post('/:mailboxId/sync', syncFolder);
router.get('/:mailboxId/messages/:messageId', getMessage);
router.patch('/:mailboxId/messages/:messageId', updateMessageFlags);
router.post('/:mailboxId/messages/:messageId/move', moveMessage);
router.get('/:mailboxId/messages/:messageId/attachments/:attachmentId', downloadAttachment);

router.post('/:mailboxId/send', upload.array('attachments'), send);

module.exports = router;
