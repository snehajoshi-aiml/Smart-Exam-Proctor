const express = require('express');
const mongoose = require('mongoose');
mongoose.set('bufferCommands', false);
const cors = require('cors');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

const envPaths = [
  path.resolve(__dirname, '.env'),
  path.resolve(process.cwd(), 'backend/.env'),
  path.resolve(process.cwd(), '.env')
];
for (const p of envPaths) {
  if (fs.existsSync(p)) {
    require('dotenv').config({ path: p });
  }
}

const proctorApi = require('./routes/proctorApi');

// Import Mongoose Models
const LiveSession = require('./models/LiveSession');
const SuspiciousActivity = require('./models/SuspiciousActivity');

// Import additional packages
const session = require('express-session');
const MongoStore = require('connect-mongo');
const rateLimit = require('express-rate-limit');

// ==================== ENVIRONMENT CHECK ====================
console.log('🚀 Server Startup Environment Check:');
console.log(' - MONGODB_URI:', process.env.MONGODB_URI ? `Loaded (Length: ${process.env.MONGODB_URI.length})` : 'NOT SET');
console.log(' - JWT_SECRET:', process.env.JWT_SECRET ? 'Loaded' : 'NOT SET (using default)');
console.log(' - ARCFACE_API_KEY:', process.env.ARCFACE_API_KEY ? 'Loaded' : 'NOT SET');
console.log(' - REACT_APP_API_URL:', process.env.REACT_APP_API_URL ? process.env.REACT_APP_API_URL : 'NOT SET');

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5000';

// ==================== MEMORY & RESOURCE OPTIMIZATION (RENDER 512MB TIER) ====================
// Proactive memory management: monitor heap/RSS and run GC if available to strictly comply with 512MB limit
if (process.env.NODE_ENV === 'production' || process.env.RENDER) {
    setInterval(() => {
        try {
            const memory = process.memoryUsage();
            const heapUsedMB = Math.round(memory.heapUsed / 1024 / 1024);
            const rssMB = Math.round(memory.rss / 1024 / 1024);
            if (global.gc && (heapUsedMB > 160 || rssMB > 320)) {
                global.gc();
            }
        } catch (e) {}
    }, 30000);
}

// ==================== SECURITY & PERFORMANCE MIDDLEWARE ====================

// Security headers (Helmet)
if (process.env.ENABLE_HELMET === 'true') {
    const helmet = require('helmet');
    app.use(helmet({
        crossOriginResourcePolicy: { policy: "cross-origin" }
    }));
    console.log('🛡️ Helmet security headers enabled');
}

// Compression (Gzip)
if (process.env.ENABLE_COMPRESSION === 'true') {
    const compression = require('compression');
    app.use(compression());
    console.log('🗜️ Compression enabled');
}

// Rate limiting disabled for local development & continuous real-time proctoring telemetry
console.log(`⏱️ Rate limiting disabled for unlimited proctoring telemetry & admin access`);

// ==================== CORS ====================

const allowedOrigins = [
    'https://athena-proctor.vercel.app',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173'
];

const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests without Origin
        if (!origin) {
            return callback(null, true);
        }

        // Allow exact origins
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        // Allow Vercel preview deployments
        if (/^https:\/\/.*\.vercel\.app$/.test(origin)) {
            return callback(null, true);
        }

        // Keep compatibility with existing deployment
        return callback(null, true);
    },

    credentials: true,

    methods: [
        'GET',
        'POST',
        'PUT',
        'DELETE',
        'OPTIONS'
    ],

    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
        'Origin'
    ],

    optionsSuccessStatus: 204
};

app.use(cors(corsOptions));

// Explicitly handle browser preflight requests
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());


// Mount Admin API Router
const adminApi = require('./routes/adminApi');
app.use('/api/admin', adminApi);


// ==================== REAL-TIME EMAIL OTP ROUTES ====================
const crypto = require('crypto');
const { sendOtpEmail } = require('./services/emailService');

const otpStore = new Map();

const handleSendOtpRoute = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || typeof email !== 'string' || !email.includes('@')) {
            return res.status(400).json({ success: false, error: 'Valid email address is required' });
        }

        const cleanEmail = email.trim().toLowerCase();
        if (password && password.length < 3) {
            return res.status(401).json({ success: false, error: 'Invalid email or password' });
        }

        const studentId = 'STU_' + cleanEmail.replace(/[^a-z0-9]/g, '_');
        const emailPrefix = cleanEmail.split('@')[0];
        const studentName = emailPrefix
            .split(/[._-]/)
            .map(w => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');

        const now = Date.now();
        const otp = crypto.randomInt(100000, 999999).toString();
        const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');

        otpStore.set(cleanEmail, {
            hashedOtp,
            attempts: 0,
            expiresAt: now + 5 * 60 * 1000,
            lastSentAt: now,
            studentId,
            studentName
        });

        // Asynchronously dispatch email via pooled Nodemailer (non-blocking for instant client response)
        sendOtpEmail(cleanEmail, studentName, otp).then(() => {
            console.log(`✉️ Real-Time OTP email delivered to ${cleanEmail}`);
        }).catch((emailErr) => {
            console.warn(`✉️ Email delivery notice (${emailErr.message}). OTP Code generated: [${otp}]`);
        });

        console.log(`✉️ Real-Time OTP successfully generated and stored for ${cleanEmail}: ${otp}`);
        return res.json({
            success: true,
            message: `A 6-digit OTP has been dispatched to ${cleanEmail}`,
            email: cleanEmail,
            studentId,
            studentName,
            expiresInSeconds: 300
        });
    } catch (error) {
        console.error('Send OTP route error:', error);
        return res.status(500).json({ success: false, error: 'OTP request failed: ' + error.message });
    }
};

const handleVerifyOtpRoute = async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) {
            return res.status(400).json({ success: false, error: 'Email and 6-digit OTP code are required' });
        }

        const cleanEmail = email.trim().toLowerCase();
        const record = otpStore.get(cleanEmail);

        if (!record) {
            return res.status(400).json({
                success: false,
                error: 'No active OTP request found for this email. Please request a new OTP.'
            });
        }

        const now = Date.now();
        if (now > record.expiresAt) {
            otpStore.delete(cleanEmail);
            return res.status(400).json({
                success: false,
                expired: true,
                error: 'OTP has expired. Please request a new OTP.'
            });
        }

        if (record.attempts >= 5) {
            otpStore.delete(cleanEmail);
            return res.status(400).json({
                success: false,
                maxAttemptsReached: true,
                error: 'Maximum OTP verification attempts (5) exceeded. Please request a new OTP.'
            });
        }

        record.attempts += 1;

        const inputHashed = crypto.createHash('sha256').update(otp.toString().trim()).digest('hex');
        if (inputHashed !== record.hashedOtp) {
            const remainingAttempts = 5 - record.attempts;
            return res.status(400).json({
                success: false,
                error: `Invalid OTP code. (${remainingAttempts} attempt${remainingAttempts === 1 ? '' : 's'} remaining)`
            });
        }

        const { studentId, studentName } = record;
        otpStore.delete(cleanEmail);

        const otpToken = jwt.sign({
            email: cleanEmail,
            studentId,
            stage: 'otp_verified'
        }, JWT_SECRET, { expiresIn: '15m' });

        console.log(`✅ OTP Verification Successful for ${cleanEmail} (${studentId})`);

        return res.json({
            success: true,
            message: 'OTP verified successfully! Proceeding to Face Verification.',
            otpToken,
            student: {
                studentId,
                name: studentName,
                email: cleanEmail
            }
        });
    } catch (error) {
        console.error('Verify OTP route error:', error);
        return res.status(500).json({ success: false, error: 'OTP verification failed: ' + error.message });
    }
};

const handleResendOtpRoute = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email || !email.includes('@')) {
            return res.status(400).json({ success: false, error: 'Valid email address is required' });
        }

        const cleanEmail = email.trim().toLowerCase();
        const now = Date.now();


        const studentId = 'STU_' + cleanEmail.replace(/[^a-z0-9]/g, '_');
        const emailPrefix = cleanEmail.split('@')[0];
        const studentName = emailPrefix
            .split(/[._-]/)
            .map(w => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');

        const newOtp = crypto.randomInt(100000, 999999).toString();
        const hashedOtp = crypto.createHash('sha256').update(newOtp).digest('hex');

        otpStore.set(cleanEmail, {
            hashedOtp,
            attempts: 0,
            expiresAt: now + 5 * 60 * 1000,
            lastSentAt: now,
            studentId,
            studentName
        });

        try {
            await sendOtpEmail(cleanEmail, studentName, newOtp);
        } catch (emailErr) {
            console.error('Resend OTP email failed:', emailErr);
            otpStore.delete(cleanEmail);
            return res.status(500).json({
                success: false,
                error: 'Unable to resend OTP email. Please try again.'
            });
        }

        console.log(`🔄 Brand new OTP sent to ${cleanEmail}`);
        return res.json({
            success: true,
            message: `A new 6-digit OTP has been sent to ${cleanEmail}`,
            email: cleanEmail,
            cooldownSeconds: 60
        });
    } catch (error) {
        console.error('Resend OTP route error:', error);
        return res.status(500).json({ success: false, error: 'Resend OTP failed: ' + error.message });
    }
};

// Register Top-Level Direct Express Routes
const {
    sendOtp,
    verifyOtp,
    resendOtp,
    forgotPassword,
    verifyResetToken,
    resetPasswordWithToken,
    resetPassword
} = require('./controllers/otpController');

app.post('/api/auth/send-otp', sendOtp);
app.post('/api/send-otp', sendOtp);

app.post('/api/auth/verify-otp', verifyOtp);
app.post('/api/verify-otp', verifyOtp);

app.post('/api/auth/resend-otp', resendOtp);
app.post('/api/resend-otp', resendOtp);

app.post('/api/auth/forgot-password', forgotPassword);
app.post('/api/forgot-password', forgotPassword);
app.post('/api/otp/forgot-password', forgotPassword);

app.get('/api/auth/verify-reset-token', verifyResetToken);
app.post('/api/auth/verify-reset-token', verifyResetToken);
app.get('/api/verify-reset-token', verifyResetToken);
app.post('/api/verify-reset-token', verifyResetToken);

app.post('/api/auth/reset-password-with-token', resetPasswordWithToken);
app.post('/api/reset-password-with-token', resetPasswordWithToken);
app.post('/api/otp/reset-password-with-token', resetPasswordWithToken);

app.post('/api/auth/reset-password', resetPassword);
app.post('/api/reset-password', resetPassword);
app.post('/api/otp/reset-password', resetPassword);

// Session configuration with memory fallback
let sessionStore;
try {
    if (process.env.MONGODB_URI) {
        sessionStore = MongoStore.create({
            mongoUrl: process.env.MONGODB_URI,
            ttl: parseInt(process.env.SESSION_MAX_AGE) / 1000 || 86400,
            autoRemove: 'native',
            touchAfter: 24 * 3600
        });
    }
} catch (e) {
    console.warn('⚠️ Session store using MemoryStore fallback');
}

app.use(session({
    secret: process.env.SESSION_SECRET || 'session-secret-key',
    resave: false,
    saveUninitialized: false,
    ...(sessionStore ? { store: sessionStore } : {}),
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: parseInt(process.env.SESSION_MAX_AGE) || 86400000,
        sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax'
    },
    name: 'sessionId'
}));
console.log('🔐 Session management initialized');

