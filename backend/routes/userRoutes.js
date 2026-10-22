const express = require('express');
const router = express.Router();

// Register
router.post("/", (req, res) => {
  res.json({ success: true, message: "User registered" });
});

// Login
router.post("/auth", (req, res) => {
  res.json({ success: true, message: "Login successful", token: "mock_jwt_token" });
});

// Logout
router.post("/logout", (req, res) => {
  res.json({ success: true, message: "Logged out" });
});

// Profile
router.get("/profile", (req, res) => {
  res.json({
    name: "Demo Student",
    email: "student@athena.com",
    role: "Student"
  });
});

module.exports = router;
