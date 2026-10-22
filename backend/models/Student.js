const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const studentSchema = new mongoose.Schema({
    studentId: { type: String, required: true, unique: true },
    firstName: { type: String, required: false },
    lastName: { type: String, required: false },
    fullName: { type: String, required: false },
    name: { type: String, required: false }, // Backwards compatibility
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: false },
    passwordHash: { type: String, required: false },
    course: { type: String, default: 'General Science' },
    semester: { type: String, default: 'Semester 1' },
    profilePicture: { type: String },
    isActive: { type: Boolean, default: true },
    faceEnrolled: { type: Boolean, default: false },
    faceEnrolledAt: { type: Date },
    faceEmbeddings: { type: mongoose.Schema.Types.Mixed, default: [] }, // Stores 30 512d ArcFace embedding vectors
    descriptors: { type: mongoose.Schema.Types.Mixed, default: [] }, // Stores 30 128d FaceAPI neural descriptors
    averageDescriptor: { type: [Number], default: [] },
    registrationDate: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now },
    lastLogin: { type: Date },
    lastVerification: { type: Date },
    verificationStatus: { 
        type: String, 
        enum: ['Pending', 'Enrolled', 'Verified', 'Failed', 'Terminated'], 
        default: 'Enrolled' 
    }
}, { timestamps: true });

// Pre-save middleware to sync fullName & name, and hash password
studentSchema.pre('save', async function(next) {
    if (this.firstName && this.lastName) {
        this.fullName = `${this.firstName.trim()} ${this.lastName.trim()}`;
        this.name = this.fullName;
    } else if (this.name && !this.fullName) {
        this.fullName = this.name;
    }

    if (this.passwordHash && !this.password) {
        this.password = this.passwordHash;
    }

    // Password hashing
    if (this.isModified('password') && this.password) {
        try {
            const salt = await bcrypt.genSalt(10);
            const hashed = await bcrypt.hash(this.password, salt);
            this.password = hashed;
            this.passwordHash = hashed;
        } catch (error) {
            return next(error);
        }
    }
    next();
});

// Method to compare password
studentSchema.methods.comparePassword = async function(candidatePassword) {
    const passToCompare = this.password || this.passwordHash;
    if (!passToCompare) return false;
    return await bcrypt.compare(candidatePassword, passToCompare);
};

// Method to get public profile (remove sensitive info)
studentSchema.methods.getPublicProfile = function() {
    return {
        studentId: this.studentId,
        firstName: this.firstName,
        lastName: this.lastName,
        fullName: this.fullName || this.name,
        name: this.name || this.fullName,
        email: this.email,
        course: this.course,
        semester: this.semester,
        faceEnrolled: this.faceEnrolled,
        registrationDate: this.registrationDate || this.createdAt,
        verificationStatus: this.verificationStatus,
        createdAt: this.createdAt
    };
};

module.exports = mongoose.models.Student || mongoose.model('Student', studentSchema);