// Static files - Serve public assets
app.use(express.static(path.join(__dirname, 'public')));

// Helper: Prune screenshots directory to strictly enforce Render 512MB storage limit (cap at 25MB / 50 files)
function pruneScreenshotsDir(dirPath, maxFiles = 50, maxTotalBytes = 25 * 1024 * 1024) {
  try {
    if (!fs.existsSync(dirPath)) return;
    const entries = fs.readdirSync(dirPath).map(file => {
      try {
        const fullPath = path.join(dirPath, file);
        const stats = fs.statSync(fullPath);
        return { file, fullPath, size: stats.size, mtime: stats.mtimeMs };
      } catch (e) {
        return null;
      }
    }).filter(Boolean);

    let totalSize = entries.reduce((acc, curr) => acc + curr.size, 0);

    if (entries.length > maxFiles || totalSize > maxTotalBytes) {
      entries.sort((a, b) => a.mtime - b.mtime);
      while ((entries.length > maxFiles || totalSize > maxTotalBytes) && entries.length > 0) {
        const oldest = entries.shift();
        try {
          fs.unlinkSync(oldest.fullPath);
          totalSize -= oldest.size;
        } catch (delErr) {}
      }
    }
  } catch (err) {
    console.warn('⚠️ Disk prune notice:', err.message);
  }
}

// Create necessary directories
const screenshotsDir = path.join(__dirname, 'screenshots');
if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
    console.log('📸 Screenshots directory created');
}
// Run disk prune on startup and every 15 minutes
pruneScreenshotsDir(screenshotsDir);
setInterval(() => pruneScreenshotsDir(screenshotsDir), 15 * 60 * 1000);

// ==================== DATABASE CONNECTION ====================
let cachedDBPromise = null;

const connectDB = async () => {
    if (mongoose.connection.readyState === 1) {
        return mongoose.connection;
    }
    if (cachedDBPromise) {
        return cachedDBPromise;
    }
    try {
        const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/smart-proctoring';
        const isAtlas = mongoUri.includes('mongodb+srv') || mongoUri.includes('mongodb.net');
        console.log(`🔌 [MongoDB Server] Connecting to: ${isAtlas ? 'MongoDB Atlas Cluster' : mongoUri}...`);

        cachedDBPromise = mongoose.connect(mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            maxPoolSize: parseInt(process.env.DB_POOL_SIZE) || 10,
            serverSelectionTimeoutMS: 10000,
        }).then(conn => {
            console.log(`✅ MongoDB Connected: ${conn.connection.host} [Database: ${conn.connection.name}]`);
            return conn;
        }).catch(err => {
            cachedDBPromise = null;
            console.error(`❌ MongoDB Connection Error: ${err.message}`);
            return null;
        });

        return await cachedDBPromise;
    } catch (error) {
        cachedDBPromise = null;
        console.error(`❌ MongoDB Failed: ${error.message}`);
        return null;
    }
};

// Initiate non-blocking connection on server boot
connectDB().catch(() => {});

// Attach connectDB to Express app instance for Serverless / Vercel handlers
app.connectDB = connectDB;

// Middleware to ensure active DB connection before handling requests
app.use(async (req, res, next) => {
    if (mongoose.connection.readyState !== 1) {
        try {
            await connectDB();
        } catch (err) {
            console.warn('⚠️ DB Connection Middleware Notice:', err.message);
        }
    }
    next();
});



// ==================== MODELS ====================

// Student Model
const studentSchema = new mongoose.Schema({
    studentId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    course: { type: String, required: true },
    semester: { type: String, required: true },
    profilePicture: { type: String },
    createdAt: { type: Date, default: Date.now },
    lastLogin: { type: Date }
});

// Proctoring Log Model
const proctoringLogSchema = new mongoose.Schema({
    studentId: { type: String, required: true, index: true },
    examId: { type: String, required: true },
    sessionId: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    violationType: { 
        type: String, 
        required: true,
        enum: ['tab_switch', 'multiple_faces', 'no_face', 'phone_detected', 'voice_detected', 'looking_away', 'fullscreen_exit', 'exam_terminated', 'exam_submitted', 'info', 'eye_movement', 'gaze_shift', 'copy_paste_attempt', 'right_click', 'dev_tools', 'keyboard_shortcut', 'window_resize', 'page_lock_triggered']
    },
    severity: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    details: { type: mongoose.Schema.Types.Mixed },
    screenshot: { type: String },
    ipAddress: { type: String },
    userAgent: { type: String },
    createdAt: { type: Date, default: Date.now }
});

// Exam Session Model
const examSessionSchema = new mongoose.Schema({
    studentId: { type: String, required: true },
    studentName: { type: String },
    examId: { type: String, required: true },
    sessionId: { type: String, required: true, unique: true },
    startTime: { type: Date, default: Date.now },
    endTime: { type: Date },
    status: { type: String, enum: ['active', 'terminated', 'completed'], default: 'active' },
    totalViolations: { type: Number, default: 0 },
    tabSwitches: { type: Number, default: 0 },
    copyPasteAttempts: { type: Number, default: 0 },
    rightClickAttempts: { type: Number, default: 0 },
    devToolsAttempts: { type: Number, default: 0 },
    windowResizes: { type: Number, default: 0 },
    pageLockTriggers: { type: Number, default: 0 },
    fullscreenExits: { type: Number, default: 0 },
    answers: { type: Map, of: String },
    score: { type: Number },
    ipAddress: { type: String },
    userAgent: { type: String },
    deviceInfo: { type: mongoose.Schema.Types.Mixed },
    browserInfo: { type: String },
    proctoringData: { type: mongoose.Schema.Types.Mixed },
    securityViolations: [{
        type: { type: String },
        timestamp: { type: Date, default: Date.now },
        details: { type: String }
    }]
});

// Create indexes for better query performance
proctoringLogSchema.index({ studentId: 1, examId: 1, timestamp: -1 });
proctoringLogSchema.index({ sessionId: 1 });
examSessionSchema.index({ studentId: 1, examId: 1, startTime: -1 });
examSessionSchema.index({ sessionId: 1 });

const Student = mongoose.models.Student || mongoose.model('Student', studentSchema);
const ProctoringLog = mongoose.models.ProctoringLog || mongoose.model('ProctoringLog', proctoringLogSchema);
const ExamSession = mongoose.models.ExamSession || mongoose.model('ExamSession', examSessionSchema);

// DEVELOPMENT MODE ONLY - REMOVE BEFORE PRODUCTION
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    const mockUser = {
        studentId: 'STU_' + Date.now(),
        name: 'Student',
        email: 'student@proctor.com',
        role: 'Student'
    };

    if (!token) {
        req.user = mockUser;
        return next();
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            req.user = mockUser;
            return next();
        }
        req.user = user;
        next();
    });
};

// Mount proctoring & auth API routes (face, OTP, violations, sessions, detection)
const faceRoutes = require('./routes/faceRoutes');
app.use('/api', faceRoutes);
app.use('/api/face', faceRoutes);
app.use('/api', proctorApi);
app.use('/api/auth', proctorApi);
app.use('/', proctorApi);


// STEP 8: Deployment health endpoint
const handleHealthCheck = async (req, res) => {
    if (mongoose.connection.readyState !== 1 && (process.env.MONGODB_URI || process.env.MONGO_URL)) {
        await connectDB().catch(() => {});
    }
    const isMongoConnected = mongoose.connection.readyState === 1;
    res.json({ 
        status: "ok", 
        mongodb: isMongoConnected,
        faceVerification: true,
        deployment: process.env.VERCEL ? "production" : (process.env.NODE_ENV || "production")
    });
};
app.get('/api/health', handleHealthCheck);
app.get('/health', handleHealthCheck);



// Mount Dedicated Professional OTP Routes
app.use('/api/otp', require('./routes/otpRoutes'));

// Root endpoint
app.get('/', (req, res) => {
    res.json({ 
        message: '🎓 Smart Proctoring System API',
        version: '2.0.0',
        status: 'active',
        endpoints: {
            auth: {
                register: 'POST /api/register',
                login: 'POST /api/login',
                profile: 'GET /api/student/profile'
            },
            exam: {
                start: 'POST /api/exam/start',
                submit: 'POST /api/exam/submit',
                session: 'GET /api/exam/session/:sessionId'
            },
            proctoring: {
                log: 'POST /api/proctoring/log/:examId',
                suspicious: 'POST /api/log-suspicious-activity',
                screenshot: 'POST /api/capture-screenshot',
                logs: 'GET /api/proctoring/logs',
                stats: 'GET /api/proctoring/stats',
                status: 'GET /api/proctoring/status',
                session: 'POST /api/proctoring/session'
            },
            security: {
                logViolation: 'POST /api/security/violation',
                getStatus: 'GET /api/security/status/:sessionId',
                logCopyPaste: 'POST /api/security/copy-paste',
                logRightClick: 'POST /api/security/right-click',
                logDevTools: 'POST /api/security/dev-tools',
                logWindowResize: 'POST /api/security/window-resize',
                logPageLock: 'POST /api/security/page-lock',
                getSecurityLogs: 'GET /api/security/logs/:studentId'
            },
            dashboard: {
                get: 'GET /api/dashboard/:studentId'
            },
            admin: {
                violations: 'GET /api/admin/violations',
                export: 'GET /api/admin/export/:examId',
                securityReport: 'GET /api/admin/security-report'
            },
            health: 'GET /api/health',
            examPage: 'GET /exam'
        }
    });
});

// ==================== NEW SECURITY FEATURE ENDPOINTS ====================

/**
 * LOG SECURITY VIOLATIONS (Copy-Paste, Right-Click, Dev Tools, etc.)
 */
