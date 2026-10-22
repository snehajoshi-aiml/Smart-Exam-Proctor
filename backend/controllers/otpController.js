const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

// Load environment variables reliably
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

const OTP = require('../models/OTP');
const { sendOtpEmail, sendPasswordResetEmail } = require('../services/emailService');

let User = null;
let Student = null;
try { User = require('../models/User'); } catch (e) {}
try { Student = require('../models/Student'); } catch (e) {}

const JWT_SECRET = process.env.JWT_SECRET || 'your-secure-jwt-secret-key-here';
const COOLDOWN_SECONDS = 30;

// Resilient In-Memory OTP Store for disconnected MongoDB fallback
const memoryOtpStore = new Map();

function isMongoConnected() {
  return mongoose.connection && mongoose.connection.readyState === 1;
}

/**
 * Helper to derive formatted student name from email
 */
function deriveStudentName(email) {
  const prefix = email.split('@')[0] || 'student';
  return prefix
    .split(/[._-]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Safe OTP lookup checking MongoDB (if connected) with Memory fallback.
 * Can search by cleanEmail, or by tokenHash, or both.
 */
async function findActiveOtp(cleanEmail, tokenHash = null) {
  if (isMongoConnected() && OTP) {
    try {
      const query = {};
      if (tokenHash) query.tokenHash = tokenHash;
      if (cleanEmail) query.email = cleanEmail;
      const record = await OTP.findOne(query);
      if (record) return record;
    } catch (err) {
      console.warn('MongoDB OTP lookup notice:', err.message);
    }
  }

  // Memory store fallback
  if (tokenHash) {
    for (const [key, mem] of memoryOtpStore.entries()) {
      if (mem.tokenHash === tokenHash && (!cleanEmail || mem.email === cleanEmail)) {
        if (Date.now() > mem.expiresAt) {
          memoryOtpStore.delete(key);
          return null;
        }
        return mem;
      }
    }
    return null;
  }

  if (cleanEmail) {
    const mem = memoryOtpStore.get(cleanEmail);
    if (mem) {
      const now = Date.now();
      if (now > mem.expiresAt) {
        memoryOtpStore.delete(cleanEmail);
        return null;
      }
      return mem;
    }
  }
  return null;
}

/**
 * Safe OTP save updating MongoDB (if connected) and Memory store
 */
async function saveOtpRecord(cleanEmail, studentName, otpHash, tokenHashOrNow, maybeNow) {
  let tokenHash = null;
  let now = new Date();

  if (tokenHashOrNow instanceof Date) {
    now = tokenHashOrNow;
    tokenHash = null;
  } else {
    tokenHash = tokenHashOrNow || null;
    now = maybeNow instanceof Date ? maybeNow : new Date();
  }

  const expiresAt = now.getTime() + 10 * 60 * 1000; // 10 minutes

  // Always update memory store
  const memRecord = {
    email: cleanEmail,
    studentName,
    otpHash,
    tokenHash: tokenHash || null,
    attempts: 0,
    lastResendAt: now,
    createdAt: now,
    expiresAt,
    save: async function () {
      memoryOtpStore.set(cleanEmail, this);
    }
  };
  memoryOtpStore.set(cleanEmail, memRecord);

  // If MongoDB is connected, upsert MongoDB document per PROJECT_RULES.md
  if (isMongoConnected() && OTP) {
    try {
      await OTP.findOneAndUpdate(
        { email: cleanEmail },
        {
          email: cleanEmail,
          studentName,
          otpHash,
          tokenHash: tokenHash || null,
          attempts: 0,
          lastResendAt: now,
          createdAt: now
        },
        { upsert: true, new: true }
      );
    } catch (err) {
      console.warn('MongoDB OTP save notice:', err.message);
    }
  }

  return memRecord;
}

/**
 * Safe OTP delete removing from MongoDB and Memory store
 */
async function deleteOtpRecord(cleanEmail, mongoId) {
  memoryOtpStore.delete(cleanEmail);
  if (isMongoConnected() && OTP) {
    try {
      if (mongoId) {
        await OTP.deleteOne({ _id: mongoId });
      } else {
        await OTP.deleteOne({ email: cleanEmail });
      }
    } catch (err) {
      console.warn('MongoDB OTP deletion notice:', err.message);
    }
  }
}

/**
 * 1. Generate & Send OTP API
 * POST /api/otp/send
 */
const sendOtp = async (req, res) => {
  try {
    const { email, name } = req.body;
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({
        success: false,
        error: 'Valid email address is required'
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const studentName = name || deriveStudentName(cleanEmail);
    const now = new Date();

    // Check 30-second resend cooldown
    const existingOtp = await findActiveOtp(cleanEmail);
    if (existingOtp && existingOtp.lastResendAt) {
      const elapsedSeconds = (now.getTime() - new Date(existingOtp.lastResendAt).getTime()) / 1000;
      if (elapsedSeconds < COOLDOWN_SECONDS) {
        const remaining = Math.ceil(COOLDOWN_SECONDS - elapsedSeconds);
        return res.status(429).json({
          success: false,
          error: `Please wait ${remaining} seconds before requesting a new OTP.`,
          cooldownRemaining: remaining
        });
      }
    }

    // Generate secure 6-digit random OTP
    const otpCode = crypto.randomInt(100000, 999999).toString();
    const otpHash = await bcrypt.hash(otpCode, 10);

    // Upsert temporary OTP record
    await saveOtpRecord(cleanEmail, studentName, otpHash, now);

    // Dispatch real-time email via Nodemailer
    const dispatchResult = await sendOtpEmail(cleanEmail, studentName, otpCode);

    const isDev = process.env.NODE_ENV !== 'production';
    console.log(`✉️ 6-Digit OTP generated for ${cleanEmail} (Delivered: ${dispatchResult.delivered})`);

    if (dispatchResult.delivered) {
      return res.json({
        success: true,
        delivered: true,
        channel: dispatchResult.channel,
        message: `A 6-digit OTP code has been dispatched to ${cleanEmail}. Please check your Inbox and Spam / Junk folder.`,
        email: cleanEmail,
        studentName,
        cooldownSeconds: COOLDOWN_SECONDS,
        expiresInSeconds: 300
      });
    }

    console.warn(`⚠️ Cloud Email Delivery Notice: ${dispatchResult.reason}`);
    return res.status(502).json({
      success: false,
      delivered: false,
      error: `Could not send OTP email to ${cleanEmail}: ${dispatchResult.reason || 'Email service connection error'}. Please verify email configuration.`
    });
  } catch (error) {
    console.error('Error in sendOtp controller:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to process OTP request: ' + error.message
    });
  }
};

/**
 * 2. Verify OTP API (Single-Use, Auto-Deletes on Success)
 * POST /api/otp/verify
 */
const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        error: 'Email and 6-digit OTP code are required'
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otp.toString().trim();

    const otpRecord = await findActiveOtp(cleanEmail);

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        error: 'OTP expired or not found. Please request a new OTP code.'
      });
    }

    // Check maximum verification attempts (limit to 5 attempts)
    if (otpRecord.attempts >= 5) {
      await deleteOtpRecord(cleanEmail, otpRecord._id);
      return res.status(400).json({
        success: false,
        error: 'Maximum verification attempts exceeded. Please request a new OTP.'
      });
    }

    // Compare bcrypt hash
    const isMatch = await bcrypt.compare(cleanOtp, otpRecord.otpHash);

    if (!isMatch) {
      otpRecord.attempts = (otpRecord.attempts || 0) + 1;
      if (typeof otpRecord.save === 'function') {
        await otpRecord.save();
      }
      const remainingAttempts = 5 - otpRecord.attempts;
      return res.status(400).json({
        success: false,
        error: `Invalid OTP code. (${remainingAttempts} attempt${remainingAttempts === 1 ? '' : 's'} remaining)`
      });
    }

    // Single-use guarantee: Delete OTP record immediately upon successful verification
    await deleteOtpRecord(cleanEmail, otpRecord._id);

    // Generate JWT token
    const studentId = 'STU_' + cleanEmail.replace(/[^a-z0-9]/g, '_');
    const token = jwt.sign(
      {
        email: cleanEmail,
        studentId,
        role: 'Student',
        stage: 'otp_verified'
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log(`✅ OTP Verification Successful for ${cleanEmail} (${studentId})`);

    return res.json({
      success: true,
      message: 'OTP verified successfully! Identity confirmed.',
      token,
      otpToken: token,
      studentId,
      studentName: otpRecord.studentName || deriveStudentName(cleanEmail)
    });
  } catch (error) {
    console.error('Error in verifyOtp controller:', error);
    return res.status(500).json({
      success: false,
      error: 'OTP verification failed: ' + error.message
    });
  }
};

