const nodemailer = require('nodemailer');

function normalizeCredential(val) {
  if (typeof val !== 'string') return '';
  return val.trim().replace(/\s+/g, '');
}

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { toEmail, studentName, otpCode, subject, htmlContent, purposeText } = req.body || {};

    if (!toEmail || !toEmail.includes('@') || !otpCode) {
      return res.status(400).json({ success: false, error: 'toEmail and otpCode are required' });
    }

    const emailUser = normalizeCredential(process.env.EMAIL_USER) || 'ksubhashk998@gmail.com';
    const emailPass = normalizeCredential(process.env.EMAIL_APP_PASSWORD || process.env.EMAIL_PASS) || 'pvfnkhdspmigqjux';

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: emailUser,
        pass: emailPass
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000
    });

    const mailSubject = subject || 'Athena Smart Proctoring - Password Reset OTP';
    const cleanStudentName = studentName || 'Student';
    const actionDesc = purposeText || 'Your One-Time Password (OTP) for Athena Smart Proctoring is:';

    const defaultHtml = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #070c18; padding: 40px 20px; color: #f8fafc;">
        <div style="max-width: 520px; margin: 0 auto; background: #0f172a; border: 1px solid #1e293b; border-radius: 16px; padding: 32px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="display: inline-block; width: 54px; height: 54px; background: linear-gradient(135deg, #6366f1, #4f46e5); border-radius: 50%; line-height: 54px; font-size: 24px;">
              🛡️
            </div>
            <h2 style="margin: 12px 0 4px 0; color: #ffffff; font-size: 22px; font-weight: 800;">Athena Smart Proctoring</h2>
            <span style="color: #818cf8; font-size: 13px; font-weight: 600;">Enterprise AI Examination Suite</span>
          </div>
          <hr style="border: 0; border-top: 1px solid #1e293b; margin: 20px 0;" />
          <p style="font-size: 15px; color: #cbd5e1; margin-bottom: 8px;">Hello <strong style="color: #ffffff;">${cleanStudentName}</strong>,</p>
          <p style="font-size: 14px; color: #94a3b8; line-height: 1.6; margin-bottom: 24px;">
            ${actionDesc}
          </p>
          <div style="background: linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.9)); border: 2px dashed #4f46e5; border-radius: 14px; padding: 20px 12px; text-align: center; margin-bottom: 24px;">
            <span style="font-family: 'Consolas', 'Courier New', monospace; font-size: 32px; font-weight: 900; letter-spacing: 6px; color: #34d399; display: inline-block; white-space: nowrap; word-break: keep-all;">
              ${otpCode}
            </span>
            <span style="display: block; font-size: 12px; color: #94a3b8; margin-top: 10px;">
              ⏳ Valid for <strong>5 minutes</strong> • Single Use Only
            </span>
          </div>
          <p style="font-size: 13px; color: #94a3b8; line-height: 1.5; margin-bottom: 24px;">
            If you did not request this OTP, please ignore this email. Do not share this security code with anyone.
          </p>
          <hr style="border: 0; border-top: 1px solid #1e293b; margin: 20px 0;" />
          <div style="text-align: center; font-size: 12px; color: #64748b;">
            Regards,<br />
            <strong style="color: #cbd5e1;">Athena Smart Proctoring Team</strong>
          </div>
        </div>
      </div>
    `;

    const mailOptions = {
      from: `"Athena Smart Proctoring" <${emailUser}>`,
      to: toEmail,
      subject: mailSubject,
      html: htmlContent || defaultHtml,
      text: `Hello ${cleanStudentName},\n\n${actionDesc} ${otpCode}\n\nValid for 5 minutes.\n\nAthena Smart Proctoring Team`
    };

    const info = await new Promise((resolve, reject) => {
      transporter.sendMail(mailOptions, (err, result) => {
        if (err) return reject(err);
        resolve(result);
      });
    });

    console.log(`✉️ [Vercel Relay] OTP email successfully sent to ${toEmail}. Message ID: ${info.messageId}`);
    return res.status(200).json({
      success: true,
      delivered: true,
      messageId: info.messageId,
      channel: 'vercel_relay'
    });

  } catch (error) {
    console.error('Vercel mail relay error:', error.message);
    return res.status(500).json({
      success: false,
      delivered: false,
      error: error.message
    });
  }
};
