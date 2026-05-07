const express    = require('express');
const router     = express.Router();
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const User       = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'invoicesecret2025';

// ─────────────────────────────────────────────────────────────────────────────
// OTP Store (in-memory — swap for Redis in production)
// Shape: Map<email, { otp, expiresAt, sentAt, verified, attempts }>
// ─────────────────────────────────────────────────────────────────────────────
const otpStore = new Map();

// Auto-cleanup expired OTPs every 15 minutes
setInterval(() => {
  const now = Date.now();
  for (const [email, record] of otpStore.entries()) {
    if (now > record.expiresAt) otpStore.delete(email);
  }
}, 15 * 60 * 1000);

// ─────────────────────────────────────────────────────────────────────────────
// Nodemailer transporter
// Set these in your .env file (see bottom of this file for reference)
// ─────────────────────────────────────────────────────────────────────────────
// NAYA — yeh daalo
const transporter = nodemailer.createTransport({
  host:   process.env.EMAIL_HOST || 'smtp-relay.brevo.com',
  port:   parseInt(process.env.EMAIL_PORT || '2525'),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function buildOtpEmail(otp, expiryMins) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8">
<style>
  body{font-family:'Segoe UI',Arial,sans-serif;background:#f5f5f5;margin:0;padding:40px 0}
  .card{max-width:480px;margin:0 auto;background:#fff;border-radius:16px;
        box-shadow:0 4px 24px rgba(0,0,0,.08);overflow:hidden}
  .hdr{background:linear-gradient(135deg,#714B67,#5a3a52);padding:36px 40px;text-align:center}
  .hdr h1{color:#fff;margin:0;font-size:22px;font-weight:700}
  .hdr p{color:rgba(255,255,255,.75);margin:8px 0 0;font-size:14px}
  .body{padding:40px}
  .body p{color:#555;font-size:15px;line-height:1.6;margin:0 0 24px}
  .otp-box{background:#f8f4f7;border:2px dashed #714B67;border-radius:12px;
           text-align:center;padding:20px;margin:0 0 24px}
  .otp-box .code{font-size:40px;font-weight:800;letter-spacing:12px;
                 color:#714B67;display:block}
  .otp-box .exp{font-size:12px;color:#999;margin-top:6px}
  .warn{background:#fffbeb;border:1px solid #fde68a;border-radius:8px;
        padding:12px 16px;font-size:13px;color:#92400e;margin-bottom:24px}
  .footer{border-top:1px solid #eee;padding:20px 40px;text-align:center;
          font-size:12px;color:#aaa}
</style>
</head>
<body>
<div class="card">
  <div class="hdr"><h1>InvoicePro</h1><p>Password Reset Request</p></div>
  <div class="body">
    <p>You requested to reset your InvoicePro password. Use the OTP below:</p>
    <div class="otp-box">
      <span class="code">${otp}</span>
      <span class="exp">⏱ Expires in ${expiryMins} minutes</span>
    </div>
    <div class="warn">⚠️ Never share this OTP with anyone. InvoicePro will never ask for it.</div>
    <p style="margin:0">If you didn't request this, you can safely ignore this email.</p>
  </div>
  <div class="footer">© ${new Date().getFullYear()} InvoicePro &nbsp;·&nbsp; Automated message</div>
</div>
</body></html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// YOUR EXISTING ROUTES — unchanged
// ─────────────────────────────────────────────────────────────────────────────

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, company } = req.body;
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashed, company });
    const token = jwt.sign({ id: user._id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.json({ token, user: { id: user._id, name: user.name, email: user.email, company: user.company } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid email or password' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid email or password' });

    const token = jwt.sign({ id: user._id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, company: user.company } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get current user
router.get('/me', require('../middleware/auth'), async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// NEW ROUTES — Forgot Password OTP Flow
// ─────────────────────────────────────────────────────────────────────────────

// STEP 1 — Check email exists → generate & send OTP
// POST /api/auth/forgot-password   body: { email }
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    // Check user exists
    const user = await User.findOne({ email });
    if (!user)
      return res.status(404).json({ message: 'No account found with this email address' });

    // Rate-limit: block if another OTP was sent within last 60 seconds
    const existing = otpStore.get(email);
    if (existing) {
      const elapsed = (Date.now() - existing.sentAt) / 1000;
      if (elapsed < 60)
        return res.status(429).json({
          message: `Please wait ${Math.ceil(60 - elapsed)}s before requesting a new OTP`
        });
    }

    // Generate OTP and store it
    const otp        = generateOtp();
    const expiryMins = parseInt(process.env.OTP_EXPIRY_MINUTES || '10');
    otpStore.set(email, {
      otp,
      expiresAt: Date.now() + expiryMins * 60 * 1000,
      sentAt:    Date.now(),
      verified:  false,
      attempts:  0,
    });

    // Send email
    await transporter.sendMail({
      from:    process.env.EMAIL_FROM || `"InvoicePro" <${process.env.EMAIL_USER}>`,
      to:      email,
      subject: '🔐 Your InvoicePro Password Reset OTP',
      html:    buildOtpEmail(otp, expiryMins),
    });

    res.json({ message: 'OTP sent successfully' });
  } catch (err) {
    console.error('[forgot-password]', err);
    res.status(500).json({ message: 'Failed to send OTP. Please try again.' });
  }
});

// STEP 2 — Verify OTP
// POST /api/auth/verify-otp   body: { email, otp }
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp)
      return res.status(400).json({ message: 'Email and OTP are required' });

    const record = otpStore.get(email);

    if (!record)
      return res.status(400).json({ message: 'No OTP found for this email. Please request a new one.' });

    if (Date.now() > record.expiresAt) {
      otpStore.delete(email);
      return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
    }

    if (record.attempts >= 5) {
      otpStore.delete(email);
      return res.status(400).json({ message: 'Too many incorrect attempts. Please request a new OTP.' });
    }

    if (record.otp !== otp.toString().trim()) {
      record.attempts++;
      const left = 5 - record.attempts;
      return res.status(400).json({
        message: `Incorrect OTP. ${left} attempt${left !== 1 ? 's' : ''} remaining.`
      });
    }

    // ✅ Correct — mark verified so reset-password route can proceed
    record.verified = true;
    otpStore.set(email, record);

    res.json({ message: 'OTP verified successfully' });
  } catch (err) {
    console.error('[verify-otp]', err);
    res.status(500).json({ message: 'Verification failed. Please try again.' });
  }
});

// STEP 3 — Reset password (only allowed after OTP verified)
// POST /api/auth/reset-password   body: { email, newPassword }
router.post('/reset-password', async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    if (!email || !newPassword)
      return res.status(400).json({ message: 'Email and new password are required' });

    if (newPassword.length < 8)
      return res.status(400).json({ message: 'Password must be at least 8 characters' });

    const record = otpStore.get(email);

    if (!record || !record.verified)
      return res.status(400).json({ message: 'Please verify your OTP before resetting the password.' });

    if (Date.now() > record.expiresAt) {
      otpStore.delete(email);
      return res.status(400).json({ message: 'Session expired. Please start over.' });
    }

    // Hash and save new password — same salt rounds as your register route (10)
    const hashed = await bcrypt.hash(newPassword, 10);
    await User.findOneAndUpdate({ email }, { password: hashed });

    // Delete OTP record — single use only
    otpStore.delete(email);

    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    console.error('[reset-password]', err);
    res.status(500).json({ message: 'Password reset failed. Please try again.' });
  }
});

module.exports = router;

// ─────────────────────────────────────────────────────────────────────────────
// Required .env variables (add these to your existing .env file):
//
//   EMAIL_HOST=smtp.gmail.com
//   EMAIL_PORT=587
//   EMAIL_USER=your@gmail.com
//   EMAIL_PASS=xxxx xxxx xxxx xxxx   ← Gmail App Password (16 chars)
//   EMAIL_FROM="InvoicePro <your@gmail.com>"
//   OTP_EXPIRY_MINUTES=10
//
// Get Gmail App Password:
//   Google Account → Security → 2-Step Verification → App Passwords
// ─────────────────────────────────────────────────────────────────────────────