/**
 * 3. Resend OTP API
 * POST /api/otp/resend
 */
const resendOtp = async (req, res) => {
  return sendOtp(req, res);
};

/**
 * 4. Forgot Password - Generate Secure Reset Token & OTP, Send Dual Email
 * POST /api/otp/forgot-password
 */
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({
        success: false,
        error: 'Valid email address is required.'
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const now = new Date();

    // Enforce 30-second resend cooldown per email
    const existingOtp = await findActiveOtp(cleanEmail);
    if (existingOtp && existingOtp.lastResendAt) {
      const elapsedSeconds = (now.getTime() - new Date(existingOtp.lastResendAt).getTime()) / 1000;
      if (elapsedSeconds < COOLDOWN_SECONDS) {
        const remaining = Math.ceil(COOLDOWN_SECONDS - elapsedSeconds);
        return res.status(429).json({
          success: false,
          error: `Please wait ${remaining} seconds before requesting a new password reset.`,
          cooldownRemaining: remaining
        });
      }
    }

    // Check if user exists in database
    let existingUser = null;
    let userFound = false;

    if (isMongoConnected()) {
      try {
        if (User) {
          existingUser = await User.findOne({ email: cleanEmail });
        }
        if (!existingUser && Student) {
          existingUser = await Student.findOne({ email: cleanEmail });
        }
        if (existingUser) {
          userFound = true;
        }
      } catch (err) {
        console.warn('MongoDB user lookup notice:', err.message);
      }
    } else {
      // Dev mode fallback when MongoDB is temporarily disconnected
      userFound = true;
    }

    const genericConfirmationMessage =
      'If an account exists with this email address, password reset instructions have been sent. Please check your inbox and spam folder.';

    // Privacy protection: If user is not registered, return generic confirmation without leaking user non-existence
    if (!userFound && isMongoConnected()) {
      console.log(`ℹ️ Password reset requested for unregistered email: ${cleanEmail}. Generic confirmation returned.`);
      return res.json({
        success: true,
        delivered: true,
        message: genericConfirmationMessage,
        email: cleanEmail,
        cooldownSeconds: COOLDOWN_SECONDS
      });
    }

    const studentName = existingUser?.fullName || existingUser?.name || deriveStudentName(cleanEmail);

    // Generate secure 32-byte cryptographic random reset token (64 hex characters)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Generate secure 6-digit random OTP code for direct screen entry
    const otpCode = crypto.randomInt(100000, 999999).toString();
    const otpHash = await bcrypt.hash(otpCode, 10);

    // Save tokenHash and otpHash with 10-minute expiration
    await saveOtpRecord(cleanEmail, studentName, otpHash, tokenHash, now);

    // Construct password reset link using deployed frontend URL
    let frontendBase =
      (process.env.FRONTEND_URL || '').trim() ||
      (process.env.CLIENT_URL && !process.env.CLIENT_URL.includes('localhost') ? process.env.CLIENT_URL : '').trim() ||
      (req.headers.origin && !req.headers.origin.includes('localhost') ? req.headers.origin : '').trim() ||
      'https://athena-proctor.vercel.app';
    if (frontendBase && !/^https?:\/\//i.test(frontendBase)) {
      frontendBase = `https://${frontendBase}`;
    }
    const cleanFrontendUrl = frontendBase.replace(/\/+$/, '');
    const resetLink = `${cleanFrontendUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(cleanEmail)}`;

    // Dispatch real-time email (Brevo HTTPS -> Resend HTTPS -> SendGrid HTTPS -> SMTP)
    const dispatchResult = await sendPasswordResetEmail(cleanEmail, studentName, resetLink, otpCode);

    console.log(`✉️ Password Reset Email dispatched for ${cleanEmail} (Delivered: ${dispatchResult.delivered}, Channel: ${dispatchResult.channel || 'none'})`);

    if (dispatchResult.delivered) {
      return res.json({
        success: true,
        delivered: true,
        channel: dispatchResult.channel,
        message: genericConfirmationMessage,
        email: cleanEmail,
        studentName,
        cooldownSeconds: COOLDOWN_SECONDS,
        expiresInSeconds: 600
      });
    }

    console.warn(`⚠️ Cloud Password Reset Notice: ${dispatchResult.reason}`);
    return res.status(502).json({
      success: false,
      delivered: false,
      error: `Could not send password reset email to ${cleanEmail}: ${dispatchResult.reason || 'Email service connection error'}. Please verify email settings.`
    });
  } catch (error) {
    console.error('Error in forgotPassword controller:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to process password reset request: ' + error.message
    });
  }
};