app.post('/api/security/violation', authenticateToken, async (req, res) => {
    try {
        const { examId, sessionId, violationType, details, severity } = req.body;
        
        if (!examId || !violationType) {
            return res.status(400).json({ error: 'Exam ID and violation type are required' });
        }
        
        // Get active session
        let session = await ExamSession.findOne({
            studentId: req.user.studentId,
            examId,
            status: 'active'
        }).sort({ startTime: -1 });
        
        if (!session) {
            // Try to find by sessionId if provided
            if (sessionId) {
                session = await ExamSession.findOne({ sessionId });
            }
            
            if (!session) {
                return res.status(404).json({ error: 'No active exam session found' });
            }
        }
        
        // Determine severity if not provided
        let finalSeverity = severity || 'medium';
        const highSeverity = ['copy_paste_attempt', 'right_click', 'dev_tools', 'page_lock_triggered', 'multiple_faces', 'phone_detected'];
        const mediumSeverity = ['tab_switch', 'window_resize', 'fullscreen_exit', 'eye_movement', 'looking_away'];
        const lowSeverity = ['info', 'gaze_shift'];
        
        if (highSeverity.includes(violationType)) finalSeverity = 'high';
        else if (mediumSeverity.includes(violationType)) finalSeverity = 'medium';
        else if (lowSeverity.includes(violationType)) finalSeverity = 'low';
        
        // Update session counters for specific violation types
        const violationCounters = {
            'copy_paste_attempt': 'copyPasteAttempts',
            'right_click': 'rightClickAttempts',
            'dev_tools': 'devToolsAttempts',
            'window_resize': 'windowResizes',
            'page_lock_triggered': 'pageLockTriggers',
            'fullscreen_exit': 'fullscreenExits'
        };
        
        if (violationCounters[violationType]) {
            session[violationCounters[violationType]] = (session[violationCounters[violationType]] || 0) + 1;
        }
        
        // Track tab switches separately
        if (violationType === 'tab_switch') {
            session.tabSwitches = (session.tabSwitches || 0) + 1;
        }
        
        // Create log entry
        const log = new ProctoringLog({
            studentId: req.user.studentId,
            examId,
            sessionId: session.sessionId,
            violationType,
            severity: finalSeverity,
            details: {
                ...details,
                timestamp: new Date().toISOString(),
                userAgent: req.headers['user-agent'],
                ipAddress: req.ip
            },
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });
        
        await log.save();
        
        // Add to security violations array
        session.securityViolations.push({
            type: violationType,
            timestamp: new Date(),
            details: details?.message || details?.reason || violationType
        });
        
        // Update total violations
        session.totalViolations += 1;
        await session.save();
        
        console.log(`🔒 Security violation: ${violationType} for ${req.user.studentId} (Total: ${session.totalViolations})`);
        
        // Check if exam should be terminated (after 10 violations)
        const maxViolations = process.env.MAX_VIOLATIONS || 10;
        if (session.totalViolations >= maxViolations) {
            session.status = 'terminated';
            await session.save();
            
            // Log termination event
            const terminationLog = new ProctoringLog({
                studentId: req.user.studentId,
                examId,
                sessionId: session.sessionId,
                violationType: 'exam_terminated',
                severity: 'high',
                details: {
                    reason: `Maximum violations exceeded (${session.totalViolations}/${maxViolations})`,
                    totalViolations: session.totalViolations,
                    violations: session.securityViolations.slice(-5) // Last 5 violations
                },
                ipAddress: req.ip,
                userAgent: req.headers['user-agent']
            });
            await terminationLog.save();
            
            return res.json({ 
                success: true, 
                terminated: true, 
                message: `Exam terminated due to excessive violations (${session.totalViolations}/${maxViolations})`,
                totalViolations: session.totalViolations,
                violationDetails: {
                    copyPaste: session.copyPasteAttempts || 0,
                    rightClicks: session.rightClickAttempts || 0,
                    devTools: session.devToolsAttempts || 0,
                    tabSwitches: session.tabSwitches || 0,
                    windowResizes: session.windowResizes || 0,
                    pageLocks: session.pageLockTriggers || 0
                }
            });
        }
        
        res.json({ 
            success: true, 
            violationCount: session.totalViolations,
            severity: finalSeverity,
            violationType: violationType,
            message: 'Security violation logged successfully'
        });
        
    } catch (error) {
        console.error('Security violation error:', error);
        res.status(500).json({ error: 'Failed to log security violation: ' + error.message });
    }
});

/**
 * LOG COPY-PASTE ATTEMPTS
 */
app.post('/api/security/copy-paste', authenticateToken, async (req, res) => {
    try {
        const { examId, action, details } = req.body;
        
        const logEntry = {
            examId: examId || 'unknown',
            violationType: 'copy_paste_attempt',
            details: {
                action: action || 'unknown',
                message: details || `${action} attempt detected`,
                timestamp: new Date().toISOString()
            },
            severity: 'high'
        };
        
        // Forward to main violation endpoint
        req.body = logEntry;
        return app._router.handle(req, res, (err) => {
            if (err) {
                console.error('Error in copy-paste handler:', err);
                res.status(500).json({ error: 'Failed to log copy-paste attempt' });
            }
        });
        
    } catch (error) {
        console.error('Copy-paste log error:', error);
        res.status(500).json({ error: 'Failed to log copy-paste attempt' });
    }
});

/**
 * LOG RIGHT-CLICK ATTEMPTS
 */
app.post('/api/security/right-click', authenticateToken, async (req, res) => {
    try {
        const { examId, details } = req.body;
        
        const logEntry = {
            examId: examId || 'unknown',
            violationType: 'right_click',
            details: {
                message: details || 'Right-click attempt detected',
                timestamp: new Date().toISOString()
            },
            severity: 'high'
        };
        
        req.body = logEntry;
        return app._router.handle(req, res, (err) => {
            if (err) {
                console.error('Error in right-click handler:', err);
                res.status(500).json({ error: 'Failed to log right-click attempt' });
            }
        });
        
    } catch (error) {
        console.error('Right-click log error:', error);
        res.status(500).json({ error: 'Failed to log right-click attempt' });
    }
});

/**
 * LOG DEV TOOLS ATTEMPTS
 */
app.post('/api/security/dev-tools', authenticateToken, async (req, res) => {
    try {
        const { examId, details } = req.body;
        
        const logEntry = {
            examId: examId || 'unknown',
            violationType: 'dev_tools',
            details: {
                message: details || 'Developer tools attempt detected',
                timestamp: new Date().toISOString()
            },
            severity: 'high'
        };
        
        req.body = logEntry;
        return app._router.handle(req, res, (err) => {
            if (err) {
                console.error('Error in dev-tools handler:', err);
                res.status(500).json({ error: 'Failed to log dev tools attempt' });
            }
        });
        
    } catch (error) {
        console.error('Dev tools log error:', error);
        res.status(500).json({ error: 'Failed to log dev tools attempt' });
    }
});

/**
 * LOG WINDOW RESIZE ATTEMPTS
 */
app.post('/api/security/window-resize', authenticateToken, async (req, res) => {
    try {
        const { examId, details } = req.body;
        
        const logEntry = {
            examId: examId || 'unknown',
            violationType: 'window_resize',
            details: {
                message: details || 'Window resize detected',
                timestamp: new Date().toISOString()
            },
            severity: 'medium'
        };
        
        req.body = logEntry;
        return app._router.handle(req, res, (err) => {
            if (err) {
                console.error('Error in window-resize handler:', err);
                res.status(500).json({ error: 'Failed to log window resize' });
            }
        });
        
    } catch (error) {
        console.error('Window resize log error:', error);
        res.status(500).json({ error: 'Failed to log window resize' });
    }
});

/**
 * LOG PAGE LOCK TRIGGERS
 */
app.post('/api/security/page-lock', authenticateToken, async (req, res) => {
    try {
        const { examId, details } = req.body;
        
        const logEntry = {
            examId: examId || 'unknown',
            violationType: 'page_lock_triggered',
            details: {
                message: details || 'Page lock triggered - user attempted to leave page',
                timestamp: new Date().toISOString()
            },
            severity: 'high'
        };
        
        req.body = logEntry;
        return app._router.handle(req, res, (err) => {
            if (err) {
                console.error('Error in page-lock handler:', err);
                res.status(500).json({ error: 'Failed to log page lock' });
            }
        });
        
    } catch (error) {
        console.error('Page lock log error:', error);
        res.status(500).json({ error: 'Failed to log page lock' });
    }
});

/**
 * GET SECURITY STATUS FOR A SESSION
 */
app.get('/api/security/status/:sessionId', authenticateToken, async (req, res) => {
    try {
        const { sessionId } = req.params;
        
        const session = await ExamSession.findOne({ sessionId });
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }
        
        // Check authorization
        if (session.studentId !== req.user.studentId) {
            return res.status(403).json({ error: 'Unauthorized access' });
        }
        
        // Get recent security violations
        const securityViolations = await ProctoringLog.find({
            sessionId,
            violationType: { $in: ['copy_paste_attempt', 'right_click', 'dev_tools', 'page_lock_triggered', 'window_resize'] }
        }).sort({ timestamp: -1 }).limit(20);
        
        res.json({
            success: true,
            sessionId: session.sessionId,
            status: session.status,
            totalViolations: session.totalViolations,
            securityStats: {
                copyPasteAttempts: session.copyPasteAttempts || 0,
                rightClickAttempts: session.rightClickAttempts || 0,
                devToolsAttempts: session.devToolsAttempts || 0,
                tabSwitches: session.tabSwitches || 0,
                windowResizes: session.windowResizes || 0,
                pageLockTriggers: session.pageLockTriggers || 0,
                fullscreenExits: session.fullscreenExits || 0
            },
            recentViolations: securityViolations,
            isTerminated: session.status === 'terminated'
        });
        
    } catch (error) {
        console.error('Security status error:', error);
        res.status(500).json({ error: 'Failed to fetch security status: ' + error.message });
    }
});

/**
 * GET SECURITY LOGS FOR A STUDENT
 */
app.get('/api/security/logs/:studentId', authenticateToken, async (req, res) => {
    try {
        const { studentId } = req.params;
        const { limit = 50, type } = req.query;
        
        // Check authorization
        if (req.user.studentId !== studentId && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Unauthorized access' });
        }
        
        let query = { studentId };
        
        // Filter by security violation types
        const securityTypes = ['copy_paste_attempt', 'right_click', 'dev_tools', 'page_lock_triggered', 'window_resize'];
        if (type === 'security') {
            query.violationType = { $in: securityTypes };
        } else if (type) {
            query.violationType = type;
        }
        
        const logs = await ProctoringLog.find(query)
            .sort({ timestamp: -1 })
            .limit(parseInt(limit));
        
        const total = await ProctoringLog.countDocuments(query);
        
        res.json({
            success: true,
            logs: logs,
            total: total,
            limit: parseInt(limit)
        });
        
    } catch (error) {
        console.error('Security logs error:', error);
        res.status(500).json({ error: 'Failed to fetch security logs: ' + error.message });
    }
});

/**
 * ADMIN - GET SECURITY REPORT
 */
app.get('/api/admin/security-report', authenticateToken, async (req, res) => {
    try {
        // Check if user is admin (you can implement proper admin check)
        const isAdmin = req.user.role === 'admin' || req.user.email === 'admin@system.com';
        if (!isAdmin) {
            return res.status(403).json({ error: 'Admin access required' });
        }
        
        const { examId, from, to } = req.query;
        
        let query = {};
        if (examId) query.examId = examId;
        if (from || to) {
            query.timestamp = {};
            if (from) query.timestamp.$gte = new Date(from);
            if (to) query.timestamp.$lte = new Date(to);
        }
        
        // Security violation types
        const securityTypes = ['copy_paste_attempt', 'right_click', 'dev_tools', 'page_lock_triggered', 'window_resize'];
        query.violationType = { $in: securityTypes };
        
        const securityLogs = await ProctoringLog.find(query)
            .sort({ timestamp: -1 })
            .limit(1000);
        
        // Group by violation type
        const grouped = securityLogs.reduce((acc, log) => {
            const type = log.violationType;
            if (!acc[type]) acc[type] = [];
            acc[type].push(log);
            return acc;
        }, {});
        
        // Get summary stats
        const summary = Object.keys(grouped).map(type => ({
            type: type,
            count: grouped[type].length,
            students: [...new Set(grouped[type].map(l => l.studentId))].length,
            recent: grouped[type].slice(0, 10)
        }));
        
        res.json({
            success: true,
            totalViolations: securityLogs.length,
            summary: summary,
            details: securityLogs.slice(0, 100),
            filters: { examId, from, to }
        });
        
    } catch (error) {
        console.error('Security report error:', error);
        res.status(500).json({ error: 'Failed to generate security report: ' + error.message });
    }
});

