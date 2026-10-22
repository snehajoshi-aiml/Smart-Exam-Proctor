/**
 * Professional HTML Email Template Generator for Athena Smart Proctoring OTP
 * Responsive, dark-themed (#0F172A), mobile-optimized email layout
 *
 * @param {string} studentName - Name of the user receiving the OTP
 * @param {string} otpCode - 6-digit random security OTP code
 * @returns {string} Fully styled HTML string for Nodemailer dispatch
 */
function generateOtpEmailTemplate(studentName = 'Student', otpCode) {
  const currentYear = new Date().getFullYear();

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Athena Smart Proctoring - Security Verification OTP</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #0b0f19;
      font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #f8fafc;
      -webkit-font-smoothing: antialiased;
    }
    .email-container {
      max-width: 520px;
      margin: 30px auto;
      background-color: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
    }
    .header {
      padding: 36px 24px 20px 24px;
      text-align: center;
      background: linear-gradient(180deg, #1e1b4b 0%, #0f172a 100%);
    }
    .logo-badge {
      display: inline-block;
      width: 60px;
      height: 60px;
      background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
      border-radius: 50%;
      line-height: 60px;
      font-size: 28px;
      box-shadow: 0 10px 20px rgba(99, 102, 241, 0.3);
      margin-bottom: 12px;
    }
    .title {
      margin: 0;
      color: #ffffff;
      font-size: 24px;
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    .subtitle {
      display: block;
      color: #818cf8;
      font-size: 13px;
      font-weight: 600;
      margin-top: 4px;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }
    .divider {
      border: 0;
      border-top: 1px solid #1e293b;
      margin: 0;
    }
    .content {
      padding: 32px 28px;
    }
    .greeting {
      font-size: 16px;
      color: #e2e8f0;
      margin: 0 0 10px 0;
    }
    .message {
      font-size: 14px;
      color: #94a3b8;
      line-height: 1.6;
      margin: 0 0 28px 0;
    }
    .otp-box {
      background: linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.95));
      border: 2px dashed #6366f1;
      border-radius: 16px;
      padding: 24px 16px;
      text-align: center;
      margin-bottom: 28px;
      box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3);
    }
    .otp-code {
      font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
      font-size: 34px;
      font-weight: 900;
      letter-spacing: 8px;
      color: #34d399;
      display: inline-block;
      white-space: nowrap;
      word-break: keep-all;
      text-shadow: 0 0 12px rgba(52, 211, 153, 0.3);
    }
    .otp-expiry {
      display: block;
      font-size: 12px;
      color: #94a3b8;
      margin-top: 12px;
      font-weight: 500;
    }
    .warning {
      font-size: 13px;
      color: #94a3b8;
      line-height: 1.5;
      background: rgba(239, 68, 68, 0.08);
      border-left: 3px solid #ef4444;
      padding: 12px 16px;
      border-radius: 0 8px 8px 0;
      margin-bottom: 28px;
    }
    .footer {
      padding: 20px 24px;
      text-align: center;
      background-color: #090d16;
      border-top: 1px solid #1e293b;
      font-size: 12px;
      color: #64748b;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <!-- Header -->
    <div class="header">
      <div class="logo-badge">🛡️</div>
      <h1 class="title">Athena Smart Proctoring</h1>
      <span class="subtitle">Enterprise AI Examination Suite</span>
    </div>

    <hr class="divider" />

    <!-- Content Body -->
    <div class="content">
      <p class="greeting">Hello <strong style="color: #ffffff;">${studentName}</strong>,</p>
      <p class="message">
        Your One-Time Password (OTP) for logging into Athena Smart Proctoring is:
      </p>

      <!-- OTP Card -->
      <div class="otp-box">
        <span class="otp-code">${otpCode}</span>
        <span class="otp-expiry">
          ⏳ Valid for <strong>5 minutes</strong> • Single Use Only
        </span>
      </div>

      <!-- Warning -->
      <div class="warning">
        If you did not request this OTP, please ignore this email. Do not share this security code with anyone.
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      © ${currentYear} Athena Smart Proctoring. All rights reserved.
    </div>
  </div>
</body>
</html>
  `;
}

module.exports = {
  generateOtpEmailTemplate
};
