const jwt = require('jsonwebtoken');

const generateToken = (res, userId) => {
  const secret = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';
  const token = jwt.sign({ userId }, secret, {
    expiresIn: "30d",
  });

  res.cookie("jwt", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });

  return token;
};

module.exports = generateToken;
