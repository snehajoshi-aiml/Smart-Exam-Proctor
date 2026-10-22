const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');

// Load environment variables reliably regardless of cwd or import order
const envPaths = [
  path.resolve(__dirname, '../.env'),
  path.resolve(__dirname, '../../.env'),
  path.resolve(process.cwd(), 'backend/.env'),
  path.resolve(process.cwd(), '.env')
];
for (const p of envPaths) {
  if (fs.existsSync(p)) {
    require('dotenv').config({ path: p });
  }
}

function normalizeEmailCredential(value) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, '');
}

let cachedTransporter = null;

/**
 * Returns a robust Nodemailer Transporter instance.
 * Supports SMTP_USER / EMAIL_USER, SMTP_PASS / EMAIL_APP_PASSWORD / EMAIL_PASS,
 * SMTP_HOST, SMTP_PORT, and SMTP_SECURE.
 */
function getTransporter() {
  const emailUser = normalizeEmailCredential(process.env.SMTP_USER || process.env.EMAIL_USER);
  const emailPass = normalizeEmailCredential(
    process.env.SMTP_PASS || process.env.EMAIL_APP_PASSWORD || process.env.EMAIL_PASS
  );

  if (!emailUser || !emailPass) {
    return null;
  }

  if (cachedTransporter) {
    return cachedTransporter;
  }

  const host = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const port = parseInt(process.env.SMTP_PORT, 10) || (host === 'smtp.gmail.com' ? 465 : 587);
  const isSecure = process.env.SMTP_SECURE === 'true' || port === 465;

  if (host === 'smtp.gmail.com' && (!process.env.SMTP_PORT || port === 465)) {
    cachedTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: emailUser,
        pass: emailPass
      },
      tls: {
        rejectUnauthorized: false
      },
      connectionTimeout: 8000,
      greetingTimeout: 5000,
      socketTimeout: 8000
    });
  } else {
    cachedTransporter = nodemailer.createTransport({
      host: host,
      port: port,
      secure: isSecure,
      auth: {
        user: emailUser,
        pass: emailPass
      },
      tls: {
        rejectUnauthorized: false
      },
      connectionTimeout: 8000,
      greetingTimeout: 5000,
      socketTimeout: 8000
    });
  }

  return cachedTransporter;
}

/**
 * Dispatch email via available channels (Brevo HTTPS -> Resend HTTPS -> SendGrid HTTPS -> SMTP)
 */