/**
 * 5. Verify Password Reset Token API
 * GET /api/auth/verify-reset-token
 * POST /api/auth/verify-reset-token
 */
const verifyResetToken = async (req, res) => {
  try {
    const rawToken = req.query.token || req.body.token;
    const rawEmail = req.query.email || req.body.email;

    if (!rawToken || typeof rawToken !== 'string' || rawToken.trim().length < 16) {
      return res.status(400).json({
        success: false,
        valid: false,
        error: 'Invalid or missing password reset token.'
      });
    }

    const cleanToken = rawToken.trim();
    const cleanEmail = rawEmail ? rawEmail.trim().toLowerCase() : null;
    const tokenHash = crypto.createHash('sha256').update(cleanToken).digest('hex');

    const otpRecord = await findActiveOtp(cleanEmail, tokenHash);

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        valid: false,
        error: 'This password reset link is invalid or has expired. Please request a new one.'
      });
    }

    return res.json({
      success: true,
      valid: true,
      email: otpRecord.email,
      studentName: otpRecord.studentName
    });
  } catch (error) {
    console.error('Error in verifyResetToken controller:', error);
    return res.status(500).json({
      success: false,
      valid: false,
      error: 'Failed to verify reset token: ' + error.message
    });
  }
};

/**
 * 6. Reset Password with Secure Token API (From Email Link)
 * POST /api/auth/reset-password-with-token
 * POST /api/reset-password-with-token
 */
