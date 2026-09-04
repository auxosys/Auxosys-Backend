const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 10 }, // 20MB per file, matches typical SMTP attachment limits
});

module.exports = upload;
