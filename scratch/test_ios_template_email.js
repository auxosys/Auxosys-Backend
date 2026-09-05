const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { sendEmail } = require('../services/brevoService');
const { getApplicationReceivedTemplate } = require('../utils/emailTemplates.js');

async function main() {
  const html = getApplicationReceivedTemplate({
    CandidateName: 'Pritam Das',
    JobTitle: 'Senior Full Stack Software Engineer',
    ApplicationID: 'APP-2026-0905-IOS',
    JobID: 'JOB-SFSE-001'
  });

  console.log('Sending iOS-fixed application received email via Brevo API...');
  const res = await sendEmail({
    senderName: 'Auxosys Careers',
    senderEmail: 'careers@auxosys.com',
    recipientEmail: 'dpritam2708@gmail.com',
    subject: 'Your Application Has Been Received - Senior Full Stack Software Engineer | Auxosys',
    htmlContent: html,
    provider: 'brevo',
    tags: ['automated', 'career']
  });

  console.log('Result:', res);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
