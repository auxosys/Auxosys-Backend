const nodemailer = require("nodemailer");
const https = require('https');

// Create the transport using Brevo SMTP
const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.BREVO_SMTP_USER,
    pass: process.env.BREVO_SMTP_PASS,
  },
});

const SYSTEM_SENDER = process.env.SYSTEM_SENDER_EMAIL || "noreply@auxosys.com";
const CAREERS_SENDER = process.env.CAREERS_SENDER_EMAIL || "careers@auxosys.com";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL_ADDRESS || "admin@auxosys.com";

exports.sendContactNotificationToAdmin = async (contactData) => {
  try {
    const { name, email, phone, subject, message } = contactData;
    
    const mailOptions = {
      from: `"Auxosys System" <${SYSTEM_SENDER}>`,
      to: ADMIN_EMAIL,
      subject: `New Contact Form Submission: ${subject}`,
      html: `
        <h2>New Message Received</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone || 'N/A'}</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <hr />
        <p><strong>Message:</strong></p>
        <p>${message.replace(/\\n/g, '<br/>')}</p>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Contact email sent: %s", info.messageId);
    return true;
  } catch (error) {
    console.error("Error sending contact email:", error);
    return false;
  }
};

exports.sendJobApplicationNotificationToAdmin = async (applicationData) => {
  try {
    const { firstName, lastName, email, phone, appliedRole } = applicationData;
    
    const mailOptions = {
      from: `"Talent Acquisition Auxosys" <${CAREERS_SENDER}>`,
      to: ADMIN_EMAIL,
      subject: `New Job Application: ${firstName} ${lastName} for ${appliedRole || 'Open Position'}`,
      html: templates.getAdminNotificationTemplate(applicationData),
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Job application email sent: %s", info.messageId);
    return true;
  } catch (error) {
    console.error("Error sending job application email:", error);
    return false;
  }
};

const templates = require("./emailTemplates");

exports.sendApplicationReceivedEmailToCandidate = async (candidateData) => {
  try {
    const htmlContent = templates.getApplicationReceivedTemplate(candidateData);
    const mailOptions = {
      from: `"Talent Acquisition Auxosys" <${CAREERS_SENDER}>`,
      to: candidateData.CandidateEmail,
      subject: `Application Received – ${candidateData.JobTitle} | Auxosys`,
      html: htmlContent,
    };
    const info = await transporter.sendMail(mailOptions);
    console.log("Candidate received email sent: %s", info.messageId);
    return true;
  } catch (error) {
    console.error("Error sending candidate received email:", error);
    return false;
  }
};

exports.sendApplicationRejectedEmailToCandidate = async (candidateData) => {
  try {
    const htmlContent = templates.getApplicationRejectedTemplate(candidateData);
    const mailOptions = {
      from: `"Talent Acquisition Auxosys" <${CAREERS_SENDER}>`,
      to: candidateData.CandidateEmail,
      subject: `Update on Your Application | Auxosys`,
      html: htmlContent,
    };
    const info = await transporter.sendMail(mailOptions);
    console.log("Candidate rejected email sent: %s", info.messageId);
    return true;
  } catch (error) {
    console.error("Error sending candidate rejected email:", error);
    return false;
  }
};

exports.sendCertificateEmailToRecipient = async (certData) => {
  try {
    const htmlContent = templates.getCertificateEmailTemplate(certData);
    
    // Download the PDF into a buffer to attach it
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
          req.setTimeout(10000); // 10s timeout
        });
      } catch (err) {
        console.error("Error downloading PDF for attachment:", err);
      }
    }

    const mailOptions = {
      from: `"Auxosys Certificates" <${SYSTEM_SENDER}>`,
      to: certData.recipient_email,
      subject: `Your ${certData.cert_type} Certificate | Auxosys`,
      html: htmlContent,
    };

    if (pdfBuffer) {
      mailOptions.attachments = [
        {
          filename: `${certData.certificate_number || 'certificate'}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ];
    }

    const info = await transporter.sendMail(mailOptions);
    console.log("Certificate email sent: %s", info.messageId);
    return true;
  } catch (error) {
    console.error("Error sending certificate email:", error);
    return false;
  }
};
