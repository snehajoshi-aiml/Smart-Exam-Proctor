const express = require('express');
const router = express.Router();
const {
  sendOtp,
  verifyOtp,
  resendOtp,
  forgotPassword,
  verifyResetToken,
  resetPasswordWithToken,
  resetPassword
} = require('../controllers/otpController');

// OTP & Password Reset Endpoints
router.post('/send', sendOtp);
router.post('/send-otp', sendOtp);
router.post('/verify', verifyOtp);
router.post('/verify-otp', verifyOtp);
router.post('/resend', resendOtp);
router.post('/resend-otp', resendOtp);

// Forgot Password & Reset
router.post('/forgot-password', forgotPassword);
router.get('/verify-reset-token', verifyResetToken);
router.post('/verify-reset-token', verifyResetToken);
router.post('/reset-password-with-token', resetPasswordWithToken);
router.post('/reset-password', resetPassword);

module.exports = router;

