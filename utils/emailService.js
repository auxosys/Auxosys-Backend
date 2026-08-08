const https = require('https');
const templates = require("./emailTemplates");

const SYSTEM_SENDER = process.env.SYSTEM_SENDER_EMAIL || "noreply@auxosys.com";
const CAREERS_SENDER = process.env.CAREERS_SENDER_EMAIL || "careers@auxosys.com";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL_ADDRESS || "admin@auxosys.com";

// Helper function to send email via Brevo HTTP API
function sendBrevoEmail(payload) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) {
      console.warn("BREVO_API_KEY is not set. Cannot send email.");
      return resolve(false);
    }

    const payloadString = JSON.stringify(payload);
    const options = {
      hostname: 'api.brevo.com',
      port: 443,
      path: '/v3/smtp/email',
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(payloadString)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(true);
        } else {
          console.error("Brevo API Error:", res.statusCode, data);
          resolve(false);
        }
      });
    });

    req.on('error', (e) => {
      console.error("Brevo API Request Error:", e.message);
      resolve(false);
    });
    
    req.write(payloadString);
    req.end();
  });
}

exports.sendContactNotificationToAdmin = async (contactData) => {
  try {
    const { name, email, phone, subject, message } = contactData;
    
    const payload = {
      sender: { email: SYSTEM_SENDER, name: "Auxosys System" },
      to: [{ email: ADMIN_EMAIL }],
      subject: `New Contact Form Submission: ${subject}`,
      htmlContent: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone || "N/A"}</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <p><strong>Message:</strong></p>
        <p>${message}</p>
      `
    };

    const success = await sendBrevoEmail(payload);
    if (success) {
      console.log(`Contact notification sent for ${email}`);
    } else {
      console.error(`Failed to send contact notification for ${email}`);
    }
    return success;
  } catch (error) {
    console.error("Error sending contact email:", error);
    return false;
  }
};

exports.sendJobApplicationNotificationToAdmin = async (applicationData) => {
  try {
    const { firstName, lastName, email, phone, appliedRole } = applicationData;
    
    const payload = {
      sender: { email: CAREERS_SENDER, name: "Auxosys Careers" },
      to: [{ email: ADMIN_EMAIL }],
      subject: `New Job Application: ${applicationData.first_name} ${applicationData.last_name}`,
      htmlContent: templates.getAdminNotificationTemplate(applicationData)
    };

    const success = await sendBrevoEmail(payload);
    if (success) {
      console.log(`Admin application notification sent for ${applicationData.email}`);
    } else {
      console.error(`Failed to send admin application notification for ${applicationData.email}`);
    }
    return success;
  } catch (error) {
    console.error("Error sending job application email:", error);
    return false;
  }
};

exports.sendApplicationReceivedEmailToCandidate = async (candidateData) => {
  try {
    const htmlContent = templates.getApplicationReceivedTemplate(candidateData);
    const payload = {
      sender: { email: CAREERS_SENDER, name: "Auxosys Careers" },
      to: [{ email: candidateData.CandidateEmail }],
      subject: `Application Received – ${candidateData.JobTitle || 'Open Position'} | Auxosys`,
      htmlContent: htmlContent
    };

    const success = await sendBrevoEmail(payload);
    if (success) {
      console.log(`Candidate confirmation sent to ${candidateData.CandidateEmail}`);
    } else {
      console.error(`Failed to send candidate confirmation to ${candidateData.CandidateEmail}`);
    }
    return success;
  } catch (error) {
    console.error("Error sending candidate received email:", error);
    return false;
  }
};

exports.sendApplicationRejectedEmailToCandidate = async (candidateData) => {
  try {
    const htmlContent = templates.getApplicationRejectedTemplate(candidateData);
    const payload = {
      sender: { email: CAREERS_SENDER, name: "Auxosys Careers" },
      to: [{ email: candidateData.CandidateEmail }],
      subject: `Update on your application at Auxosys`,
      htmlContent: htmlContent
    };

    const success = await sendBrevoEmail(payload);
    if (success) {
      console.log(`Candidate rejected email sent to ${candidateData.CandidateEmail}`);
    } else {
      console.error(`Failed to send candidate rejected email to ${candidateData.CandidateEmail}`);
    }
    return success;
  } catch (error) {
    console.error("Error sending candidate rejected email:", error);
    return false;
  }
};

exports.sendCertificateEmailToRecipient = async (certData) => {
  try {
    const htmlContent = templates.getCertificateEmailTemplate(certData);
    
    let pdfBuffer;
    if (certData.pdf_url) {
      try {
        pdfBuffer = await new Promise((resolve, reject) => {
          const req = https.get(certData.pdf_url, (res) => {
            if (res.statusCode !== 200) {
              return reject(new Error(`Status: ${res.statusCode}`));
            }
            const data = [];
            res.on('data', chunk => data.push(chunk));
            res.on('end', () => resolve(Buffer.concat(data)));
          });
          req.on('error', reject);
          req.on('timeout', () => {
            req.destroy();
            reject(new Error('Timeout'));
          });
          req.setTimeout(10000);
        });
      } catch (err) {
        console.error("Error downloading PDF for attachment:", err);
      }
    }

    const payload = {
      sender: { email: SYSTEM_SENDER, name: "Auxosys Certificates" },
      to: [{ email: certData.recipient_email }],
      subject: `Your ${certData.cert_type} Certificate | Auxosys`,
      htmlContent: htmlContent
    };

    if (pdfBuffer) {
      payload.attachment = [
        {
          content: pdfBuffer.toString('base64'),
          name: `${certData.certificate_number}.pdf`
        }
      ];
    }

    const success = await sendBrevoEmail(payload);
    if (success) {
      console.log(`Certificate email sent to ${certData.recipient_email}`);
    } else {
      console.error(`Failed to send certificate email to ${certData.recipient_email}`);
    }
    return success;
  } catch (error) {
    console.error("Error sending certificate email:", error);
    return false;
  }
};