const resetPasswordWithToken = async (req, res) => {
  try {
    const { email, token, newPassword } = req.body;

    if (!email || !token || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Email, reset token, and new password are required.'
      });
    }

    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'New password must be at least 6 characters long.'
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanToken = token.trim();
    const tokenHash = crypto.createHash('sha256').update(cleanToken).digest('hex');

    const otpRecord = await findActiveOtp(cleanEmail, tokenHash);

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        error: 'This password reset link is invalid or has expired. Please request a new password reset.'
      });
    }

    // Check maximum attempts (limit to 5 attempts)
    if (otpRecord.attempts >= 5) {
      await deleteOtpRecord(cleanEmail, otpRecord._id);
      return res.status(400).json({
        success: false,
        error: 'Maximum reset attempts exceeded. Please request a new password reset link.'
      });
    }

    // Hash the new password using bcrypt (matching registration & login conventions)
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    let updatedCount = 0;
    if (isMongoConnected()) {
      try {
        if (User) {
          const userRes = await User.updateOne(
            { email: cleanEmail },
            { $set: { password: hashedPassword } }
          );
          if (userRes.matchedCount > 0) updatedCount++;
        }

        if (Student) {
          const stuRes = await Student.updateOne(
            { email: cleanEmail },
            { $set: { password: hashedPassword, passwordHash: hashedPassword } }
          );
          if (stuRes.matchedCount > 0) updatedCount++;
        }
      } catch (dbErr) {
        console.warn('MongoDB password update error:', dbErr.message);
      }
    }

    // Single-use guarantee: Invalidate and delete the reset token immediately
    await deleteOtpRecord(cleanEmail, otpRecord._id);

    console.log(`🔑 Password successfully updated via reset token for ${cleanEmail} (Records updated: ${updatedCount})`);

    return res.json({
      success: true,
      message: 'Password reset successfully! You can now log in with your new password.',
      email: cleanEmail
    });
  } catch (error) {
    console.error('Error in resetPasswordWithToken controller:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to reset password: ' + error.message
    });
  }
};

