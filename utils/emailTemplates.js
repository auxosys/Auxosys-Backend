exports.getApplicationReceivedTemplate = (data) => {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Your Application Has Been Received | Auxosys</title>
<!--[if mso]>
<noscript>
<xml>
<o:OfficeDocumentSettings>
<o:PixelsPerInch>96</o:PixelsPerInch>
</o:OfficeDocumentSettings>
</xml>
</noscript>
<![endif]-->
<style>
  body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
  body { margin: 0; padding: 0; width: 100% !important; height: 100% !important; background-color: #F5F8F8; }
  a { color: #0FB5A6; }

  /* ── MOBILE ── */
  @media screen and (max-width: 600px) {
    .email-container { width: 100% !important; border-radius: 0 !important; }
    .fluid-padding { padding-left: 22px !important; padding-right: 22px !important; }
    .fluid-padding-sm { padding-left: 22px !important; padding-right: 22px !important; }
    .headline { font-size: 19px !important; }
    .stack-btn { display: block !important; width: 100% !important; }
    .stack-btn a { display: block !important; width: 100% !important; box-sizing: border-box !important; text-align: center !important; }
    .sig-card-inner { display: block !important; }
    .sig-icon-cell { display: block !important; width: 100% !important; padding-right: 0 !important; margin-bottom: 12px !important; }
    .sig-icon-cell table { margin: 0 auto !important; }
    .sig-text-cell { display: block !important; width: 100% !important; text-align: center !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; background-color:#F5F8F8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F5F8F8;">
    <tr>
      <td align="center" style="padding: 16px 12px;">

        <table role="presentation" class="email-container" width="850" cellpadding="0" cellspacing="0" border="0" style="width:100%; max-width:850px; background-color:#FFFFFF; border-radius:16px; overflow:hidden; border:1px solid #E7ECEC;">

          <!-- Header: logo lockup -->
          <tr>
            <td style="background-color:#0E1B21; padding: 26px 40px;" class="fluid-padding">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="left" valign="middle">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td valign="middle" style="padding-right:10px;">
                          <img src="https://auxosys.com/Auxosys-icon-mono-white.png" width="48" height="48" alt="Auxosys" style="display:block; width:48px; height:48px;">
                        </td>
                        <td valign="middle" style="font-size:19px; font-weight:800; color:#FFFFFF; letter-spacing:-0.02em; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                          AUXOSYS
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Status strip -->
          <tr>
            <td style="background-color:#0FB5A6; padding: 10px 40px;" class="fluid-padding">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-size:12px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:#FFFFFF; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                    Application Received
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 36px 40px;" class="fluid-padding">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">

                    <h1 class="headline" style="margin:0 0 20px; font-size:22px; font-weight:800; color:#0E1B21; letter-spacing:-0.01em;">
                      Thank you for applying!
                    </h1>

                    <p style="margin:0 0 16px; font-size:15px; line-height:1.7; color:#10201F;">
                      Dear ${data.CandidateName},
                    </p>

                    <p style="margin:0 0 16px; font-size:15px; line-height:1.7; color:#10201F;">
                      Thank you for applying for the <strong>${data.JobTitle}</strong> position at Auxosys. Your application has been successfully submitted and is now under review by our Talent Acquisition team.
                    </p>

                    <!-- Application details card -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F5F8F8; border:1px solid #E7ECEC; border-radius:12px; margin: 24px 0;">
                      <tr>
                        <td style="padding: 22px 26px;" class="fluid-padding-sm">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td colspan="2" style="padding-bottom:14px; font-size:11px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:#0C8074;">
                                Application Details
                              </td>
                            </tr>
                            <tr>
                              <td class="details-label" style="padding:8px 0; font-size:13px; color:#7C8A8F; width:44%;">Application ID</td>
                              <td class="details-value" style="padding:8px 0; font-size:14px; font-weight:700; color:#0E1B21; text-align:right;">${data.ApplicationID}</td>
                            </tr>
                            <tr>
                              <td class="details-label" style="padding:8px 0; font-size:13px; color:#7C8A8F; border-top:1px solid #E7ECEC;">Job ID</td>
                              <td class="details-value" style="padding:8px 0; font-size:14px; font-weight:600; color:#10201F; text-align:right; border-top:1px solid #E7ECEC;">${data.JobID}</td>
                            </tr>
                            <tr>
                              <td class="details-label" style="padding:8px 0; font-size:13px; color:#7C8A8F; border-top:1px solid #E7ECEC;">Position</td>
                              <td class="details-value" style="padding:8px 0; font-size:14px; font-weight:600; color:#10201F; text-align:right; border-top:1px solid #E7ECEC;">${data.JobTitle}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <p style="margin:0 0 16px; font-size:15px; line-height:1.7; color:#10201F;">
                      If your profile matches our requirements, we'll contact you regarding the next steps in the hiring process.
                    </p>

                    <p style="margin:0 0 26px; font-size:15px; line-height:1.7; color:#10201F;">
                      If you have any questions regarding your application, please contact us and mention your Application ID for faster assistance.
                    </p>

                    <!-- CTA button -->
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" class="stack-btn">
                      <tr>
                        <td style="border-radius:10px; background-color:#0FB5A6;">
                          <a href="mailto:careers@auxosys.com" style="display:inline-block; padding:13px 26px; font-size:14px; font-weight:700; color:#FFFFFF; text-decoration:none; border-radius:10px;">
                            Email Careers Team →
                          </a>
                        </td>
                      </tr>
                    </table>

                    <p style="margin:26px 0 0; font-size:15px; line-height:1.7; color:#10201F;">
                      Thank you for your interest in Auxosys. We appreciate the time you invested in applying and wish you the very best.
                    </p>

                    <p style="margin:22px 0 0; font-size:15px; line-height:1.7; color:#10201F;">
                      Best regards,<br>
                      <strong>Talent Acquisition Team</strong><br>
                      Auxosys
                    </p>

                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px;" class="fluid-padding">
              <div style="border-top:1px solid #E7ECEC;"></div>
            </td>
          </tr>

          <!-- Signature card: side-by-side on desktop, stacks on mobile via CSS -->
          <tr>
            <td style="padding: 28px 40px 8px;" class="fluid-padding">
              <table role="presentation" align="center" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F5F8F8; border:1px solid #E7ECEC; border-radius:14px;">
                <tr>
                  <td style="padding: 22px 24px;" class="fluid-padding-sm">
                    <table role="presentation" align="center" width="100%" cellpadding="0" cellspacing="0" border="0" class="sig-card-inner">
                      <tr>
                        <td class="sig-icon-cell" valign="middle" width="52" style="padding-right:16px;">
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:44px; height:44px; background-color:#0E1B21; border-radius:10px;">
                            <tr>
                              <td align="center" valign="middle" style="width:44px; height:44px;">
                                <img src="https://auxosys.com/Auxosys-icon-mono-white.png" width="22" height="22" alt="Auxosys" style="display:block; width:22px; height:22px;">
                              </td>
                            </tr>
                          </table>
                        </td>
                        <td class="sig-text-cell" valign="middle" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                          <div style="font-size:15px; font-weight:800; letter-spacing:0.02em; margin-bottom:4px;">
                            <a href="https://auxosys.com" style="color:#0E1B21; text-decoration:none;">AUXOSYS</a>
                          </div>
                          <div style="font-size:13px; color:#56656B;">
                            <span style="white-space:nowrap;">📧 <a href="mailto:careers@auxosys.com" style="color:#0FB5A6; text-decoration:none; font-weight:600;">careers@auxosys.com</a></span>
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Legal / disclaimer -->
          <tr>
            <td style="padding: 16px 40px 28px;" class="fluid-padding">
              <p style="margin:0; font-size:12px; line-height:1.7; color:#7C8A8F; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; text-align:center;">
                You're receiving this email because you applied for a role at Auxosys via our careers page.<br><br>
                Copyright &copy; 2026 Auxosys. All rights reserved.
              </p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>`;
};

exports.getApplicationRejectedTemplate = (data) => {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Update on Your Application | Auxosys</title>
<!--[if mso]>
<noscript>
<xml>
<o:OfficeDocumentSettings>
<o:PixelsPerInch>96</o:PixelsPerInch>
</o:OfficeDocumentSettings>
</xml>
</noscript>
<![endif]-->
<style>
  body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
  body { margin: 0; padding: 0; width: 100% !important; height: 100% !important; background-color: #F5F8F8; }
  a { color: #0FB5A6; }

  /* ── MOBILE ── */
  @media screen and (max-width: 600px) {
    .email-container { width: 100% !important; border-radius: 0 !important; }
    .fluid-padding { padding-left: 22px !important; padding-right: 22px !important; }
    .fluid-padding-sm { padding-left: 22px !important; padding-right: 22px !important; }
    .headline { font-size: 19px !important; }
    .stack-btn { display: block !important; width: 100% !important; }
    .stack-btn a { display: block !important; width: 100% !important; box-sizing: border-box !important; text-align: center !important; }
  }

  /* ── DESKTOP / WIDE WEBMAIL ── */
  @media screen and (min-width: 601px) {
    .email-container { width: 850px !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; background-color:#F5F8F8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">

  <span style="display:none; font-size:1px; color:#F5F8F8; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden;">
    An update on your application for ${data.JobTitle} at Auxosys.
  </span>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F5F8F8;">
    <tr>
      <td align="center" style="padding: 16px 12px;">

        <table role="presentation" class="email-container" width="850" cellpadding="0" cellspacing="0" border="0" style="width:100%; max-width:850px; background-color:#FFFFFF; border-radius:16px; overflow:hidden; border:1px solid #E7ECEC;">

          <!-- Header: logo lockup -->
          <tr>
            <td style="background-color:#0E1B21; padding: 26px 40px;" class="fluid-padding">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="left" valign="middle">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td valign="middle" style="padding-right:10px;">
                          <img src="https://auxosys.com/Auxosys-icon-mono-white.png" width="48" height="48" alt="Auxosys" style="display:block; width:48px; height:48px;">
                        </td>
                        <td valign="middle" style="font-size:19px; font-weight:800; color:#FFFFFF; letter-spacing:-0.02em; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                          AUXOSYS
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Status strip -->
          <tr>
            <td style="background-color:#14232A; padding: 10px 40px;" class="fluid-padding">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-size:12px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:#FFFFFF; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                    Application Update
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 36px 40px;" class="fluid-padding">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">

                    <h1 class="headline" style="margin:0 0 20px; font-size:22px; font-weight:800; color:#0E1B21; letter-spacing:-0.01em;">
                      Thank you for your interest in Auxosys
                    </h1>

                    <p style="margin:0 0 16px; font-size:15px; line-height:1.7; color:#10201F;">
                      Dear ${data.CandidateName},
                    </p>

                    <p style="margin:0 0 16px; font-size:15px; line-height:1.7; color:#10201F;">
                      Thank you for taking the time to apply for the <strong>${data.JobTitle}</strong> position at Auxosys.
                    </p>

                    <p style="margin:0 0 16px; font-size:15px; line-height:1.7; color:#10201F;">
                      After carefully reviewing your application, we have decided to move forward with other candidates whose qualifications and experience more closely match our current requirements.
                    </p>

                    <!-- Application details card -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F5F8F8; border:1px solid #E7ECEC; border-radius:12px; margin: 24px 0;">
                      <tr>
                        <td style="padding: 22px 26px;" class="fluid-padding-sm">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td colspan="2" style="padding-bottom:14px; font-size:11px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:#0C8074;">
                                Application Details
                              </td>
                            </tr>
                            <tr>
                              <td class="details-label" style="padding:8px 0; font-size:13px; color:#7C8A8F; width:44%;">Application ID</td>
                              <td class="details-value" style="padding:8px 0; font-size:14px; font-weight:700; color:#0E1B21; text-align:right;">${data.ApplicationID}</td>
                            </tr>
                            <tr>
                              <td class="details-label" style="padding:8px 0; font-size:13px; color:#7C8A8F; border-top:1px solid #E7ECEC;">Job ID</td>
                              <td class="details-value" style="padding:8px 0; font-size:14px; font-weight:600; color:#10201F; text-align:right; border-top:1px solid #E7ECEC;">${data.JobID}</td>
                            </tr>
                            <tr>
                              <td class="details-label" style="padding:8px 0; font-size:13px; color:#7C8A8F; border-top:1px solid #E7ECEC;">Position</td>
                              <td class="details-value" style="padding:8px 0; font-size:14px; font-weight:600; color:#10201F; text-align:right; border-top:1px solid #E7ECEC;">${data.JobTitle}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <p style="margin:0 0 16px; font-size:15px; line-height:1.7; color:#10201F;">
                      This decision does not reflect your overall abilities or potential. We were impressed by your interest in Auxosys and encourage you to apply for future opportunities that align with your skills and experience.
                    </p>

                    <p style="margin:0 0 16px; font-size:15px; line-height:1.7; color:#10201F;">
                      We will keep your profile in our talent database and may contact you if a suitable role becomes available.
                    </p>

                    <p style="margin:0 0 26px; font-size:15px; line-height:1.7; color:#10201F;">
                      We sincerely appreciate the time and effort you invested in the application process and wish you every success in your future career. Thank you for considering Auxosys as part of your professional journey.
                    </p>

                    <!-- Secondary CTA -->
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" class="stack-btn">
                      <tr>
                        <td style="border-radius:10px; border:1px solid #D8E0E0;">
                          <a href="https://auxosys.com/careers" style="display:inline-block; padding:12px 24px; font-size:14px; font-weight:700; color:#0E1B21; text-decoration:none; border-radius:10px;">
                            View Open Roles →
                          </a>
                        </td>
                      </tr>
                    </table>

                    <p style="margin:26px 0 0; font-size:15px; line-height:1.7; color:#10201F;">
                      Best regards,<br>
                      <strong>Talent Acquisition Team</strong><br>
                      Auxosys
                    </p>

                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px;" class="fluid-padding">
              <div style="border-top:1px solid #E7ECEC;"></div>
            </td>
          </tr>

          <!-- Signature card: side-by-side on desktop, stacks on mobile via CSS -->
          <tr>
            <td style="padding: 28px 40px 8px;" class="fluid-padding">
              <table role="presentation" align="center" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F5F8F8; border:1px solid #E7ECEC; border-radius:14px;">
                <tr>
                  <td style="padding: 22px 24px;" class="fluid-padding-sm">
                    <table role="presentation" align="center" width="100%" cellpadding="0" cellspacing="0" border="0" class="sig-card-inner">
                      <tr>
                        <td class="sig-icon-cell" valign="middle" width="52" style="padding-right:16px;">
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:44px; height:44px; background-color:#0E1B21; border-radius:10px;">
                            <tr>
                              <td align="center" valign="middle" style="width:44px; height:44px;">
                                <img src="https://auxosys.com/Auxosys-icon-mono-white.png" width="22" height="22" alt="Auxosys" style="display:block; width:22px; height:22px;">
                              </td>
                            </tr>
                          </table>
                        </td>
                        <td class="sig-text-cell" valign="middle" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                          <div style="font-size:15px; font-weight:800; letter-spacing:0.02em; margin-bottom:4px;">
                            <a href="https://auxosys.com" style="color:#0E1B21; text-decoration:none;">AUXOSYS</a>
                          </div>
                          <div style="font-size:13px; color:#56656B;">
                            <span style="white-space:nowrap;">📧 <a href="mailto:careers@auxosys.com" style="color:#0FB5A6; text-decoration:none; font-weight:600;">careers@auxosys.com</a></span>
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Legal / disclaimer -->
          <tr>
            <td style="padding: 16px 40px 28px;" class="fluid-padding">
              <p style="margin:0; font-size:12px; line-height:1.7; color:#7C8A8F; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; text-align:center;">
                You're receiving this email because you applied for a role at Auxosys via our careers page.<br><br>
                Copyright &copy; 2026 Auxosys. All rights reserved.
              </p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>`;
};
exports.getAdminNotificationTemplate = (data) => {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>New Job Application</title>
</head>
<body style="font-family: Arial, sans-serif; background-color: #F5F8F8; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px;">
    <h2>New Job Application Received</h2>
    <p><strong>Applicant:</strong> ${data.firstName} ${data.lastName}</p>
    <p><strong>Email:</strong> ${data.email}</p>
    <p><strong>Phone:</strong> ${data.phone || 'N/A'}</p>
    <p><strong>Role Applied For:</strong> ${data.appliedRole || 'N/A'}</p>
    <br />
    <p>Please check the <a href="https://admin.auxosys.com">admin panel</a> to view their application, resume, and cover letter.</p>
  </div>
</body>
</html>`;
};

exports.getCertificateEmailTemplate = (certData) => {
  const { recipient_name, cert_type, issued_at, certificate_number, pdf_url } = certData;
  const issueDate = new Date(issued_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const verifyLink = `https://verify.auxosys.com/${certData.id}`;

  let title, message;
  const typeLower = cert_type.toLowerCase();
  
  if (typeLower.includes('appreciation')) {
    title = 'Your Certificate of Appreciation';
    message = `We want to extend our sincerest gratitude for your valuable contributions. Please find attached your official Certificate of Appreciation. This certificate serves as a token of our recognition for your outstanding efforts.`;
  } else if (typeLower.includes('completion')) {
    title = 'Your Certificate of Completion';
    message = `Congratulations on successfully completing your program! Please find attached your official Certificate of Completion. We commend you on your dedication and hard work.`;
  } else if (typeLower.includes('internship')) {
    title = 'Your Certificate of Internship';
    message = `Congratulations on successfully completing your internship with us! Please find attached your official Certificate of Internship. We appreciate all your hard work and wish you the best in your future endeavors.`;
  } else if (typeLower.includes('experience')) {
    title = 'Your Experience Letter';
    message = `Please find attached your official Experience Letter from Auxosys. We appreciate your time and contributions during your tenure with us.`;
  } else {
    title = `Your Certificate (${cert_type})`;
    message = `Please find attached your official ${cert_type} certificate from Auxosys.`;
  }

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>${title} | Auxosys</title>
<style>
  body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
  body { margin: 0; padding: 0; width: 100% !important; height: 100% !important; background-color: #F5F8F8; }
  a { color: #0FB5A6; }
  
  @media screen and (max-width: 600px) {
    .email-container { width: 100% !important; border-radius: 0 !important; }
    .fluid-padding { padding-left: 22px !important; padding-right: 22px !important; }
    .headline { font-size: 19px !important; }
    .stack-btn { display: block !important; width: 100% !important; }
    .stack-btn a { display: block !important; width: 100% !important; box-sizing: border-box !important; text-align: center !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; background-color:#F5F8F8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F5F8F8;">
    <tr>
      <td align="center" style="padding: 16px 12px;">
        <table role="presentation" class="email-container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%; max-width:600px; background-color:#FFFFFF; border-radius:16px; overflow:hidden; border:1px solid #E7ECEC;">
          
          <!-- Header -->
          <tr>
            <td style="background-color:#0E1B21; padding: 26px 40px;" class="fluid-padding">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="left" valign="middle">
                    <img src="https://res.cloudinary.com/dztz0pufh/image/upload/v1740924151/l9n6szq1z5gftv1h1wob.png" alt="Auxosys Logo" width="130" style="display:block; font-family:sans-serif; color:#FFFFFF; font-size:18px; font-weight:bold;">
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 40px 40px 20px 40px;" class="fluid-padding">
              <h1 class="headline" style="margin:0 0 16px 0; font-size:24px; color:#0E1B21; font-weight:700; letter-spacing:-0.4px;">
                Hi ${recipient_name},
              </h1>
              <p style="margin:0 0 20px 0; font-size:15px; color:#4B5563; line-height:1.6;">
                ${message}
              </p>
              
              <!-- Certificate Details Card -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 24px; background-color:#F8FAFC; border:1px solid #E2E8F0; border-radius:12px;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin:0 0 8px 0; font-size:13px; color:#64748B;">Certificate Details</p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="35%" style="padding: 6px 0; font-size:14px; color:#475569; font-weight:500;">Type:</td>
                        <td width="65%" style="padding: 6px 0; font-size:14px; color:#0F172A; font-weight:600;">${cert_type}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; font-size:14px; color:#475569; font-weight:500;">Issued Date:</td>
                        <td style="padding: 6px 0; font-size:14px; color:#0F172A; font-weight:600;">${issueDate}</td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; font-size:14px; color:#475569; font-weight:500;">Certificate No:</td>
                        <td style="padding: 6px 0; font-size:14px; color:#0F172A; font-weight:600;">${certificate_number}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Button -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
                <tr>
                  <td align="left" class="stack-btn">
                    <a href="${pdf_url}" target="_blank" style="display:inline-block; padding:14px 28px; background-color:#0FB5A6; color:#FFFFFF; text-decoration:none; border-radius:8px; font-weight:600; font-size:15px; letter-spacing:0.3px; transition: background-color 0.2s ease;">Download Certificate PDF</a>
                  </td>
                </tr>
                <tr>
                  <td align="left" class="stack-btn" style="padding-top: 10px;">
                    <a href="${verifyLink}" target="_blank" style="display:inline-block; padding:14px 28px; background-color:#F1F5F9; color:#0F172A; text-decoration:none; border-radius:8px; font-weight:600; font-size:15px; letter-spacing:0.3px; border: 1px solid #E2E8F0;">Verify Online</a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 16px 0; font-size:14px; color:#64748B; line-height:1.5;">
                We have also attached a physical copy of the PDF to this email for your records.
              </p>
              
              <p style="margin:0; font-size:14px; color:#64748B; line-height:1.5;">
                Best regards,<br>
                <strong>The Auxosys Team</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#F9FAFB; border-top:1px solid #E5E7EB; padding: 24px 40px;" class="fluid-padding">
              <p style="margin:0 0 8px 0; font-size:12px; color:#9CA3AF; text-align:center;">
                © ${new Date().getFullYear()} Auxosys. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};
