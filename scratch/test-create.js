const { generateAndStoreQr } = require('../utils/qrService');
const { renderCertificatePdf } = require('../utils/certificateRenderer');
const { uploadToStorage } = require('../utils/supabaseClient');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
require('dotenv').config({ path: '../.env' });

async function test() {
  try {
    const id = uuidv4();
    const verification_token = crypto.randomBytes(24).toString('hex');
    const certificate_number = `AUXCERT-TEST-9999`;

    console.log('Generating QR code...');
    const { url: qr_code_url, publicVerifyUrl } = await generateAndStoreQr(id, verification_token);

    console.log('Rendering PDF...');
    const pdfBuffer = await renderCertificatePdf({
      certificate_number,
      recipient_name: 'Test Name',
      cert_type: 'internship',
      fields: { title: 'Test Title' },
      color_config: { type: 'solid', colors: ['#14B8A6'] },
      signatures: [],
      qr_code_url,
      issue_date: new Date().toISOString(),
    });

    console.log('PDF Rendered. Uploading to storage...');
    const pdf_url = await uploadToStorage(`pdfs/${id}.pdf`, pdfBuffer, 'application/pdf');
    console.log('Done! pdf_url:', pdf_url);
    
    process.exit(0);
  } catch (err) {
    console.error('Test Failed:', err);
    process.exit(1);
  }
}

test();