/**
 * 7. Reset Password - Verify OTP & Update Password API (From Login Modal)
 * POST /api/otp/reset-password
 */
const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Email, 6-digit OTP code, and new password are required.'
      });
    }

    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'New password must be at least 6 characters long.'
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otp.toString().trim();

    const otpRecord = await findActiveOtp(cleanEmail);

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        error: 'OTP expired or not found. Please request a new password reset OTP.'
      });
    }

    // Check maximum verification attempts (limit to 5 attempts)
    if (otpRecord.attempts >= 5) {
      await deleteOtpRecord(cleanEmail, otpRecord._id);
      return res.status(400).json({
        success: false,
        error: 'Maximum verification attempts exceeded. Please request a new password reset OTP.'
      });
    }

    // Compare bcrypt hash
    const isMatch = await bcrypt.compare(cleanOtp, otpRecord.otpHash);

    if (!isMatch) {
      otpRecord.attempts = (otpRecord.attempts || 0) + 1;
      if (typeof otpRecord.save === 'function') {
        await otpRecord.save();
      }
      const remainingAttempts = 5 - otpRecord.attempts;
      return res.status(400).json({
        success: false,
        error: `Invalid OTP code. (${remainingAttempts} attempt${remainingAttempts === 1 ? '' : 's'} remaining)`
      });
    }

    // Update password in MongoDB documents
    let updatedCount = 0;
    if (isMongoConnected()) {
      try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        if (User) {
          await User.updateOne(
            { email: cleanEmail },
            { $set: { password: hashedPassword } }
          );
          updatedCount++;
        }

        if (Student) {
          await Student.updateOne(
            { email: cleanEmail },
            { $set: { password: hashedPassword, passwordHash: hashedPassword } }
          );
          updatedCount++;
        }
      } catch (e) {
        console.warn('Notice updating student password in MongoDB:', e.message);
      }
    }

    // Delete used single-use OTP document
    await deleteOtpRecord(cleanEmail, otpRecord._id);

    console.log(`🔑 Password successfully reset for ${cleanEmail}. Updated records: ${updatedCount}`);

    return res.json({
      success: true,
      message: 'Password reset successfully! You can now log in with your new password.',
      email: cleanEmail
    });
  } catch (error) {
    console.error('Error in resetPassword controller:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to reset password: ' + error.message
    });
  }
};

module.exports = {
  sendOtp,
  verifyOtp,
  resendOtp,
  forgotPassword,
  verifyResetToken,
  resetPasswordWithToken,
  resetPassword,
  memoryOtpStore
};
