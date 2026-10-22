const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      required: true,
    },
    faceEmbedding: {
      type: [Number],
      default: null,
      select: false
    },
    isFaceRegistered: {
      type: Boolean,
      default: false
    },
    registrationImages: {
      type: [String],
      default: []
    },
    faceRegistrationDate: {
      type: Date,
      default: null
    },
    lastFaceVerification: {
      type: Date,
      default: null
    },
    faceVerificationCount: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true,
  }
);

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.hasFaceRegistered = function () {
  return this.isFaceRegistered && this.faceEmbedding !== null;
};

userSchema.methods.updateFaceVerification = async function () {
  this.lastFaceVerification = new Date();
  this.faceVerificationCount += 1;
  return await this.save();
};

userSchema.methods.registerFace = async function (embedding, images) {
  this.faceEmbedding = embedding;
  this.registrationImages = images;
  this.isFaceRegistered = true;
  this.faceRegistrationDate = new Date();
  return await this.save();
};

userSchema.index({ email: 1 });
userSchema.index({ isFaceRegistered: 1 });

const User = mongoose.models.User || mongoose.model("User", userSchema);

module.exports = User;