async function dispatchEmail({ toEmail, toName, subject, htmlContent, textContent }) {
  const cleanToEmail = toEmail.trim().toLowerCase();
  const studentName = toName || 'Student';
  const emailUser = normalizeEmailCredential(process.env.SMTP_USER || process.env.EMAIL_USER);
  const defaultFrom = emailUser
    ? `"Athena Smart Proctoring" <${emailUser}>`
    : '"Athena Smart Proctoring" <no-reply@athena-proctor.com>';
  const fromAddress = (process.env.EMAIL_FROM || defaultFrom).trim();

  let lastFailureReason = '';

  // 1. Check for Brevo HTTPS API Key (Port 443 - Bypasses cloud host SMTP blocks like Render)
  const brevoApiKey = (process.env.BREVO_API_KEY || '').trim().replace(/^['"]|['"]$/g, '');
  if (brevoApiKey) {
    try {
      const axios = require('axios');
      const senderEmail = emailUser || 'ksubhashk998@gmail.com';
      const brevoRes = await axios.post(
        'https://api.brevo.com/v3/smtp/email',
        {
          sender: { name: 'Athena Proctoring', email: senderEmail },
          to: [{ email: cleanToEmail, name: studentName }],
          subject: subject,
          htmlContent: htmlContent,
          textContent: textContent
        },
        {
          headers: {
            'api-key': brevoApiKey,
            'Content-Type': 'application/json'
          },
          timeout: 8000
        }
      );
      console.log(`✉️ Email successfully delivered via Brevo HTTPS to ${cleanToEmail}. Message ID: ${brevoRes.data?.messageId}`);
      return {
        success: true,
        delivered: true,
        channel: 'brevo_https',
        messageId: brevoRes.data?.messageId
      };
    } catch (brevoErr) {
      const errMsg = brevoErr.response?.data?.message || brevoErr.message;
      lastFailureReason = `Brevo HTTPS notice: ${errMsg}`;
      console.warn(lastFailureReason);
    }
  }

  // 2. Check for Resend HTTPS API Key (Port 443)
  if (process.env.RESEND_API_KEY) {
    try {
      const axios = require('axios');
      const resendFrom = process.env.EMAIL_FROM || 'Athena Proctoring <onboarding@resend.dev>';
      const resendRes = await axios.post(
        'https://api.resend.com/emails',
        {
          from: resendFrom,
          to: [cleanToEmail],
          subject: subject,
          html: htmlContent,
          text: textContent
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 7000
        }
      );
      console.log(`✉️ Email delivered via Resend HTTPS to ${cleanToEmail}. ID: ${resendRes.data?.id}`);
      return {
        success: true,
        delivered: true,
        channel: 'resend_https',
        messageId: resendRes.data?.id
      };
    } catch (resendErr) {
      lastFailureReason = `Resend HTTPS error: ${resendErr.response?.data?.message || resendErr.message}`;
      console.warn(lastFailureReason);
    }
  }

  // 3. Check for SendGrid HTTPS API Key (Port 443)
  if (process.env.SENDGRID_API_KEY) {
    try {
      const axios = require('axios');
      const senderEmail = emailUser || 'ksubhashk998@gmail.com';
      const sendgridRes = await axios.post(
        'https://api.sendgrid.com/v3/mail/send',
        {
          personalizations: [{ to: [{ email: cleanToEmail, name: studentName }] }],
          from: { email: senderEmail, name: 'Athena Proctoring' },
          subject: subject,
          content: [
            { type: 'text/plain', value: textContent || 'Please open in an HTML-compatible email client.' },
            { type: 'text/html', value: htmlContent }
          ]
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 7000
        }
      );
      const msgId = sendgridRes.headers?.['x-message-id'] || 'sendgrid-' + Date.now();
      console.log(`✉️ Email delivered via SendGrid HTTPS to ${cleanToEmail}. ID: ${msgId}`);
      return {
        success: true,
        delivered: true,
        channel: 'sendgrid_https',
        messageId: msgId
      };
    } catch (sendgridErr) {
      lastFailureReason = `SendGrid HTTPS error: ${sendgridErr.response?.data?.errors?.[0]?.message || sendgridErr.message}`;
      console.warn(lastFailureReason);
    }
  }

  // 4. Fallback to standard Nodemailer SMTP
  const transporter = getTransporter();

  if (!transporter) {
    const reason = 'SMTP credentials (SMTP_USER/EMAIL_USER and SMTP_PASS/EMAIL_APP_PASSWORD) are not configured';
    console.warn(`⚠️ ${reason}. Target: ${cleanToEmail}`);
    return {
      success: false,
      delivered: false,
      reason: lastFailureReason || reason
    };
  }

  const mailOptions = {
    from: fromAddress,
    to: cleanToEmail,
    subject: subject,
    html: htmlContent,
    text: textContent
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✉️ Email delivered via SMTP to ${cleanToEmail}. Message ID: ${info.messageId}`);
    return {
      success: true,
      delivered: true,
      channel: 'smtp',
      messageId: info.messageId
    };
  } catch (error) {
    const isTimeout = error.message?.includes('timeout') || error.code === 'ETIMEDOUT';
    const failureReason = isTimeout
      ? 'Outbound SMTP port blocked or timed out on cloud host. (Configure BREVO_API_KEY in environment for HTTPS delivery).'
      : error.message;
    console.error(`Email delivery failed for ${cleanToEmail}:`, failureReason);
    return {
      success: false,
      delivered: false,
      reason: failureReason
    };
  }
}

/**
 * Send Real-Time OTP Email
 */
async function sendOtpEmail(toEmail, studentName, otpCode, customSubject, purposeText) {
  const subject = customSubject || 'Athena Smart Proctoring - Verification OTP';
  const actionDescription = purposeText || 'Your One-Time Password (OTP) for Athena Smart Proctoring is:';

  const htmlContent = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #070c18; padding: 40px 20px; color: #f8fafc;">
      <div style="max-width: 520px; margin: 0 auto; background: #0f172a; border: 1px solid #1e293b; border-radius: 16px; padding: 32px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
        
        <!-- Header Logo -->
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="display: inline-block; width: 54px; height: 54px; background: linear-gradient(135deg, #6366f1, #4f46e5); border-radius: 50%; line-height: 54px; font-size: 24px;">
            🛡️
          </div>
          <h2 style="margin: 12px 0 4px 0; color: #ffffff; font-size: 22px; font-weight: 800;">Athena Smart Proctoring</h2>
          <span style="color: #818cf8; font-size: 13px; font-weight: 600;">Enterprise AI Examination Suite</span>
        </div>

        <hr style="border: 0; border-top: 1px solid #1e293b; margin: 20px 0;" />

        <p style="font-size: 15px; color: #cbd5e1; margin-bottom: 8px;">Hello <strong style="color: #ffffff;">${studentName}</strong>,</p>
        <p style="font-size: 14px; color: #94a3b8; line-height: 1.6; margin-bottom: 24px;">
          ${actionDescription}
        </p>

        <!-- OTP Badge Container -->
        <div style="background: linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.9)); border: 2px dashed #4f46e5; border-radius: 14px; padding: 20px 12px; text-align: center; margin-bottom: 24px;">
          <span style="font-family: 'Consolas', 'Courier New', monospace; font-size: 32px; font-weight: 900; letter-spacing: 6px; color: #34d399; display: inline-block; white-space: nowrap; word-break: keep-all;">
            ${otpCode}
          </span>
          <span style="display: block; font-size: 12px; color: #94a3b8; margin-top: 10px;">
            ⏳ Valid for <strong>10 minutes</strong> • Single Use Only
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

  const textContent = `Hello ${studentName},\n\n${actionDescription} ${otpCode}\n\nThis code is valid for 10 minutes. If you do not see this email in your inbox, please check your spam or junk folder.\n\nRegards,\nAthena Smart Proctoring Team`;

  const result = await dispatchEmail({
    toEmail,
    toName: studentName,
    subject,
    htmlContent,
    textContent
  });

  return { ...result, otpCode };
}

/**
 * Send Comprehensive Password Reset Email (Direct 1-Click Link + 6-Digit OTP Code)
 * @param {string} toEmail
 * @param {string} studentName
 * @param {string} resetLink
 * @param {string} otpCode
 */
async function sendPasswordResetEmail(toEmail, studentName, resetLink, otpCode) {
  const subject = 'Athena Smart Proctoring - Password Reset Instructions';

  const htmlContent = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #070c18; padding: 40px 20px; color: #f8fafc;">
      <div style="max-width: 560px; margin: 0 auto; background: #0f172a; border: 1px solid #1e293b; border-radius: 16px; padding: 36px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
        
        <!-- Header Logo -->
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="display: inline-block; width: 56px; height: 56px; background: linear-gradient(135deg, #6366f1, #4f46e5); border-radius: 50%; line-height: 56px; font-size: 26px;">
            🛡️
          </div>
          <h2 style="margin: 14px 0 4px 0; color: #ffffff; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">Athena Smart Proctoring</h2>
          <span style="color: #818cf8; font-size: 13px; font-weight: 600;">Secure Password Reset Service</span>
        </div>

        <hr style="border: 0; border-top: 1px solid #1e293b; margin: 20px 0;" />

        <p style="font-size: 15px; color: #e2e8f0; margin-bottom: 12px;">Hello <strong style="color: #ffffff;">${studentName}</strong>,</p>
        <p style="font-size: 14px; color: #94a3b8; line-height: 1.6; margin-bottom: 24px;">
          We received a request to reset the password for your Athena Smart Proctoring account. You can reset your password immediately using the secure 1-click button below:
        </p>

        <!-- 1-Click Reset Button Container -->
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" target="_blank" rel="noopener noreferrer" style="background: linear-gradient(135deg, #4f46e5, #7c3aed); color: #ffffff; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 15px; display: inline-block; box-shadow: 0 4px 14px rgba(79, 70, 229, 0.4); letter-spacing: 0.3px;">
            🔒 Reset My Password
          </a>
        </div>

        <!-- Direct Link Backup -->
        <div style="background: rgba(30, 41, 59, 0.5); border: 1px solid #1e293b; border-radius: 10px; padding: 14px; margin-bottom: 24px;">
          <p style="font-size: 12px; color: #94a3b8; margin: 0 0 6px 0;">
            If the button above does not work, copy and paste this link into your browser:
          </p>
          <p style="font-size: 12px; color: #818cf8; margin: 0; word-break: break-all; font-family: monospace;">
            <a href="${resetLink}" target="_blank" style="color: #818cf8; text-decoration: underline;">${resetLink}</a>
          </p>
        </div>

        <!-- 6-Digit OTP Code Section -->
        <div style="background: linear-gradient(135deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.7)); border: 1px dashed #4f46e5; border-radius: 12px; padding: 18px 12px; text-align: center; margin-bottom: 24px;">
          <span style="display: block; font-size: 12px; color: #94a3b8; margin-bottom: 8px;">
            Prefer entering a code? Here is your 6-digit Reset OTP:
          </span>
          <span style="font-family: 'Consolas', 'Courier New', monospace; font-size: 28px; font-weight: 900; letter-spacing: 6px; color: #34d399; display: inline-block;">
            ${otpCode}
          </span>
        </div>

        <p style="font-size: 12px; color: #f59e0b; line-height: 1.5; margin-bottom: 20px;">
          ⏳ <strong>Notice:</strong> This reset link and OTP code are valid for <strong>10 minutes</strong> and can only be used once.
        </p>

        <p style="font-size: 12px; color: #64748b; line-height: 1.5; margin-bottom: 24px;">
          If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged, and your account remains secure.
        </p>

        <hr style="border: 0; border-top: 1px solid #1e293b; margin: 20px 0;" />

        <div style="text-align: center; font-size: 12px; color: #64748b;">
          Regards,<br />
          <strong style="color: #cbd5e1;">Athena Smart Proctoring Security Team</strong>
        </div>
      </div>
    </div>
  `;

  const textContent = `Hello ${studentName},\n\nWe received a request to reset your Athena Smart Proctoring account password.\n\nClick the link below to set a new password:\n${resetLink}\n\nOr enter this 6-digit OTP code on the reset screen: ${otpCode}\n\nThis link and OTP are valid for 10 minutes and single-use only.\nIf you did not request this, please ignore this email.\n\nRegards,\nAthena Smart Proctoring Security Team`;

  const result = await dispatchEmail({
    toEmail,
    toName: studentName,
    subject,
    htmlContent,
    textContent
  });

  return { ...result, resetLink, otpCode };
}

module.exports = {
  getTransporter,
  sendOtpEmail,
  sendPasswordResetEmail,
  normalizeEmailCredential
};