// Student Registration
app.post('/api/register', async (req, res) => {
    try {
        const { studentId, name, email, password, course, semester } = req.body;
        
        console.log('Registration attempt:', { studentId, name, email, course, semester });
        
        // Validate input
        if (!studentId || !name || !email || !password || !course || !semester) {
            return res.status(400).json({ error: 'All fields are required' });
        }
        
        // Check if student already exists
        const existingStudent = await Student.findOne({ $or: [{ studentId }, { email }] });
        if (existingStudent) {
            return res.status(400).json({ error: 'Student ID or Email already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Create new student
        const student = new Student({
            studentId,
            name,
            email,
            password: hashedPassword,
            course,
            semester,
            lastLogin: new Date()
        });
        
        await student.save();
        
        // Create token
        const token = jwt.sign(
            { studentId: student.studentId, name: student.name, email: student.email }, 
            JWT_SECRET, 
            { expiresIn: process.env.JWT_EXPIRY || '24h' }
        );
        
        console.log(`✅ User registered: ${email}`);
        
        res.status(201).json({
            success: true,
            message: 'Registration successful',
            token,
            student: {
                studentId: student.studentId,
                name: student.name,
                email: student.email,
                course: student.course,
                semester: student.semester
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed: ' + error.message });
    }
});

// DEVELOPMENT MODE ONLY - REMOVE BEFORE PRODUCTION
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        console.log('⚡ [DEVELOPMENT MODE ONLY] Auto-authenticating login for:', email || 'demo@student.com');
        
        const mockStudent = {
            studentId: 'STU_' + Date.now(),
            name: email ? email.split('@')[0] : 'Student',
            email: email || 'student@proctor.com',
            role: 'Student',
            course: 'Computer Science',
            semester: 'Semester 1',
            faceEnrolled: true
        };

        // Generate dummy JWT token for development
        const token = jwt.sign(
            { studentId: mockStudent.studentId, name: mockStudent.name, email: mockStudent.email, role: mockStudent.role }, 
            JWT_SECRET, 
            { expiresIn: '24h' }
        );
        
        res.json({
            success: true,
            message: 'Development mode login successful',
            token,
            student: mockStudent
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed: ' + error.message });
    }
});

// Logout endpoint
app.post('/api/logout', authenticateToken, (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Logout failed' });
        }
        res.json({ success: true, message: 'Logged out successfully' });
    });
});

// Start Exam Session
app.post('/api/exam/start', authenticateToken, async (req, res) => {
    try {
        const { examId } = req.body;
        
        if (!examId) {
            return res.status(400).json({ error: 'Exam ID is required' });
        }
        
        const sessionId = `${req.user.studentId}_${examId}_${Date.now()}`;
        
        // Get student details
        const student = await Student.findOne({ studentId: req.user.studentId });
        
        // Get device info
        const userAgent = req.headers['user-agent'];
        
        const session = new ExamSession({
            studentId: req.user.studentId,
            studentName: student?.name,
            examId,
            sessionId,
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: userAgent,
            deviceInfo: {
                platform: req.headers['sec-ch-ua-platform'] || 'Unknown',
                mobile: req.headers['sec-ch-ua-mobile'] || '?0',
                browser: req.headers['sec-ch-ua'] || 'Unknown'
            },
            browserInfo: userAgent,
            status: 'active',
            copyPasteAttempts: 0,
            rightClickAttempts: 0,
            devToolsAttempts: 0,
            windowResizes: 0,
            pageLockTriggers: 0,
            fullscreenExits: 0,
            securityViolations: []
        });
        
        await session.save();
        
        console.log(`📝 Exam started: ${sessionId} for student ${req.user.studentId}`);
        
        res.json({
            success: true,
            message: 'Exam session started',
            sessionId,
            examId,
            startTime: session.startTime,
            securityFeatures: {
                copyPasteLock: true,
                pageLock: true,
                screenLock: true,
                fullscreenEnforcement: true,
                rightClickBlock: true,
                devToolsBlock: true,
                keyboardShortcutsBlock: true
            }
        });
    } catch (error) {
        console.error('Start exam error:', error);
        res.status(500).json({ error: 'Failed to start exam: ' + error.message });
    }
});

// Log Proctoring Violation
app.post('/api/proctoring/log/:examId', authenticateToken, async (req, res) => {
    try {
        const { examId } = req.params;
        const { violationType, details, screenshot } = req.body;
        
        if (!violationType) {
            return res.status(400).json({ error: 'Violation type is required' });
        }
        
        // Get active session
        const session = await ExamSession.findOne({
            studentId: req.user.studentId,
            examId,
            status: 'active'
        }).sort({ startTime: -1 });
        
        if (!session) {
            return res.status(404).json({ error: 'No active exam session found' });
        }
        
        // Determine severity
        let severity = 'low';
        const highSeverity = ['multiple_faces', 'phone_detected', 'exam_terminated', 'copy_paste_attempt', 'right_click', 'dev_tools', 'page_lock_triggered'];
        const mediumSeverity = ['tab_switch', 'voice_detected', 'looking_away', 'fullscreen_exit', 'no_face', 'eye_movement', 'gaze_shift', 'window_resize'];
        
        if (highSeverity.includes(violationType)) severity = 'high';
        else if (mediumSeverity.includes(violationType)) severity = 'medium';
        
        // Track tab switches separately
        if (violationType === 'tab_switch') {
            session.tabSwitches = (session.tabSwitches || 0) + 1;
        }
        
        // Track security violations
        const securityTypes = ['copy_paste_attempt', 'right_click', 'dev_tools', 'page_lock_triggered', 'window_resize'];
        if (securityTypes.includes(violationType)) {
            const counterMap = {
                'copy_paste_attempt': 'copyPasteAttempts',
                'right_click': 'rightClickAttempts',
                'dev_tools': 'devToolsAttempts',
                'window_resize': 'windowResizes',
                'page_lock_triggered': 'pageLockTriggers'
            };
            if (counterMap[violationType]) {
                session[counterMap[violationType]] = (session[counterMap[violationType]] || 0) + 1;
            }
            
            // Add to security violations array
            session.securityViolations.push({
                type: violationType,
                timestamp: new Date(),
                details: details?.message || details?.reason || violationType
            });
        }
        
        // Create log entry
        const log = new ProctoringLog({
            studentId: req.user.studentId,
            examId,
            sessionId: session.sessionId,
            violationType,
            severity,
            details: {
                ...details,
                timestamp: new Date().toISOString(),
                userAgent: req.headers['user-agent']
            },
            screenshot: screenshot || null,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });
        
        await log.save();
        
        // Update session violation count
        session.totalViolations += 1;
        await session.save();
        
        console.log(`⚠️ Violation: ${violationType} for ${req.user.studentId} (Total: ${session.totalViolations})`);
        
        // Check if exam should be terminated (after 10 violations)
        const maxViolations = process.env.MAX_VIOLATIONS || 10;
        if (session.totalViolations >= maxViolations) {
            session.status = 'terminated';
            await session.save();
            
            // Log termination event
            const terminationLog = new ProctoringLog({
                studentId: req.user.studentId,
                examId,
                sessionId: session.sessionId,
                violationType: 'exam_terminated',
                severity: 'high',
                details: {
                    reason: `Maximum violations exceeded (${session.totalViolations}/${maxViolations})`,
                    totalViolations: session.totalViolations,
                    securityStats: {
                        copyPaste: session.copyPasteAttempts || 0,
                        rightClicks: session.rightClickAttempts || 0,
                        devTools: session.devToolsAttempts || 0,
                        tabSwitches: session.tabSwitches || 0,
                        windowResizes: session.windowResizes || 0,
                        pageLocks: session.pageLockTriggers || 0
                    }
                },
                ipAddress: req.ip,
                userAgent: req.headers['user-agent']
            });
            await terminationLog.save();
            
            return res.json({ 
                success: true, 
                terminated: true, 
                message: `Exam terminated due to excessive violations (${session.totalViolations}/${maxViolations})`,
                totalViolations: session.totalViolations,
                securityStats: {
                    copyPaste: session.copyPasteAttempts || 0,
                    rightClicks: session.rightClickAttempts || 0,
                    devTools: session.devToolsAttempts || 0,
                    tabSwitches: session.tabSwitches || 0,
                    windowResizes: session.windowResizes || 0,
                    pageLocks: session.pageLockTriggers || 0
                }
            });
        }
        
        res.json({ 
            success: true, 
            violationCount: session.totalViolations,
            severity: severity,
            message: 'Violation logged successfully'
        });
    } catch (error) {
        console.error('Log violation error:', error);
        res.status(500).json({ error: 'Failed to log violation: ' + error.message });
    }
});

// ==================== NEW ENHANCED PROCTORING API ENDPOINTS ====================

// Log suspicious activity from enhanced proctoring (phone detection, eye movement)
app.post('/api/log-suspicious-activity', authenticateToken, async (req, res) => {
    try {
        const { type, message, activities, timestamp, alertCount } = req.body;
        
        console.log(`[${type}] ${message} at ${timestamp}`);
        
        // Get active exam session
        let examId = req.body.examId || 'unknown';
        let sessionId = req.body.sessionId || 'unknown';
        
        // Try to find active session
        const activeSession = await ExamSession.findOne({
            studentId: req.user.studentId,
            status: 'active'
        }).sort({ startTime: -1 });
        
        if (activeSession) {
            examId = activeSession.examId;
            sessionId = activeSession.sessionId;
        }
        
        // Determine violation type based on message
        let violationType = 'phone_detected';
        let severity = 'medium';
        
        if (type === 'eye_movement' || message.includes('eye') || message.includes('gaze') || message.includes('looking away')) {
            violationType = 'eye_movement';
            severity = 'medium';
        } else if (type === 'head_movement' || message.includes('head') || message.includes('Head')) {
            violationType = 'looking_away';
            severity = 'medium';
        } else if (message.includes('copy') || message.includes('paste')) {
            violationType = 'copy_paste_attempt';
            severity = 'high';
        } else if (message.includes('Tab') || message.includes('window')) {
            violationType = 'tab_switch';
            severity = 'medium';
        } else if (message.includes('Right-click') || message.includes('Developer')) {
            violationType = 'right_click';
            severity = 'high';
        } else if (message.includes('Mobile device')) {
            violationType = 'phone_detected';
            severity = 'high';
        } else if (message.includes('Excessive eye movement')) {
            violationType = 'eye_movement';
            severity = 'medium';
        } else if (message.includes('gaze shift')) {
            violationType = 'gaze_shift';
            severity = 'low';
        } else if (message.includes('Page') || message.includes('locked')) {
            violationType = 'page_lock_triggered';
            severity = 'high';
        } else if (message.includes('resize') || message.includes('minimize') || message.includes('maximize')) {
            violationType = 'window_resize';
            severity = 'medium';
        }
        
        // Create proctoring log
        const log = new ProctoringLog({
            studentId: req.user.studentId,
            examId: examId,
            sessionId: sessionId,
            violationType: violationType,
            severity: severity,
            details: {
                type: type,
                message: message,
                activities: activities,
                alertCount: alertCount || 1,
                timestamp: timestamp || new Date().toISOString()
            },
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.headers['user-agent']
        });
        
        await log.save();
        
        // Update session violation count if session exists
        if (activeSession) {
            activeSession.totalViolations += 1;
            
            // Track specific violations
            const securityTypes = ['copy_paste_attempt', 'right_click', 'dev_tools', 'page_lock_triggered', 'window_resize'];
            if (securityTypes.includes(violationType)) {
                const counterMap = {
                    'copy_paste_attempt': 'copyPasteAttempts',
                    'right_click': 'rightClickAttempts',
                    'dev_tools': 'devToolsAttempts',
                    'window_resize': 'windowResizes',
                    'page_lock_triggered': 'pageLockTriggers'
                };
                if (counterMap[violationType]) {
                    activeSession[counterMap[violationType]] = (activeSession[counterMap[violationType]] || 0) + 1;
                }
                
                activeSession.securityViolations.push({
                    type: violationType,
                    timestamp: new Date(),
                    details: message
                });
            }
            
            if (violationType === 'tab_switch') {
                activeSession.tabSwitches = (activeSession.tabSwitches || 0) + 1;
            }
            
            await activeSession.save();
            
            // Check if exam should be terminated
            const maxViolations = process.env.MAX_VIOLATIONS || 10;
            if (activeSession.totalViolations >= maxViolations) {
                activeSession.status = 'terminated';
                await activeSession.save();
                
                // Log termination
                const terminationLog = new ProctoringLog({
                    studentId: req.user.studentId,
                    examId: examId,
                    sessionId: sessionId,
                    violationType: 'exam_terminated',
                    severity: 'high',
                    details: {
                        reason: `Maximum violations exceeded (${activeSession.totalViolations}/${maxViolations})`,
                        totalViolations: activeSession.totalViolations,
                        securityStats: {
                            copyPaste: activeSession.copyPasteAttempts || 0,
                            rightClicks: activeSession.rightClickAttempts || 0,
                            devTools: activeSession.devToolsAttempts || 0,
                            tabSwitches: activeSession.tabSwitches || 0,
                            windowResizes: activeSession.windowResizes || 0,
                            pageLocks: activeSession.pageLockTriggers || 0
                        }
                    },
                    ipAddress: req.ip,
                    userAgent: req.headers['user-agent']
                });
                await terminationLog.save();
                
                return res.json({
                    success: true,
                    terminated: true,
                    message: `Exam terminated due to excessive violations`,
                    totalViolations: activeSession.totalViolations,
                    securityStats: {
                        copyPaste: activeSession.copyPasteAttempts || 0,
                        rightClicks: activeSession.rightClickAttempts || 0,
                        devTools: activeSession.devToolsAttempts || 0,
                        tabSwitches: activeSession.tabSwitches || 0,
                        windowResizes: activeSession.windowResizes || 0,
                        pageLocks: activeSession.pageLockTriggers || 0
                    }
                });
            }
        }
        
        console.log(`⚠️ Enhanced violation: ${violationType} for ${req.user.studentId} (Total: ${activeSession?.totalViolations || 0})`);
        
        res.json({
            success: true,
            message: 'Suspicious activity logged',
            violationCount: activeSession?.totalViolations || 0,
            severity: severity,
            violationType: violationType
        });
        
    } catch (error) {
        console.error('Error logging suspicious activity:', error);
        // Don't fail the request, just log error
        res.json({ success: false, error: error.message });
    }
});

// Capture screenshot from proctoring
app.post('/api/capture-screenshot', authenticateToken, async (req, res) => {
    try {
        const { type, timestamp, screenshot, alertCount } = req.body;
        
        // Create screenshots directory if not exists
        const screenshotsDir = path.join(__dirname, 'screenshots');
        if (!fs.existsSync(screenshotsDir)) {
            fs.mkdirSync(screenshotsDir, { recursive: true });
        }
        // Prune screenshots directory to stay within Render 512MB limit
        pruneScreenshotsDir(screenshotsDir);
        
        // Save screenshot
        const base64Data = screenshot.replace(/^data:image\/jpeg;base64,/, "");
        const filename = `screenshot_${req.user.studentId}_${Date.now()}_${type}.jpg`;
        const filepath = path.join(screenshotsDir, filename);
        
        fs.writeFileSync(filepath, base64Data, 'base64');
        
        // Get active session
        const activeSession = await ExamSession.findOne({
            studentId: req.user.studentId,
            status: 'active'
        }).sort({ startTime: -1 });
        
        if (activeSession) {
            // Create log entry for screenshot
            const log = new ProctoringLog({
                studentId: req.user.studentId,
                examId: activeSession.examId,
                sessionId: activeSession.sessionId,
                violationType: 'info',
                severity: 'low',
                details: {
                    type: 'screenshot_captured',
                    reason: type,
                    screenshotFile: filename,
                    timestamp: timestamp
                },
                screenshot: filename,
                ipAddress: req.ip,
                userAgent: req.headers['user-agent']
            });
            await log.save();
        }
        
        console.log(`📸 Screenshot saved: ${filename} for student ${req.user.studentId}`);
        
        res.json({
            success: true,
            filename: filename,
            message: 'Screenshot captured successfully'
        });
        
    } catch (error) {
        console.error('Error capturing screenshot:', error);
        res.json({ success: false, error: error.message });
    }
});

// Get proctoring logs (for dashboard/analytics)
app.get('/api/proctoring/logs', authenticateToken, async (req, res) => {
    try {
        const { limit = 100, offset = 0, type } = req.query;
        
        let query = { studentId: req.user.studentId };
        
        // Filter by violation type if specified
        if (type && type !== 'all') {
            query.violationType = type;
        }
        
        const logs = await ProctoringLog.find(query)
            .sort({ timestamp: -1 })
            .skip(parseInt(offset))
            .limit(parseInt(limit));
        
        const total = await ProctoringLog.countDocuments(query);
        
        res.json({
            success: true,
            logs: logs,
            total: total,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
        
    } catch (error) {
        console.error('Error fetching proctoring logs:', error);
        res.status(500).json({ error: 'Failed to fetch logs: ' + error.message });
    }
});

// Get proctoring statistics for a student
app.get('/api/proctoring/stats', authenticateToken, async (req, res) => {
    try {
        const stats = await ProctoringLog.aggregate([
            { $match: { studentId: req.user.studentId } },
            { $group: {
                _id: '$violationType',
                count: { $sum: 1 }
            }},
            { $sort: { count: -1 } }
        ]);
        
        const severityStats = await ProctoringLog.aggregate([
            { $match: { studentId: req.user.studentId } },
            { $group: {
                _id: '$severity',
                count: { $sum: 1 }
            }}
        ]);
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const todayViolations = await ProctoringLog.countDocuments({
            studentId: req.user.studentId,
            timestamp: { $gte: today }
        });
        
        // Get security-specific stats
        const securityTypes = ['copy_paste_attempt', 'right_click', 'dev_tools', 'page_lock_triggered', 'window_resize'];
        const securityViolations = await ProctoringLog.countDocuments({
            studentId: req.user.studentId,
            violationType: { $in: securityTypes }
        });
        
        res.json({
            success: true,
            violationTypes: stats,
            severityBreakdown: severityStats,
            todayViolations: todayViolations,
            totalViolations: await ProctoringLog.countDocuments({ studentId: req.user.studentId }),
            securityViolations: securityViolations,
            securityFeatures: {
                copyPasteLock: true,
                pageLock: true,
                screenLock: true,
                rightClickBlock: true,
                devToolsBlock: true
            }
        });
        
    } catch (error) {
        console.error('Error fetching proctoring stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats: ' + error.message });
    }
});

// Save exam session data from enhanced proctoring
app.post('/api/proctoring/session', authenticateToken, async (req, res) => {
    try {
        const { sessionData } = req.body;
        
        // Find and update the session with additional data
        const activeSession = await ExamSession.findOne({
            studentId: req.user.studentId,
            status: 'active'
        }).sort({ startTime: -1 });
        
        if (activeSession) {
            // Add proctoring metadata to session
            activeSession.proctoringData = {
                eyeMovementStats: sessionData.eyeMovementStats,
                totalViolations: sessionData.totalViolations,
                warnings: sessionData.warnings,
                sessionEndTime: sessionData.endTime,
                securityViolations: sessionData.securityViolations || []
            };
            
            await activeSession.save();
            
            console.log(`📊 Proctoring session data saved for ${req.user.studentId}`);
        }
        
        res.json({
            success: true,
            message: 'Session data saved successfully'
        });
        
    } catch (error) {
        console.error('Error saving session data:', error);
        res.json({ success: false, error: error.message });
    }
});

// Get active session status
app.get('/api/proctoring/status', authenticateToken, async (req, res) => {
    try {
        const activeSession = await ExamSession.findOne({
            studentId: req.user.studentId,
            status: 'active'
        }).sort({ startTime: -1 });
        
        if (!activeSession) {
            return res.json({
                success: true,
                hasActiveSession: false,
                message: 'No active exam session found'
            });
        }
        
        // Get recent violations (last 5)
        const recentViolations = await ProctoringLog.find({
            studentId: req.user.studentId,
            sessionId: activeSession.sessionId
        })
        .sort({ timestamp: -1 })
        .limit(5);
        
        // Get security-specific stats
        const securityTypes = ['copy_paste_attempt', 'right_click', 'dev_tools', 'page_lock_triggered', 'window_resize'];
        const securityViolations = await ProctoringLog.countDocuments({
            studentId: req.user.studentId,
            sessionId: activeSession.sessionId,
            violationType: { $in: securityTypes }
        });
        
        res.json({
            success: true,
            hasActiveSession: true,
            sessionId: activeSession.sessionId,
            examId: activeSession.examId,
            startTime: activeSession.startTime,
            totalViolations: activeSession.totalViolations,
            tabSwitches: activeSession.tabSwitches || 0,
            recentViolations: recentViolations,
            maxViolations: process.env.MAX_VIOLATIONS || 10,
            securityStats: {
                copyPasteAttempts: activeSession.copyPasteAttempts || 0,
                rightClickAttempts: activeSession.rightClickAttempts || 0,
                devToolsAttempts: activeSession.devToolsAttempts || 0,
                windowResizes: activeSession.windowResizes || 0,
                pageLockTriggers: activeSession.pageLockTriggers || 0,
                fullscreenExits: activeSession.fullscreenExits || 0,
                totalSecurityViolations: securityViolations
            },
            securityFeatures: {
                copyPasteLock: true,
                pageLock: true,
                screenLock: true,
                fullscreenEnforcement: true,
                rightClickBlock: true,
                devToolsBlock: true
            }
        });
        
    } catch (error) {
        console.error('Error fetching proctoring status:', error);
        res.status(500).json({ error: 'Failed to fetch status: ' + error.message });
    }
});

// Submit Exam Answers
app.post('/api/exam/submit', authenticateToken, async (req, res) => {
    try {
        const { examId, answers, score } = req.body;
        
        if (!examId) {
            return res.status(400).json({ error: 'Exam ID is required' });
        }
        
        // Get active session
        const session = await ExamSession.findOne({
            studentId: req.user.studentId,
            examId,
            status: 'active'
        }).sort({ startTime: -1 });
        
        if (!session) {
            return res.status(404).json({ error: 'No active exam session found' });
        }
        
        // Calculate score if not provided
        let finalScore = score;
        if (!finalScore && answers) {
            const correctAnswers = { q1: 'A', q2: 'A', q3: 'A' };
            let calculatedScore = 0;
            for (let q in correctAnswers) {
                if (answers[q] === correctAnswers[q]) calculatedScore++;
            }
            finalScore = (calculatedScore / Object.keys(correctAnswers).length) * 100;
        }
        
        // Update session
        session.status = 'completed';
        session.endTime = new Date();
        session.answers = answers || new Map();
        session.score = finalScore;
        
        await session.save();
        
        // Log submission
        const submissionLog = new ProctoringLog({
            studentId: req.user.studentId,
            examId,
            sessionId: session.sessionId,
            violationType: 'exam_submitted',
            severity: 'low',
            details: {
                score: finalScore,
                totalViolations: session.totalViolations,
                tabSwitches: session.tabSwitches,
                submissionTime: new Date().toISOString(),
                securityStats: {
                    copyPaste: session.copyPasteAttempts || 0,
                    rightClicks: session.rightClickAttempts || 0,
                    devTools: session.devToolsAttempts || 0,
                    windowResizes: session.windowResizes || 0,
                    pageLocks: session.pageLockTriggers || 0
                }
            },
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });
        await submissionLog.save();
        
        console.log(`✅ Exam submitted: ${session.sessionId} | Score: ${finalScore}% | Violations: ${session.totalViolations}`);
        
        res.json({
            success: true,
            message: 'Exam submitted successfully',
            sessionId: session.sessionId,
            totalViolations: session.totalViolations,
            tabSwitches: session.tabSwitches,
            score: finalScore,
            securityStats: {
                copyPasteAttempts: session.copyPasteAttempts || 0,
                rightClickAttempts: session.rightClickAttempts || 0,
                devToolsAttempts: session.devToolsAttempts || 0,
                windowResizes: session.windowResizes || 0,
                pageLockTriggers: session.pageLockTriggers || 0
            }
        });
    } catch (error) {
        console.error('Submit exam error:', error);
        res.status(500).json({ error: 'Failed to submit exam: ' + error.message });
    }
});

// Get Student Dashboard Data
app.get('/api/dashboard/:studentId', authenticateToken, async (req, res) => {
    try {
        const { studentId } = req.params;
        
        // Check authorization
        if (req.user.studentId !== studentId) {
            return res.status(403).json({ error: 'Unauthorized access' });
        }
        
        // Get exam sessions
        const sessions = await ExamSession.find({ studentId })
            .sort({ startTime: -1 })
            .limit(10);
        
        // Get violation summary by type
        const violationsByType = await ProctoringLog.aggregate([
            { $match: { studentId } },
            { $group: {
                _id: '$violationType',
                count: { $sum: 1 }
            }},
            { $sort: { count: -1 } }
        ]);
        
        // Get violation summary by severity
        const violationsBySeverity = await ProctoringLog.aggregate([
            { $match: { studentId } },
            { $group: {
                _id: '$severity',
                count: { $sum: 1 }
            }}
        ]);
        
        // Get recent logs
        const recentLogs = await ProctoringLog.find({ studentId })
            .sort({ timestamp: -1 })
            .limit(20);
        
        // Get exam statistics
        const examStats = await ExamSession.aggregate([
            { $match: { studentId } },
            { $group: {
                _id: '$status',
                count: { $sum: 1 },
                avgScore: { $avg: '$score' }
            }}
        ]);
        
        // Calculate average score for completed exams
        const completedExams = await ExamSession.find({ studentId, status: 'completed', score: { $exists: true } });
        const averageScore = completedExams.length > 0 
            ? completedExams.reduce((sum, exam) => sum + (exam.score || 0), 0) / completedExams.length 
            : 0;
        
        // Get security stats
        const securityTypes = ['copy_paste_attempt', 'right_click', 'dev_tools', 'page_lock_triggered', 'window_resize'];
        const securityViolations = await ProctoringLog.countDocuments({
            studentId,
            violationType: { $in: securityTypes }
        });
        
        res.json({
            success: true,
            sessions,
            violationsByType,
            violationsBySeverity,
            recentLogs,
            examStats,
            totalViolations: await ProctoringLog.countDocuments({ studentId }),
            totalExams: await ExamSession.countDocuments({ studentId }),
            completedExams: completedExams.length,
            averageScore: averageScore.toFixed(2),
            securityStats: {
                totalSecurityViolations: securityViolations,
                features: {
                    copyPasteLock: true,
                    pageLock: true,
                    screenLock: true,
                    rightClickBlock: true,
                    devToolsBlock: true
                }
            }
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard data: ' + error.message });
    }
});

// Get Student Profile
app.get('/api/student/profile', authenticateToken, async (req, res) => {
    try {
        const student = await Student.findOne({ studentId: req.user.studentId })
            .select('-password');
        
        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }
        
        // Get student statistics
        const totalExams = await ExamSession.countDocuments({ studentId: req.user.studentId });
        const totalViolations = await ProctoringLog.countDocuments({ studentId: req.user.studentId });
        const completedExams = await ExamSession.countDocuments({ 
            studentId: req.user.studentId, 
            status: 'completed' 
        });
        
        const avgScoreResult = await ExamSession.aggregate([
            { $match: { studentId: req.user.studentId, status: 'completed', score: { $exists: true } } },
            { $group: { _id: null, avg: { $avg: '$score' } } }
        ]);
        
        const averageScore = avgScoreResult[0]?.avg || 0;
        
        // Get security violations count
        const securityTypes = ['copy_paste_attempt', 'right_click', 'dev_tools', 'page_lock_triggered', 'window_resize'];
        const securityViolations = await ProctoringLog.countDocuments({
            studentId: req.user.studentId,
            violationType: { $in: securityTypes }
        });
        
        res.json({ 
            success: true, 
            student,
            stats: {
                totalExams,
                totalViolations,
                completedExams,
                averageScore: averageScore.toFixed(2),
                securityViolations: securityViolations
            },
            securityFeatures: {
                copyPasteLock: true,
                pageLock: true,
                screenLock: true,
                fullscreenEnforcement: true,
                rightClickBlock: true,
                devToolsBlock: true
            }
        });
    } catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({ error: 'Failed to fetch profile: ' + error.message });
    }
});

// Get Exam Session Details
app.get('/api/exam/session/:sessionId', authenticateToken, async (req, res) => {
    try {
        const { sessionId } = req.params;
        
        const session = await ExamSession.findOne({ sessionId });
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }
        
        // Check authorization
        if (session.studentId !== req.user.studentId) {
            return res.status(403).json({ error: 'Unauthorized access' });
        }
        
        // Get all logs for this session
        const logs = await ProctoringLog.find({ sessionId })
            .sort({ timestamp: 1 });
        
        // Get security violations count
        const securityTypes = ['copy_paste_attempt', 'right_click', 'dev_tools', 'page_lock_triggered', 'window_resize'];
        const securityViolations = logs.filter(log => securityTypes.includes(log.violationType));
        
        res.json({
            success: true,
            session,
            logs,
            violationCount: logs.length,
            securityStats: {
                total: securityViolations.length,
                copyPaste: session.copyPasteAttempts || 0,
                rightClicks: session.rightClickAttempts || 0,
                devTools: session.devToolsAttempts || 0,
                windowResizes: session.windowResizes || 0,
                pageLocks: session.pageLockTriggers || 0
            }
        });
    } catch (error) {
        console.error('Get session error:', error);
        res.status(500).json({ error: 'Failed to fetch session details: ' + error.message });
    }
});

// Get All Violations (Admin endpoint)
app.get('/api/admin/violations', authenticateToken, async (req, res) => {
    try {
        const { examId, studentId, from, to, limit = 100 } = req.query;
        
        let query = {};
        if (examId) query.examId = examId;
        if (studentId) query.studentId = studentId;
        if (from || to) {
            query.timestamp = {};
            if (from) query.timestamp.$gte = new Date(from);
            if (to) query.timestamp.$lte = new Date(to);
        }
        
        const violations = await ProctoringLog.find(query)
            .sort({ timestamp: -1 })
            .limit(parseInt(limit));
        
        // Get student details for each violation
        const violationsWithStudents = await Promise.all(violations.map(async (v) => {
            const student = await Student.findOne({ studentId: v.studentId }).select('-password');
            return {
                ...v.toObject(),
                student: student ? {
                    studentId: student.studentId,
                    name: student.name,
                    email: student.email,
                    course: student.course
                } : null
            };
        }));
        
        // Get security violation count
        const securityTypes = ['copy_paste_attempt', 'right_click', 'dev_tools', 'page_lock_triggered', 'window_resize'];
        const securityViolations = violations.filter(v => securityTypes.includes(v.violationType));
        
        res.json({
            success: true,
            count: violations.length,
            violations: violationsWithStudents,
            securitySummary: {
                totalSecurityViolations: securityViolations.length,
                types: securityTypes.reduce((acc, type) => {
                    acc[type] = violations.filter(v => v.violationType === type).length;
                    return acc;
                }, {})
            }
        });
    } catch (error) {
        console.error('Get violations error:', error);
        res.status(500).json({ error: 'Failed to fetch violations: ' + error.message });
    }
});

// Export Violations Report
app.get('/api/admin/export/:examId', authenticateToken, async (req, res) => {
    try {
        const { examId } = req.params;
        
        const violations = await ProctoringLog.find({ examId })
            .sort({ timestamp: -1 });
        
        // Get student details
        const violationsWithStudents = await Promise.all(violations.map(async (v) => {
            const student = await Student.findOne({ studentId: v.studentId });
            return {
                ...v.toObject(),
                studentName: student?.name || 'N/A',
                studentEmail: student?.email || 'N/A',
                studentCourse: student?.course || 'N/A',
                studentId: student?.studentId || v.studentId
            };
        }));
        
        // Format as CSV
        const csvHeaders = ['Student ID', 'Name', 'Email', 'Course', 'Violation Type', 'Severity', 'Timestamp', 'Session ID', 'Details'];
        const csvRows = violationsWithStudents.map(v => [
            `"${v.studentId}"`,
            `"${v.studentName}"`,
            `"${v.studentEmail}"`,
            `"${v.studentCourse}"`,
            `"${v.violationType}"`,
            `"${v.severity}"`,
            `"${new Date(v.timestamp).toISOString()}"`,
            `"${v.sessionId}"`,
            `"${JSON.stringify(v.details).replace(/"/g, '""')}"`
        ]);
        
        const csv = [csvHeaders, ...csvRows].map(row => row.join(',')).join('\n');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=violations_${examId}_${Date.now()}.csv`);
        res.send(csv);
    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ error: 'Failed to export report: ' + error.message });
    }
});

// ==================== FRONTEND ROUTES ====================
// Serve the exam HTML page
app.get('/exam', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ==================== TEST ROUTES ====================
// Temporary test route to insert a log
app.get('/test-db', async (req, res) => {
    try {
        const log = await ProctoringLog.create({
            studentId: "demoUser123",
            examId: "123",
            violationType: "info",
            severity: "low",
            details: { test: true, message: "Test log from server" },
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });
        res.json({ success: true, data: log });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==================== ERROR HANDLING ====================

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ 
        error: 'Route not found',
        message: `Cannot ${req.method} ${req.originalUrl}`,
        timestamp: new Date().toISOString()
    });
});

// Global error handling middleware
app.use((err, req, res, next) => {
    console.error('❌ Error:', err.stack);

    if (err.name === 'ValidationError') {
        return res.status(400).json({
            error: 'Validation Error',
            details: Object.values(err.errors).map(e => e.message)
        });
    }

    if (err.code === 11000) {
        return res.status(400).json({
            error: 'Duplicate Key Error',
            message: 'A record with this value already exists'
        });
    }

    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: 'Invalid token' });
    }

    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired. Please login again.' });
    }

    res.status(err.status || 500).json({
        error: err.message || 'Internal Server Error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// ==================== SERVER START ====================
const http = require('http');
const { Server } = require('socket.io');
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
});

// Attach io to app so routes can access it
app.set('io', io);

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // Admin joins monitoring room
    socket.on('join_admin', () => {
        socket.join('admin_room');
        console.log(`🛡️ Admin joined monitoring room: ${socket.id}`);
    });

    // Student joins their personal room
    socket.on('join_student', (studentId) => {
        socket.studentId = studentId;
        socket.join(`student_${studentId}`);
        console.log(`👩‍🎓 Student ${studentId} joined room`);
    });

    // Teacher joins monitoring room
    socket.on('join_teacher', () => {
        socket.join('teacher_room');
        socket.join('admin_room');
        console.log(`👨‍🏫 Teacher joined monitoring room`);
    });

    // Real-Time Socket Events (Requirement 10)

    // 1. student-connected & student-login & student-started
    socket.on('student-connected', (data) => {
        const studentId = data?.studentId || data?.id;
        if (studentId) {
            socket.studentId = studentId;
            socket.join(`student_${studentId}`);
        }
        console.log(`👩‍🎓 student-connected: ${studentId || 'unknown'}`);
        io.to('admin_room').emit('student-connected', data);
        io.to('admin_room').emit('student-login', data);
    });

    socket.on('student-login', (data) => {
        const studentId = data?.studentId || data?.id;
        if (studentId) {
            socket.studentId = studentId;
            socket.join(`student_${studentId}`);
        }
        console.log(`👩‍🎓 student-login: ${studentId || 'unknown'}`);
        io.to('admin_room').emit('student-connected', data);
        io.to('admin_room').emit('student-login', data);
    });

    socket.on('student-started', (data) => {
        console.log(`📝 student-started: ${data?.studentId}`);
        io.to('admin_room').emit('student-started', data);
        io.to('admin_room').emit('exam-start', data);
    });

    // 2. student-disconnected
    socket.on('student-disconnected', (data) => {
        console.log(`👩‍🎓 student-disconnected: ${data?.studentId || socket.studentId}`);
        io.to('admin_room').emit('student-disconnected', data || { studentId: socket.studentId });
    });

    // 3. video-stream & student-camera
    socket.on('video-stream', async (data) => {
        if (data && (data.studentId || data.sessionId || data.email)) {
            const studentId = data.studentId || `STU_${data.email ? data.email.replace(/[^a-z0-9]/g, '_') : '1001'}`;
            socket.studentId = studentId;
            socket.studentEmail = data.email;
            const payload = { ...data, studentId };

            io.to('admin_room').emit('video-stream', payload);
            io.to('admin_room').emit('student-camera', payload);
            io.to(`watch_${studentId}`).emit('video-stream', payload);

            if (data.image) {
                try {
                    let session = await LiveSession.findOne({ $or: [{ studentId }, { usn: studentId }, { email: data.email }] })
                        .select('_id status sessionId studentId studentName usn email examId examName department');
                    if (!session) {
                        session = new LiveSession({
                            sessionId: data.sessionId || `SESS_${studentId}`,
                            studentId: studentId,
                            studentName: data.studentName || 'Student',
                            usn: data.usn || studentId,
                            email: data.email || 'student@university.edu',
                            examId: data.examId || 'CS-401',
                            examName: data.examName || 'Computer Science Final Assessment',
                            department: data.department || 'Computer Science & Engineering',
                            startTime: new Date(),
                            status: 'Online',
                            riskLevel: 'Low',
                            lastWebcamFrame: data.image,
                            lastActive: new Date()
                        });
                        await session.save();
                    } else {
                        const newStatus = (!['Finished', 'Completed', 'Terminated'].includes(session.status)) ? 'Online' : session.status;
                        await LiveSession.updateOne(
                            { _id: session._id },
                            { $set: { lastWebcamFrame: data.image, lastActive: new Date(), status: newStatus } }
                        );
                        session.lastWebcamFrame = data.image;
                        session.lastActive = new Date();
                        session.status = newStatus;
                    }
                    io.to('admin_room').emit('student-updated', session);
                } catch (err) {}
            }
        }
    });

    // 3b. telemetry-update
    socket.on('telemetry-update', async (data) => {
        if (data && (data.studentId || data.email)) {
            const studentId = data.studentId || `STU_${data.email ? data.email.replace(/[^a-z0-9]/g, '_') : '1001'}`;
            socket.studentId = studentId;
            socket.studentEmail = data.email;
            const targetSessionId = data.sessionId || `SESS_${studentId}`;
            try {
                let session = await LiveSession.findOne({
                    $or: [
                        { sessionId: targetSessionId },
                        { studentId },
                        { usn: studentId },
                        ...(data.email ? [{ email: data.email }] : [])
                    ]
                }).select('_id status sessionId studentId studentName usn email examId examName department');

                const newStatus = (!session || !['Finished', 'Completed', 'Terminated'].includes(session.status)) ? 'Online' : session.status;
                const updateFields = {
                    lastActive: new Date(),
                    status: newStatus
                };
                if (data.image) updateFields.lastWebcamFrame = data.image;
                if (data.tabSwitchingCount !== undefined) updateFields.tabSwitchingCount = data.tabSwitchingCount;
                if (data.suspiciousActivityCount !== undefined) updateFields.suspiciousActivityCount = data.suspiciousActivityCount;
                if (data.riskLevel) updateFields.riskLevel = data.riskLevel;
                if (data.headPose) updateFields.headPose = data.headPose;
                if (data.eyeGaze) updateFields.eyeGaze = data.eyeGaze;

                if (!session) {
                    session = new LiveSession({
                        sessionId: targetSessionId,
                        studentId: studentId,
                        studentName: data.studentName || data.fullName || 'Student',
                        usn: data.usn || studentId,
                        email: data.email || 'student@university.edu',
                        examId: data.examId || 'CS-401',
                        examName: data.examName || 'Computer Science Final Assessment',
                        department: data.department || 'Computer Science & Engineering',
                        startTime: new Date(),
                        riskLevel: 'Low',
                        ...updateFields
                    });
                    await session.save();
                } else {
                    await LiveSession.updateOne({ _id: session._id }, { $set: updateFields });
                    Object.assign(session, updateFields);
                }
                io.to('admin_room').emit('student-updated', session);

                if (data.image) {
                    io.to('admin_room').emit('video-stream', { studentId, image: data.image });
                    io.to('admin_room').emit('student-camera', { studentId, image: data.image });
                }
            } catch (err) {
                if (err.code === 11000) {
                    try {
                        const existingSession = await LiveSession.findOne({ sessionId: targetSessionId }).select('_id');
                        if (existingSession) {
                            await LiveSession.updateOne(
                                { _id: existingSession._id },
                                { $set: { lastActive: new Date(), ...(data.image ? { lastWebcamFrame: data.image } : {}) } }
                            );
                        }
                    } catch (retryErr) {
                        console.error('Error updating telemetry session (retry):', retryErr.message);
                    }
                } else {
                    console.error('Error updating telemetry session:', err.message);
                }
            }
        }
    });

    // 4. gaze-telemetry
    socket.on('gaze-telemetry', async (data) => {
        if (data && (data.studentId || data.sessionId || data.email)) {
            const studentId = data.studentId || `STU_${data.email ? data.email.replace(/[^a-z0-9]/g, '_') : '1001'}`;
            const payload = {
                type: 'GAZE_DEVIATION',
                studentId,
                examId: data.examId || 'EXAM_MAIN',
                sessionId: data.sessionId || `SESSION_${studentId}`,
                direction: (data.gazeDirection || data.direction || 'CENTER').toUpperCase(),
                headPose: data.headPose || { yaw: 0, pitch: 0, roll: 0 },
                duration: Number(data.duration) || 0,
                suspicionScore: Number(data.suspicionScore) || 0,
                riskLevel: (data.riskLevel || 'NORMAL').toUpperCase(),
                timestamp: data.timestamp || new Date().toISOString()
            };

            io.to('admin_room').emit('gaze-attention-update', payload);
            io.to('admin_room').emit('student-attention-event', payload);
        }
    });

    // 4. ai-alert
    socket.on('ai-alert', (data) => {
        console.log(`🚨 ai-alert: ${data?.alertType || 'anomaly'} for ${data?.studentName || data?.studentId}`);
        io.to('admin_room').emit('ai-alert', data);
        io.to('admin_room').emit('admin-notification', {
            id: `NOTIF_${Date.now()}_${Math.random()}`,
            type: data?.alertType || 'AI_ALERT',
            studentId: data?.studentId,
            studentName: data?.studentName || 'Student',
            usn: data?.usn || data?.studentId,
            message: data?.description || data?.message || 'Proctoring Anomaly Alert Detected',
            severity: data?.severity || 'high',
            timestamp: new Date()
        });
    });

    // 5. violation / violation-detected / student-violation
    socket.on('violation', (data) => {
        console.log(`⚠️ violation: ${data?.type || 'violation'} by ${data?.studentName || data?.studentId}`);
        io.to('admin_room').emit('violation', data);
        io.to('admin_room').emit('violation-detected', data);
        io.to('admin_room').emit('student-violation', data);
        io.to('admin_room').emit('admin-notification', {
            id: `NOTIF_${Date.now()}_${Math.random()}`,
            type: data?.type || data?.violationType || 'VIOLATION',
            studentId: data?.studentId,
            studentName: data?.studentName || 'Student',
            usn: data?.usn || data?.studentId,
            message: data?.description || data?.message || `${data?.type || 'Proctoring violation'} detected!`,
            severity: data?.severity || 'warning',
            timestamp: new Date()
        });
    });

    socket.on('violation-detected', (data) => {
        console.log(`⚠️ violation-detected: ${data?.type || 'violation'} by ${data?.studentName || data?.studentId}`);
        io.to('admin_room').emit('violation', data);
        io.to('admin_room').emit('violation-detected', data);
        io.to('admin_room').emit('student-violation', data);
        io.to('admin_room').emit('admin-notification', {
            id: `NOTIF_${Date.now()}_${Math.random()}`,
            type: data?.type || data?.violationType || 'VIOLATION',
            studentId: data?.studentId,
            studentName: data?.studentName || 'Student',
            usn: data?.usn || data?.studentId,
            message: data?.description || data?.message || `${data?.type || 'Proctoring violation'} detected!`,
            severity: data?.severity || 'warning',
            timestamp: new Date()
        });
    });

    socket.on('student-violation', (data) => {
        console.log(`⚠️ student-violation: ${data?.type || 'violation'} by ${data?.studentName || data?.studentId}`);
        io.to('admin_room').emit('violation', data);
        io.to('admin_room').emit('violation-detected', data);
        io.to('admin_room').emit('student-violation', data);
        io.to('admin_room').emit('admin-notification', {
            id: `NOTIF_${Date.now()}_${Math.random()}`,
            type: data?.type || data?.violationType || 'VIOLATION',
            studentId: data?.studentId,
            studentName: data?.studentName || 'Student',
            usn: data?.usn || data?.studentId,
            message: data?.description || data?.message || `${data?.type || 'Proctoring violation'} detected!`,
            severity: data?.severity || 'warning',
            timestamp: new Date()
        });
    });

    socket.on('tab-switch', (data) => {
        console.log(`📑 tab-switch by ${data?.studentName || data?.studentId}`);
        io.to('admin_room').emit('tab-switch', data);
        io.to('admin_room').emit('student-violation', { ...data, type: 'TAB_SWITCH' });
        io.to('admin_room').emit('admin-notification', {
            id: `NOTIF_${Date.now()}_${Math.random()}`,
            type: 'TAB_SWITCH',
            studentId: data?.studentId,
            studentName: data?.studentName || 'Student',
            usn: data?.usn || data?.studentId,
            message: `⚠️ Candidate ${data?.studentName || data?.studentId} switched browser tabs! (Switch count: ${data?.tabSwitchingCount || 1})`,
            severity: 'high',
            timestamp: new Date()
        });
    });

    // 6. student-status
    socket.on('student-status', async (data) => {
        const studentId = data?.studentId || data?.usn;
        const newStatus = data?.status;
        console.log(`📊 student-status socket event: ${studentId} -> ${newStatus}`);
        if (studentId && newStatus) {
            try {
                await LiveSession.findOneAndUpdate(
                    { $or: [{ studentId }, { usn: studentId }] },
                    { status: newStatus, updatedAt: new Date() }
                );
            } catch (e) {}
        }
        io.to('admin_room').emit('student-status', data);
        io.to('admin_room').emit('student-updated', data);
        io.to('admin_room').emit('dashboard-updated', { timestamp: Date.now() });
    });

    // 7. warning-issued / student-warning
    socket.on('warning-issued', (data) => {
        const studentId = data?.studentId;
        console.log(`⚠️ warning-issued to ${studentId}: ${data?.message}`);
        if (studentId) {
            io.to(`student_${studentId}`).emit('warning-issued', data);
        }
        io.to('admin_room').emit('warning-issued', data);
        io.to('admin_room').emit('student-warning', data);
    });

    socket.on('student-warning', (data) => {
        const studentId = data?.studentId;
        console.log(`⚠️ student-warning to ${studentId}: ${data?.message}`);
        if (studentId) {
            io.to(`student_${studentId}`).emit('warning-issued', data);
        }
        io.to('admin_room').emit('warning-issued', data);
        io.to('admin_room').emit('student-warning', data);
    });

    // 8. student-terminated
    socket.on('student-terminated', async (data) => {
        const studentId = data?.studentId || data?.usn;
        console.log(`🔴 student-terminated socket event for: ${studentId}`);
        if (studentId) {
            try {
                await LiveSession.findOneAndUpdate(
                    { $or: [{ studentId }, { usn: studentId }] },
                    { status: 'Terminated', terminationReason: data?.reason || 'Exceeded maximum violations', isTerminated: true, updatedAt: new Date() }
                );
            } catch (e) {
                console.warn('DB update error on student-terminated socket:', e.message);
            }
            io.to(`student_${studentId}`).emit('student-terminated', data);
        }
        io.to('admin_room').emit('student-terminated', data);
        io.to('admin_room').emit('student-status', { studentId, status: 'Terminated' });
        io.to('admin_room').emit('student-updated', { studentId, status: 'Terminated' });
        io.to('admin_room').emit('dashboard-updated', { timestamp: Date.now() });
    });

    // 9. exam-start
    socket.on('exam-start', (data) => {
        console.log(`📝 exam-start: ${data?.studentId}`);
        io.to('admin_room').emit('exam-start', data);
        io.to('admin_room').emit('student-started', data);
    });

    // 10. exam-end / exam-finished / student-finished
    socket.on('exam-end', (data) => {
        console.log(`🏁 exam-end: ${data?.studentId}`);
        io.to('admin_room').emit('exam-end', data);
        io.to('admin_room').emit('exam-finished', data);
        io.to('admin_room').emit('student-finished', data);
    });

    socket.on('exam-finished', (data) => {
        console.log(`🏁 exam-finished: ${data?.studentId}`);
        io.to('admin_room').emit('exam-end', data);
        io.to('admin_room').emit('exam-finished', data);
        io.to('admin_room').emit('student-finished', data);
    });

    socket.on('student-finished', (data) => {
        console.log(`🏁 student-finished: ${data?.studentId}`);
        io.to('admin_room').emit('exam-end', data);
        io.to('admin_room').emit('exam-finished', data);
        io.to('admin_room').emit('student-finished', data);
    });

    // 11. dashboard-updated
    socket.on('dashboard-updated', (data) => {
        io.to('admin_room').emit('dashboard-updated', data);
    });

    // Heartbeat
    socket.on('heartbeat', async (data) => {
        if (data && (data.studentId || data.email)) {
            const studentId = data.studentId || `STU_${data.email ? data.email.replace(/[^a-z0-9]/g, '_') : '1001'}`;
            socket.studentId = studentId;
            socket.studentEmail = data.email;
            try {
                const existing = await LiveSession.findOne({ studentId });
                if (existing && !['Finished', 'Completed', 'Terminated'].includes(existing.status)) {
                    existing.lastActive = new Date();
                    existing.status = 'Online';
                    if (data.image) existing.lastWebcamFrame = data.image;
                    await existing.save();
                }
            } catch (e) {}
        }
        socket.emit('pong', { timestamp: Date.now() });
    });

    socket.on('ping', () => socket.emit('pong', { timestamp: Date.now() }));

    // Watch specific student feed
    socket.on('subscribe_student', (studentId) => {
        socket.join(`watch_${studentId}`);
        console.log(`👁️ Socket ${socket.id} subscribed to watch student ${studentId}`);
    });

    socket.on('disconnect', async () => {
        if (socket.studentId) {
            try {
                const existing = await LiveSession.findOne({ studentId: socket.studentId });
                if (existing && !['Finished', 'Completed', 'Terminated'].includes(existing.status)) {
                    existing.status = 'Offline';
                    existing.lastActive = new Date();
                    await existing.save();
                }
            } catch (e) {}
            io.to('admin_room').emit('student-disconnected', { studentId: socket.studentId, socketId: socket.id, status: 'Offline' });
            io.to('admin_room').emit('student-status', { studentId: socket.studentId, status: 'Offline' });
        }
        console.log(`🔌 Socket disconnected: ${socket.id}`);
    });
});

// Periodic Stale Presence Sweeper (Every 10 seconds):
// Marks sessions without active heartbeat within 20s as Offline
setInterval(async () => {
    try {
        const staleThreshold = new Date(Date.now() - 20 * 1000);
        const staleSessions = await LiveSession.find({
            status: { $in: ['Online', 'Active', 'Warning', 'in-progress'] },
            $or: [
                { lastActive: { $lt: staleThreshold } },
                { lastActive: { $exists: false } }
            ]
        }).select('_id studentId status');

        if (staleSessions.length > 0) {
            await LiveSession.updateMany(
                { _id: { $in: staleSessions.map(s => s._id) } },
                { $set: { status: 'Offline' } }
            );

            staleSessions.forEach(s => {
                io.to('admin_room').emit('student-disconnected', { studentId: s.studentId, status: 'Offline' });
                io.to('admin_room').emit('student-status', { studentId: s.studentId, status: 'Offline' });
            });
        }
    } catch (e) {
        // Silent error catch to prevent unhandled rejections
    }
}, 10000);


httpServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.warn(`\n⚠️ Port ${PORT} is currently in use by a background process.`);
        console.warn(`🔄 Automatically releasing port ${PORT} and retrying startup...`);
        try {
            const { execSync } = require('child_process');
            if (process.platform === 'win32') {
                execSync(`powershell -Command "Get-NetTCPConnection -LocalPort ${PORT} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }"`);
            } else {
                execSync(`fuser -k ${PORT}/tcp || true`);
            }
            setTimeout(() => {
                httpServer.listen(PORT, '0.0.0.0');
            }, 1200);
            return;
        } catch (e) {
            console.error(`Failed to auto-release port ${PORT}: ${e.message}`);
        }
    }
    console.error('Server startup error:', err);
});

let server = null;
if (!process.env.VERCEL) {
    server = httpServer.listen(PORT, '0.0.0.0', () => {
        console.log(`\n=================================`);
        console.log(`🎓 Smart Proctoring System`);
        console.log(`=================================`);
        console.log(`🚀 Server running on http://localhost:${PORT}`);
        console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`🔗 API Root: http://localhost:${PORT}`);
        console.log(`📹 Exam Page: http://localhost:${PORT}/exam`);
        console.log(`🩺 Health Check: http://localhost:${PORT}/api/health`);
        console.log(`📸 Screenshots Directory: ${screenshotsDir}`);
        console.log(`💾 Database: ${process.env.MONGODB_URI || 'mongodb://localhost:27017/smart-proctoring'}`);
        console.log(`=================================\n`);

        // Check & ensure Python AI microservice is reachable
        try {
            const defaultPyUrl = (process.env.NODE_ENV === 'production' || process.env.RENDER)
                ? 'https://athena-python.onrender.com'
                : 'http://127.0.0.1:8001';
            const configuredPyUrl = process.env.PYTHON_DETECTOR_URL || process.env.PYTHON_SERVICE_URL || defaultPyUrl;
            const isLocal = configuredPyUrl.includes('127.0.0.1') || configuredPyUrl.includes('localhost');

            if (isLocal && process.env.NODE_ENV !== 'production') {
                const http = require('http');
                const pyReq = http.get('http://127.0.0.1:8001/health', (res) => {
                    if (res.statusCode === 200) {
                        console.log('🐍 Local Python AI microservice is ALIVE on http://127.0.0.1:8001');
                    }
                });
                pyReq.on('error', () => {
                    console.log('💡 Note: Local Python AI service not detected on http://127.0.0.1:8001. Run it in your terminal with: cd python_detector && python -m uvicorn main:app --host 127.0.0.1 --port 8001');
                });
                pyReq.setTimeout(2000, () => pyReq.destroy());
            } else {
                console.log(`🐍 Python AI Microservice configured at: ${configuredPyUrl}`);
            }
        } catch (checkErr) {
            console.warn('Python service health check notice:', checkErr.message);
        }
    });
}

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('👋 SIGTERM received. Shutting down gracefully...');
    server.close(() => {
        console.log('💤 Server closed');
        mongoose.connection.close(false, () => {
            console.log('📦 Database connection closed');
            process.exit(0);
        });
    });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
    console.log('❌ UNHANDLED REJECTION! 💥 Shutting down...');
    console.log(err.name, err.message);
    console.log(err.stack);
    server.close(() => process.exit(1));
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.log('❌ UNCAUGHT EXCEPTION! 💥 Shutting down...');
    console.log(err.name, err.message);
    console.log(err.stack);
    process.exit(1);
});

module.exports = app;

// Render backend auto deploy test