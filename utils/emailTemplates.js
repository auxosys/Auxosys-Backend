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
  @media screen and (max-width: 600px) {
    .email-container { width: 100% !important; }
    .fluid-padding { padding-left: 20px !important; padding-right: 20px !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; background-color:#F5F8F8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">

  <span style="display:none; font-size:1px; color:#F5F8F8; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden;">
    Your application for ${data.JobTitle} at Auxosys has been received and is under review.
  </span>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F5F8F8;">
    <tr>
      <td align="center" style="padding: 40px 16px;">

        <table role="presentation" class="email-container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px; background-color:#FFFFFF; border-radius:16px; overflow:hidden; border:1px solid #E7ECEC;">

          <!-- Header -->
          <tr>
            <td style="background-color:#0E1B21; padding: 28px 40px;" class="fluid-padding">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="left" style="font-size:20px; font-weight:800; color:#FFFFFF; letter-spacing:-0.02em; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                    AUXOSYS
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
            <td style="padding: 40px;" class="fluid-padding">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">

                    <h1 style="margin:0 0 20px; font-size:22px; font-weight:800; color:#0E1B21; letter-spacing:-0.01em;">
                      Thank you for applying!
                    </h1>

                    <p style="margin:0 0 16px; font-size:15px; line-height:1.7; color:#10201F;">
                      Dear ${data.CandidateName},
                    </p>

                    <p style="margin:0 0 16px; font-size:15px; line-height:1.7; color:#10201F;">
                      Thank you for applying for the <strong>${data.JobTitle}</strong> position at Auxosys. Your application has been successfully submitted and is now under review by our Talent Acquisition team.
                    </p>

                    <!-- Application details card -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F5F8F8; border:1px solid #E7ECEC; border-radius:12px; margin: 28px 0;">
                      <tr>
                        <td style="padding: 24px 28px;">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td colspan="2" style="padding-bottom:14px; font-size:11px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:#0C8074;">
                                Application Details
                              </td>
                            </tr>
                            <tr>
                              <td style="padding:8px 0; font-size:13px; color:#7C8A8F; width:44%;">Application ID</td>
                              <td style="padding:8px 0; font-size:14px; font-weight:700; color:#0E1B21; text-align:right;">${data.ApplicationID}</td>
                            </tr>
                            <tr>
                              <td style="padding:8px 0; font-size:13px; color:#7C8A8F; border-top:1px solid #E7ECEC;">Job ID</td>
                              <td style="padding:8px 0; font-size:14px; font-weight:600; color:#10201F; text-align:right; border-top:1px solid #E7ECEC;">${data.JobID}</td>
                            </tr>
                            <tr>
                              <td style="padding:8px 0; font-size:13px; color:#7C8A8F; border-top:1px solid #E7ECEC;">Position</td>
                              <td style="padding:8px 0; font-size:14px; font-weight:600; color:#10201F; text-align:right; border-top:1px solid #E7ECEC;">${data.JobTitle}</td>
                            </tr>
                            <tr>
                              <td style="padding:8px 0; font-size:13px; color:#7C8A8F; border-top:1px solid #E7ECEC;">Department</td>
                              <td style="padding:8px 0; font-size:14px; font-weight:600; color:#10201F; text-align:right; border-top:1px solid #E7ECEC;">${data.Department}</td>
                            </tr>
                            <tr>
                              <td style="padding:8px 0; font-size:13px; color:#7C8A8F; border-top:1px solid #E7ECEC;">Submitted On</td>
                              <td style="padding:8px 0; font-size:14px; font-weight:600; color:#10201F; text-align:right; border-top:1px solid #E7ECEC;">${data.ApplicationDate}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <p style="margin:0 0 16px; font-size:15px; line-height:1.7; color:#10201F;">
                      If your profile matches our requirements, we'll contact you regarding the next steps in the hiring process.
                    </p>

                    <p style="margin:0 0 28px; font-size:15px; line-height:1.7; color:#10201F;">
                      If you have any questions regarding your application, please contact us and mention your Application ID for faster assistance.
                    </p>

                    <!-- CTA button -->
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="border-radius:10px; background-color:#0FB5A6;">
                          <a href="mailto:careers@auxosys.com" style="display:inline-block; padding:13px 26px; font-size:14px; font-weight:700; color:#FFFFFF; text-decoration:none; border-radius:10px;">
                            Email Careers Team →
                          </a>
                        </td>
                      </tr>
                    </table>

                    <p style="margin:28px 0 0; font-size:15px; line-height:1.7; color:#10201F;">
                      Thank you for your interest in Auxosys. We appreciate the time you invested in applying and wish you the very best.
                    </p>

                    <p style="margin:24px 0 0; font-size:15px; line-height:1.7; color:#10201F;">
                      Best regards,<br>
                      <strong>Talent Acquisition Team</strong><br>
                      Auxosys
                    </p>

                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#F5F8F8; border-top:1px solid #E7ECEC; padding: 28px 40px;" class="fluid-padding">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:13px; line-height:1.8; color:#56656B;">
                    <strong style="color:#0E1B21;">Auxosys</strong><br>
                    🌐 <a href="https://auxosys.com" style="color:#0FB5A6; text-decoration:none;">auxosys.com</a><br>
                    📧 <a href="mailto:careers@auxosys.com" style="color:#0FB5A6; text-decoration:none;">careers@auxosys.com</a>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top:18px; font-size:12px; color:#7C8A8F; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                    You're receiving this email because you applied for a role at Auxosys via our careers page.
                  </td>
                </tr>
              </table>
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
  @media screen and (max-width: 600px) {
    .email-container { width: 100% !important; }
    .fluid-padding { padding-left: 20px !important; padding-right: 20px !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; background-color:#F5F8F8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">

  <span style="display:none; font-size:1px; color:#F5F8F8; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden;">
    An update on your application for ${data.JobTitle} at Auxosys.
  </span>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F5F8F8;">
    <tr>
      <td align="center" style="padding: 40px 16px;">

        <table role="presentation" class="email-container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px; background-color:#FFFFFF; border-radius:16px; overflow:hidden; border:1px solid #E7ECEC;">

          <!-- Header -->
          <tr>
            <td style="background-color:#0E1B21; padding: 28px 40px;" class="fluid-padding">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="left" style="font-size:20px; font-weight:800; color:#FFFFFF; letter-spacing:-0.02em; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                    AUXOSYS
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
            <td style="padding: 40px;" class="fluid-padding">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">

                    <h1 style="margin:0 0 20px; font-size:22px; font-weight:800; color:#0E1B21; letter-spacing:-0.01em;">
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
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F5F8F8; border:1px solid #E7ECEC; border-radius:12px; margin: 28px 0;">
                      <tr>
                        <td style="padding: 24px 28px;">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td colspan="2" style="padding-bottom:14px; font-size:11px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:#0C8074;">
                                Application Details
                              </td>
                            </tr>
                            <tr>
                              <td style="padding:8px 0; font-size:13px; color:#7C8A8F; width:44%;">Application ID</td>
                              <td style="padding:8px 0; font-size:14px; font-weight:700; color:#0E1B21; text-align:right;">${data.ApplicationID}</td>
                            </tr>
                            <tr>
                              <td style="padding:8px 0; font-size:13px; color:#7C8A8F; border-top:1px solid #E7ECEC;">Job ID</td>
                              <td style="padding:8px 0; font-size:14px; font-weight:600; color:#10201F; text-align:right; border-top:1px solid #E7ECEC;">${data.JobID}</td>
                            </tr>
                            <tr>
                              <td style="padding:8px 0; font-size:13px; color:#7C8A8F; border-top:1px solid #E7ECEC;">Position</td>
                              <td style="padding:8px 0; font-size:14px; font-weight:600; color:#10201F; text-align:right; border-top:1px solid #E7ECEC;">${data.JobTitle}</td>
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

                    <p style="margin:0 0 28px; font-size:15px; line-height:1.7; color:#10201F;">
                      We sincerely appreciate the time and effort you invested in the application process and wish you every success in your future career. Thank you for considering Auxosys as part of your professional journey.
                    </p>

                    <!-- Secondary CTA -->
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="border-radius:10px; border:1px solid #D8E0E0;">
                          <a href="https://auxosys.com/careers" style="display:inline-block; padding:12px 24px; font-size:14px; font-weight:700; color:#0E1B21; text-decoration:none; border-radius:10px;">
                            View Open Roles →
                          </a>
                        </td>
                      </tr>
                    </table>

                    <p style="margin:28px 0 0; font-size:15px; line-height:1.7; color:#10201F;">
                      Best regards,<br>
                      <strong>Talent Acquisition Team</strong><br>
                      Auxosys
                    </p>

                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#F5F8F8; border-top:1px solid #E7ECEC; padding: 28px 40px;" class="fluid-padding">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:13px; line-height:1.8; color:#56656B;">
                    <strong style="color:#0E1B21;">Auxosys</strong><br>
                    🌐 <a href="https://auxosys.com" style="color:#0FB5A6; text-decoration:none;">auxosys.com</a><br>
                    📧 <a href="mailto:careers@auxosys.com" style="color:#0FB5A6; text-decoration:none;">careers@auxosys.com</a>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top:18px; font-size:12px; color:#7C8A8F; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                    You're receiving this email because you applied for a role at Auxosys via our careers page.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>`;
};
