const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  usn: {
    type: String,
    trim: true,
    default: '1SZ23CS001'
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  faceEmbeddings: {
    type: [[Number]], // 30 128-dimensional vectors from 30 webcam frames
    default: []
  },
  descriptors: {
    type: [[Number]], // 30 128-d FaceAPI neural descriptors
    default: []
  },
  averageDescriptor: {
    type: [Number],
    default: []
  },
  enrolledImageSnapshot: {
    type: String, // Base64 or disk photo path
    default: null
  },
  enrollmentDate: {
    type: Date,
    default: Date.now
  },
  faceEnrolled: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

// Password hashing pre-save hook
userSchema.pre('save', async function(next) {
  if (this.isModified('password') && this.password && !this.password.startsWith('$2a$') && !this.password.startsWith('$2b$')) {
    try {
      const salt = await bcrypt.genSalt(10);
      this.password = await bcrypt.hash(this.password, salt);
    } catch (err) {
      return next(err);
    }
  }
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
