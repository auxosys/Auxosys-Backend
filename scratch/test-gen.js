const { renderCertificatePdf } = require('../utils/certificateRenderer');
const fs = require('fs/promises');

async function test() {
  try {
    const pdfBuffer = await renderCertificatePdf({
      certificate_number: 'AUXCERT-TEST',
      recipient_name: 'Test Name',
      cert_type: 'internship',
      fields: { title: 'Test Title' },
      color_config: { type: 'solid', colors: ['#14B8A6'] },
      signatures: [{
        name: 'Sig 1',
        designation: 'CEO',
        image_url: 'https://grkeeulwpstjmqmmmjgo.supabase.co/storage/v1/object/public/signatures/sample.png'
      }],
      qr_code_url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
      issue_date: new Date().toISOString()
    });
    console.log('PDF generated successfully, length:', pdfBuffer.length);
    process.exit(0);
  } catch (err) {
    console.error('Error generating PDF:', err);
    process.exit(1);
  }
}

test();
