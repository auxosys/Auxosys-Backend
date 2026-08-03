const nodemailer = require("nodemailer");

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

const SENDER = process.env.SYSTEM_SENDER_EMAIL || "noreply@auxosys.com";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL_ADDRESS || "admin@auxosys.com";

exports.sendContactNotificationToAdmin = async (contactData) => {
  try {
    const { name, email, phone, subject, message } = contactData;
    
    const mailOptions = {
      from: `"Auxosys System" <${SENDER}>`,
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
      from: `"Talent Acquisition Auxosys" <${SENDER}>`,
      to: ADMIN_EMAIL,
      subject: `New Job Application: ${firstName} ${lastName} for ${appliedRole || 'Open Position'}`,
      html: `
        <h2>New Job Application Received</h2>
        <p><strong>Applicant:</strong> ${firstName} ${lastName}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone || 'N/A'}</p>
        <p><strong>Role Applied For:</strong> ${appliedRole || 'N/A'}</p>
        <br />
        <p>Please check the admin panel to view their resume and cover letter.</p>
      `,
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
      from: `"Talent Acquisition Auxosys" <${SENDER}>`,
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
      from: `"Talent Acquisition Auxosys" <${SENDER}>`,
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
