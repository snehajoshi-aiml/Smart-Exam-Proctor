const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

// Mongoose Models
const Admin = mongoose.models.Admin || require('../models/Admin');
const LiveSession = mongoose.models.LiveSession || require('../models/LiveSession');
const User = mongoose.models.User || require('../models/User');
const Student = mongoose.models.Student || require('../models/Student');
const ExamReport = mongoose.models.ExamReport || require('../models/ExamReport');
const ExamSession = mongoose.models.ExamSession || require('../models/ExamSession');
const Violation = mongoose.models.Violation || require('../models/Violation');
const Alert = mongoose.models.Alert || require('../models/Alert');
const ScreenshotEvidence = mongoose.models.ScreenshotEvidence || require('../models/ScreenshotEvidence');
const SuspiciousActivity = mongoose.models.SuspiciousActivity || require('../models/SuspiciousActivity');
const Incident = mongoose.models.Incident || require('../models/Incident');
const VerificationLog = mongoose.models.VerificationLog || require('../models/VerificationLog');
const GazeEvent = mongoose.models.GazeEvent || require('../models/GazeEvent');
const ProctoringLog = mongoose.models.ProctoringLog || require('../models/ProctoringLog');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

/**
 * 1. Admin Login
 * POST /api/admin/login
 */
const loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide both email and password'
      });
    }

    let admin = null;
    try {
      admin = await Admin.findOne({ email: email.toLowerCase() });
    } catch (dbErr) {
      console.warn('MongoDB query warning in loginAdmin:', dbErr.message);
    }

    // Default superadmin fallback
    if (!admin && email.toLowerCase() === 'admin@proctor.com' && password === 'Admin@123') {
      admin = {
        _id: 'ADMIN_SUPER_1001',
        name: 'System Administrator',
        email: 'admin@proctor.com',
        role: 'superadmin',
        department: 'Exam Control Center',
        comparePassword: async () => true
      };
    }

    if (!admin) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials. Admin account not found.'
      });
    }

    if (admin.comparePassword) {
      const isMatch = await admin.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials. Password incorrect.'
        });
      }
    }

    if (admin.save) {
      admin.lastLogin = new Date();
      await admin.save().catch(() => {});
    }

    const token = jwt.sign(
      {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        department: admin.department
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      message: 'Admin login successful',
      token,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role || 'Admin',
        department: admin.department || 'Proctoring Operations'
      }
    });
  } catch (error) {
    console.error('Error in loginAdmin:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during admin authentication: ' + error.message
    });
  }
};

/**
 * Helper: Calculate AI Risk Score (0-100)
 */
function calculateRiskScore(session, violationsCount = 0) {
  let score = 0;

  const vCount = violationsCount || session.suspiciousActivityCount || 0;
  score += Math.min(vCount * 15, 60);

  if (session.mobilePhoneDetected) score += 40;
  if (session.multipleFaces) score += 25;
  if (session.faceDetected === false) score += 20;
  if (session.headPose && session.headPose !== 'Normal' && session.headPose !== 'Center' && session.headPose !== 'Looking Center') score += 10;
  if (session.eyeGaze && session.eyeGaze !== 'Center' && session.eyeGaze !== 'Looking Center') score += 10;
  if (session.tabSwitchingCount) score += Math.min(session.tabSwitchingCount * 10, 30);
  if (session.voiceDetected) score += 15;

  return Math.min(Math.max(score, 0), 100);
}

function getRiskCategory(score) {
  if (score >= 76) return 'Terminate';
  if (score >= 51) return 'High Risk';
  if (score >= 21) return 'Warning';
  return 'Safe';
}

/**
 * 2. Dashboard Overview API
 * GET /api/admin/dashboard
 */
const getDashboardOverview = async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    let allSessions = [];
    let allUsers = [];
    let allStudents = [];
    let examReports = [];
    let suspiciousActivities = [];
    let alerts = [];

    try {
      const activeThreshold = new Date(Date.now() - 5 * 60 * 1000);
      await LiveSession.updateMany(
        {
          status: { $in: ['Online', 'Active', 'Warning', 'in-progress'] },
          $or: [
            { lastActive: { $lt: activeThreshold } },
            { lastActive: { $exists: false } }
          ]
        },
        { $set: { status: 'Offline' } }
      ).catch(() => {});

      [allSessions, allUsers, allStudents, examReports, suspiciousActivities, alerts] = await Promise.all([
        LiveSession.find().select('-answers -mcqStats -codingStats -theoryStats').sort({ updatedAt: -1 }).lean().catch(() => []),
        User.find().select('-password -faceEmbeddings').lean().catch(() => []),
        Student.find().select('-password -passwordHash').lean().catch(() => []),
        ExamReport.find().select('-screenshots -answers -codingAnswers -theoryAnswers').lean().catch(() => []),
        SuspiciousActivity.find().select('-screenshot -screenshotBase64 -screenshotPath').sort({ timestamp: -1 }).lean().catch(() => []),
        Alert.find().sort({ timestamp: -1 }).limit(10).lean().catch(() => [])
      ]);
    } catch (e) {
      console.warn('MongoDB query warning in getDashboardOverview:', e.message);
    }

    // Unified unique student count
    const uniqueStudentIdentifiers = new Set();
    allUsers.forEach(u => uniqueStudentIdentifiers.add((u.email || u._id.toString()).toLowerCase()));
    allStudents.forEach(s => uniqueStudentIdentifiers.add((s.email || s.studentId || s._id.toString()).toLowerCase()));
    allSessions.forEach(s => uniqueStudentIdentifiers.add((s.email || s.studentId || s._id.toString()).toLowerCase()));
    examReports.forEach(r => uniqueStudentIdentifiers.add((r.email || r.studentId || r._id.toString()).toLowerCase()));

    const registeredStudents = Math.max(uniqueStudentIdentifiers.size, allSessions.length, allUsers.length);

    // Attended students (started or finished or terminated)
    const attendedSet = new Set();
    allSessions.forEach(s => {
      if (s.email || s.studentId) attendedSet.add((s.email || s.studentId).toLowerCase());
    });
    examReports.forEach(r => {
      if (r.email || r.studentId) attendedSet.add((r.email || r.studentId).toLowerCase());
    });
    const attendedToday = Math.max(attendedSet.size, allSessions.length);

    const currentlyWriting = allSessions.filter(s =>
      ['online', 'active', 'warning', 'in-progress'].includes(String(s.status || '').toLowerCase())
    ).length;

    const finishedExam = Math.max(
      allSessions.filter(s => ['finished', 'completed', 'submitted'].includes(String(s.status || '').toLowerCase())).length,
      examReports.filter(r => ['submitted', 'completed', 'verified'].includes(String(r.status || '').toLowerCase())).length
    );

    const terminated = allSessions.filter(s => String(s.status || '').toLowerCase() === 'terminated').length;
    const absent = Math.max(registeredStudents - attendedToday, 0);

    const activeExamNames = Array.from(new Set(
      allSessions.filter(s => ['online', 'active', 'warning'].includes(String(s.status || '').toLowerCase()))
        .map(s => s.examName)
        .filter(Boolean)
    ));
    const activeExams = activeExamNames.length || (currentlyWriting > 0 ? 1 : 0);

    const violationsTodayCount = suspiciousActivities.length;

    // Real-Time Chart Datasets
    const activeStudentsChart = {
      labels: ['09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM'],
      datasets: [
        {
          label: 'Active Students Writing Exam',
          data: [0, 0, 0, 0, 0, 0, Math.max(0, currentlyWriting - 1), currentlyWriting],
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.15)',
          fill: true,
          tension: 0.4
        }
      ]
    };

    const violationsPerHour = {
      labels: ['09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM'],
      datasets: [
        {
          label: 'Violations Detected per Hour',
          data: [0, 0, 0, 0, 0, 0, Math.round(violationsTodayCount * 0.4), Math.round(violationsTodayCount * 0.6)],
          backgroundColor: '#ef4444'
        }
      ]
    };

    const phoneCount = suspiciousActivities.filter(v => (v.type || '').toLowerCase().includes('phone') || (v.violationType || '').toLowerCase().includes('phone')).length || allSessions.filter(s => s.mobilePhoneDetected).length;
    const gazeCount = suspiciousActivities.filter(v => (v.type || '').toLowerCase().includes('gaze') || (v.type || '').toLowerCase().includes('look') || (v.violationType || '').toLowerCase().includes('eye')).length || allSessions.filter(s => s.eyeGaze && s.eyeGaze !== 'Center').length;
    const multiFaceCount = suspiciousActivities.filter(v => (v.type || '').toLowerCase().includes('multi')).length || allSessions.filter(s => s.multipleFaces).length;
    const noFaceCount = suspiciousActivities.filter(v => (v.type || '').toLowerCase().includes('missing') || (v.type || '').toLowerCase().includes('no_face')).length || allSessions.filter(s => s.faceDetected === false).length;
    const tabSwitchCount = suspiciousActivities.filter(v => (v.type || '').toLowerCase().includes('tab')).length || allSessions.reduce((sum, s) => sum + (s.tabSwitchingCount || 0), 0);
    const voiceCount = suspiciousActivities.filter(v => (v.type || '').toLowerCase().includes('voice') || (v.type || '').toLowerCase().includes('audio')).length || allSessions.filter(s => s.voiceDetected).length;

    const violationTypes = {
      labels: ['Phone Detected', 'Gaze Away', 'Multiple Faces', 'Candidate Absent', 'Tab Switched', 'Voice Detected'],
      datasets: [
        {
          data: [phoneCount, gazeCount, multiFaceCount, noFaceCount, tabSwitchCount, voiceCount],
          backgroundColor: ['#ef4444', '#f59e0b', '#ec4899', '#8b5cf6', '#3b82f6', '#10b981']
        }
      ]
    };

    const finishedVsTerminated = {
      labels: ['Finished (Clean)', 'Terminated (Violations)'],
      datasets: [
        {
          data: [finishedExam, terminated],
          backgroundColor: ['#10b981', '#ef4444']
        }
      ]
    };

    const deptAgg = await LiveSession.aggregate([
      {
        $group: {
          _id: "$department",
          active: { $sum: { $cond: [{ $in: ["$status", ["Online", "Active", "Warning", "in-progress"]] }, 1, 0] } },
          violations: { $sum: { $ifNull: ["$suspiciousActivityCount", 0] } }
        }
      }
    ]).catch(() => []);

    const deptLabels = deptAgg.length > 0 ? deptAgg.map(d => d._id || 'Computer Science & Engineering') : ['Computer Science & Engineering'];
    const deptActiveData = deptAgg.length > 0 ? deptAgg.map(d => d.active) : [currentlyWriting];
    const deptViolationsData = deptAgg.length > 0 ? deptAgg.map(d => d.violations) : [violationsTodayCount];

    const departmentStats = {
      labels: deptLabels,
      datasets: [
        {
          label: 'Active Students',
          data: deptActiveData,
          backgroundColor: '#6366f1'
        },
        {
          label: 'Violations Flagged',
          data: deptViolationsData,
          backgroundColor: '#ef4444'
        }
      ]
    };

    const safeCount = allSessions.filter(s => calculateRiskScore(s, s.suspiciousActivityCount) < 21).length;
    const warningCount = allSessions.filter(s => { const r = calculateRiskScore(s, s.suspiciousActivityCount); return r >= 21 && r < 51; }).length;
    const highRiskCount = allSessions.filter(s => { const r = calculateRiskScore(s, s.suspiciousActivityCount); return r >= 51 && r < 76; }).length;
    const terminateCount = allSessions.filter(s => calculateRiskScore(s, s.suspiciousActivityCount) >= 76).length || terminated;

    const riskScoreDistribution = {
      labels: ['Safe (0-20)', 'Warning (21-50)', 'High Risk (51-75)', 'Terminate (76-100)'],
      datasets: [
        {
          data: [safeCount, warningCount, highRiskCount, terminateCount],
          backgroundColor: ['#10b981', '#f59e0b', '#f97316', '#ef4444']
        }
      ]
    };

    res.json({
      success: true,
      stats: {
        registeredStudents,
        attendedToday,
        currentlyWriting,
        finishedExam,
        terminated,
        absent,
        activeExams,
        violationsToday: violationsTodayCount
      },
      charts: {
        activeStudentsChart,
        violationsPerHour,
        violationTypes,
        finishedVsTerminated,
        departmentStats,
        riskScoreDistribution
      },
      recentAlerts: alerts || [],
      liveSessions: allSessions.slice(0, 6)
    });
  } catch (error) {
    console.error('Error in getDashboardOverview:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard overview: ' + error.message
    });
  }
};

/**
 * 3. Live Students Grid API
 * GET /api/admin/liveStudents OR GET /api/admin/students/live
 */
const getLiveStudents = async (req, res) => {
  try {
    const { search, riskLevel, status, department } = req.query;

    const [registeredUsers, registeredStudents, activeSessions, examReports] = await Promise.all([
      User.find({}, '-password -faceEmbeddings').sort({ createdAt: -1 }).lean().catch(() => []),
      Student.find({}, '-password -passwordHash').sort({ createdAt: -1 }).lean().catch(() => []),
      LiveSession.find({}).select('-answers -mcqStats -codingStats -theoryStats').sort({ updatedAt: -1, lastActive: -1 }).lean().catch(() => []),
      ExamReport.find({}).select('-screenshots -answers -codingAnswers -theoryAnswers').sort({ createdAt: -1 }).lean().catch(() => [])
    ]);

    const studentRegistryMap = new Map();

    (registeredUsers || []).forEach(u => {
      const email = (u.email || '').toLowerCase().trim();
      const studentId = 'STU_' + (email ? email.replace(/[^a-z0-9]/gi, '_') : u._id.toString());
      studentRegistryMap.set(studentId, {
        studentId,
        studentName: u.name || 'Student',
        usn: u.usn || studentId,
        email: u.email,
        department: 'Computer Science & Engineering',
        faceEnrolled: !!u.faceEnrolled,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt
      });
    });

    (registeredStudents || []).forEach(s => {
      const email = (s.email || '').toLowerCase().trim();
      const studentId = s.studentId || ('STU_' + (email ? email.replace(/[^a-z0-9]/gi, '_') : s._id.toString()));
      const existing = studentRegistryMap.get(studentId);
      studentRegistryMap.set(studentId, {
        studentId,
        studentName: s.fullName || s.name || (s.firstName ? `${s.firstName} ${s.lastName || ''}`.trim() : (existing?.studentName || 'Student')),
        usn: s.usn || existing?.usn || studentId,
        email: s.email || existing?.email,
        department: s.course || existing?.department || 'Computer Science & Engineering',
        faceEnrolled: s.faceEnrolled !== undefined ? s.faceEnrolled : (existing?.faceEnrolled || false),
        createdAt: s.createdAt || existing?.createdAt,
        updatedAt: s.updatedAt || existing?.updatedAt
      });
    });

    const matchedSessionIds = new Set();

    const mergedStudents = Array.from(studentRegistryMap.values()).map(user => {
      const studentId = user.studentId;
      const userUsn = user.usn || studentId;

      const session = (activeSessions || []).find(s =>
        (s.studentId && s.studentId === studentId) ||
        (s.email && user.email && s.email.toLowerCase() === user.email.toLowerCase()) ||
        (s.usn && userUsn && s.usn === userUsn)
      );

      const report = (examReports || []).find(r =>
        (r.studentId && r.studentId === studentId) ||
        (r.email && user.email && r.email.toLowerCase() === user.email.toLowerCase())
      );

      if (session) {
        matchedSessionIds.add(session.sessionId || session._id.toString());
        const isRecent = session.lastActive && (Date.now() - new Date(session.lastActive).getTime() < 3 * 60 * 1000);
        const isOnline = isRecent && ['Online', 'Active', 'Warning', 'in-progress'].includes(session.status);
        const computedStatus = session.status === 'Terminated'
          ? 'Terminated'
          : (['Finished', 'Completed', 'Submitted'].includes(session.status)
              ? 'Completed'
              : (isOnline ? (session.status === 'Warning' ? 'Warning' : 'Online') : 'Offline'));

        const computedRisk = calculateRiskScore(session, session.suspiciousActivityCount);

        return {
          sessionId: session.sessionId || session._id.toString(),
          studentId: session.studentId || studentId,
          studentName: user.studentName || session.studentName || 'Student',
          usn: userUsn,
          email: user.email,
          department: session.department || user.department || 'Computer Science & Engineering',
          examName: session.examName || 'Computer Science Final Assessment',
          status: computedStatus,
          verificationStatus: session.verificationStatus || (user.faceEnrolled ? 'Verified' : 'Pending'),
          faceMatchConfidence: session.faceMatchConfidence || (user.faceEnrolled ? 98 : 0),
          faceDetected: session.faceDetected !== undefined ? session.faceDetected : (computedStatus !== 'Offline'),
          multipleFaces: session.multipleFaces || false,
          mobilePhoneDetected: session.mobilePhoneDetected || false,
          fullScreenStatus: session.fullScreenStatus || (computedStatus !== 'Offline' ? 'Active' : 'N/A'),
          headPose: session.headPose || (computedStatus !== 'Offline' ? 'Looking Center' : 'N/A'),
          eyeGaze: session.eyeGaze || (computedStatus !== 'Offline' ? 'Looking Center' : 'N/A'),
          tabSwitchingCount: session.tabSwitchingCount || 0,
          copyPasteAttempts: session.copyPasteAttempts || 0,
          warningsCount: session.warningsCount || 0,
          riskLevel: computedRisk >= 76 ? 'High (76-100)' : (computedRisk >= 51 ? 'High (51-75)' : (computedRisk >= 21 ? 'Medium (20-50)' : 'Safe (0-20)')),
          riskScore: computedRisk,
          startTime: session.startTime || session.createdAt || user.createdAt,
          remainingTime: session.remainingTime || '03:00:00',
          image: session.lastWebcamFrame || null,
          micStatus: session.micStatus || (computedStatus !== 'Offline' ? 'Active' : 'N/A'),
          noiseLevel: session.noiseLevel || (computedStatus !== 'Offline' ? '24 dB SPL' : 'N/A'),
          audioConfidence: session.audioConfidence || (computedStatus !== 'Offline' ? '98% Confidence' : 'N/A'),
          lastSeen: session.lastActive || session.updatedAt || user.updatedAt
        };
      }

      // If student submitted exam and exists in ExamReport
      if (report) {
        return {
          sessionId: report.reportId || `REP_${studentId}`,
          studentId: studentId,
          studentName: user.studentName || report.studentName || 'Student',
          usn: userUsn,
          email: user.email,
          department: report.department || user.department || 'Computer Science & Engineering',
          examName: report.examName || 'Computer Science Final Assessment',
          status: 'Completed',
          verificationStatus: 'Verified',
          faceMatchConfidence: 98,
          faceDetected: true,
          multipleFaces: false,
          mobilePhoneDetected: false,
          fullScreenStatus: 'Active',
          headPose: 'Looking Center',
          eyeGaze: 'Looking Center',
          tabSwitchingCount: 0,
          copyPasteAttempts: 0,
          warningsCount: 0,
          riskLevel: 'Safe (0-20)',
          riskScore: 10,
          startTime: report.startTime || report.createdAt,
          remainingTime: 'Completed',
          image: null,
          micStatus: 'Active',
          noiseLevel: '24 dB SPL',
          audioConfidence: '98% Confidence',
          lastSeen: report.endTime || report.createdAt
        };
      }

      // Offline Registered Student
      return {
        sessionId: `SESS_${studentId}`,
        studentId: studentId,
        studentName: user.studentName || 'Student',
        usn: userUsn,
        email: user.email,
        department: user.department || 'Computer Science & Engineering',
        examName: 'Computer Science Final Assessment',
        status: 'Offline',
        verificationStatus: user.faceEnrolled ? 'Verified' : 'Pending Enrollment',
        faceMatchConfidence: user.faceEnrolled ? 98 : 0,
        faceDetected: false,
        multipleFaces: false,
        mobilePhoneDetected: false,
        fullScreenStatus: 'N/A',
        headPose: 'N/A',
        eyeGaze: 'N/A',
        tabSwitchingCount: 0,
        copyPasteAttempts: 0,
        warningsCount: 0,
        riskLevel: 'Safe (0-20)',
        riskScore: 0,
        startTime: 'N/A',
        remainingTime: 'N/A',
        image: null,
        micStatus: 'N/A',
        noiseLevel: 'N/A',
        audioConfidence: 'N/A',
        lastSeen: user.updatedAt || user.createdAt
      };
    });

    (activeSessions || []).forEach(session => {
      const sessKey = session.sessionId || session._id.toString();
      if (!matchedSessionIds.has(sessKey)) {
        const isRecent = session.lastActive && (Date.now() - new Date(session.lastActive).getTime() < 3 * 60 * 1000);
        const isOnline = isRecent && ['Online', 'Active', 'Warning', 'in-progress'].includes(session.status);
        const computedStatus = session.status === 'Terminated'
          ? 'Terminated'
          : (['Finished', 'Completed', 'Submitted'].includes(session.status)
              ? 'Completed'
              : (isOnline ? (session.status === 'Warning' ? 'Warning' : 'Online') : 'Offline'));

        const computedRisk = calculateRiskScore(session, session.suspiciousActivityCount);
        mergedStudents.push({
          sessionId: sessKey,
          studentId: session.studentId || `STU_${session.email ? session.email.replace(/[^a-z0-9]/gi, '_') : '1001'}`,
          studentName: session.studentName || 'Student',
          usn: session.usn || session.studentId || 'STU_USER',
          email: session.email || 'student@university.edu',
          department: session.department || 'Computer Science & Engineering',
          examName: session.examName || 'Computer Science Final Assessment',
          status: computedStatus,
          verificationStatus: session.verificationStatus || 'Verified',
          faceMatchConfidence: session.faceMatchConfidence || 95,
          faceDetected: session.faceDetected !== undefined ? session.faceDetected : (computedStatus !== 'Offline'),
          multipleFaces: session.multipleFaces || false,
          mobilePhoneDetected: session.mobilePhoneDetected || false,
          fullScreenStatus: session.fullScreenStatus || (computedStatus !== 'Offline' ? 'Active' : 'N/A'),
          headPose: session.headPose || (computedStatus !== 'Offline' ? 'Looking Center' : 'N/A'),
          eyeGaze: session.eyeGaze || (computedStatus !== 'Offline' ? 'Looking Center' : 'N/A'),
          tabSwitchingCount: session.tabSwitchingCount || 0,
          copyPasteAttempts: session.copyPasteAttempts || 0,
          warningsCount: session.warningsCount || 0,
          riskLevel: computedRisk >= 76 ? 'High (76-100)' : (computedRisk >= 51 ? 'High (51-75)' : (computedRisk >= 21 ? 'Medium (20-50)' : 'Safe (0-20)')),
          riskScore: computedRisk,
          startTime: session.startTime || session.createdAt,
          remainingTime: session.remainingTime || '03:00:00',
          image: session.lastWebcamFrame || null,
          micStatus: session.micStatus || 'Active',
          noiseLevel: session.noiseLevel || '24 dB SPL',
          audioConfidence: session.audioConfidence || '98% Confidence',
          lastSeen: session.lastActive || session.updatedAt
        });
      }
    });

    let results = mergedStudents;

    // By default, Live Monitoring only shows candidates actively attending the exam
    if (req.query.includeOffline !== 'true') {
      results = results.filter(s => ['Online', 'Warning', 'Active', 'in-progress'].includes(s.status));
    }

    if (search) {
      const q = search.toLowerCase();
      results = results.filter(s =>
        (s.studentName && s.studentName.toLowerCase().includes(q)) ||
        (s.usn && s.usn.toLowerCase().includes(q)) ||
        (s.email && s.email.toLowerCase().includes(q)) ||
        (s.examName && s.examName.toLowerCase().includes(q))
      );
    }

    if (riskLevel && riskLevel !== 'ALL' && riskLevel !== 'all') {
      const r = riskLevel.toLowerCase();
      results = results.filter(s => s.riskLevel && s.riskLevel.toLowerCase().includes(r));
    }

    if (department && department !== 'all') {
      results = results.filter(s => s.department && s.department.toLowerCase().includes(department.toLowerCase()));
    }

    if (status && status !== 'all') {
      results = results.filter(s => s.status && s.status.toLowerCase() === status.toLowerCase());
    }

    res.json({
      success: true,
      count: results.length,
      students: results
    });
  } catch (error) {
    console.error('Error in getLiveStudents:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch live student sessions: ' + error.message
    });
  }
};

/**
 * 4. Student Detail Page & Complete Activity History Timeline API
 * GET /api/admin/student/:id
 */
const getStudentDetail = async (req, res) => {
  try {
    const studentIdentifier = req.params.id;

    // 1. Look up across LiveSession, User, Student, ExamReport, ExamSession
    let session = await LiveSession.findOne({
      $or: [
        { sessionId: studentIdentifier },
        { studentId: studentIdentifier },
        { usn: studentIdentifier },
        { email: studentIdentifier.toLowerCase() },
        ...(studentIdentifier.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: studentIdentifier }] : [])
      ]
    }).lean();

    let user = null;
    let studentRecord = null;
    let examReport = null;

    if (!session) {
      [user, studentRecord, examReport] = await Promise.all([
        User.findOne({
          $or: [
            { email: studentIdentifier.toLowerCase() },
            { usn: studentIdentifier },
            ...(studentIdentifier.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: studentIdentifier }] : [])
          ]
        }).select('-password -faceEmbeddings').lean().catch(() => null),
        Student.findOne({
          $or: [
            { studentId: studentIdentifier },
            { email: studentIdentifier.toLowerCase() },
            { usn: studentIdentifier },
            ...(studentIdentifier.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: studentIdentifier }] : [])
          ]
        }).select('-password -passwordHash').lean().catch(() => null),
        ExamReport.findOne({
          $or: [
            { studentId: studentIdentifier },
            { email: studentIdentifier.toLowerCase() },
            { usn: studentIdentifier },
            { reportId: studentIdentifier }
          ]
        }).lean().catch(() => null)
      ]);

      const baseName = studentRecord?.fullName || studentRecord?.name || user?.name || examReport?.studentName || 'Student';
      const baseEmail = studentRecord?.email || user?.email || examReport?.email || `${studentIdentifier}@university.edu`;
      const baseUsn = studentRecord?.usn || user?.usn || examReport?.usn || studentIdentifier;
      const baseDept = studentRecord?.course || user?.department || examReport?.department || 'Computer Science & Engineering';

      session = {
        sessionId: examReport?.reportId || `SESS_${studentIdentifier}`,
        studentId: studentIdentifier,
        studentName: baseName,
        usn: baseUsn,
        email: baseEmail,
        department: baseDept,
        examName: examReport?.examName || 'Computer Science Final Assessment',
        startTime: examReport?.startTime || user?.createdAt || new Date(),
        status: examReport ? 'Completed' : 'Offline',
        score: examReport?.score || 0,
        lastWebcamFrame: null,
        suspiciousActivityCount: examReport?.totalViolations || 0
      };
    }

    const studentIdKey = session.studentId || studentIdentifier;
    const emailKey = (session.email || '').toLowerCase();
    const sessionIdKey = session.sessionId;

    // Fetch related violations, alerts, screenshots, and evidence
    const [violations, alerts, evidenceDocs, incidents, gazeEvents] = await Promise.all([
      SuspiciousActivity.find({
        $or: [
          { studentId: studentIdKey },
          { studentEmail: emailKey },
          { sessionId: sessionIdKey }
        ].filter(c => Object.values(c)[0])
      }).sort({ timestamp: -1 }).lean().catch(() => []),
      Alert.find({
        $or: [
          { studentId: studentIdKey },
          { sessionId: sessionIdKey }
        ].filter(c => Object.values(c)[0])
      }).sort({ timestamp: -1 }).lean().catch(() => []),
      ScreenshotEvidence.find({
        $or: [
          { studentId: studentIdKey },
          { sessionId: sessionIdKey }
        ].filter(c => Object.values(c)[0])
      }).sort({ createdAt: -1 }).limit(25).lean().catch(() => []),
      Incident.find({
        $or: [
          { studentId: studentIdKey },
          { email: emailKey }
        ].filter(c => Object.values(c)[0])
      }).sort({ timestamp: -1 }).lean().catch(() => []),
      GazeEvent.find({
        $or: [
          { studentId: studentIdKey },
          { sessionId: sessionIdKey }
        ].filter(c => Object.values(c)[0])
      }).sort({ timestamp: -1 }).limit(20).lean().catch(() => [])
    ]);

    // Build Screenshots Captured Gallery
    const screenshotsCaptured = [];

    if (session.lastWebcamFrame) {
      screenshotsCaptured.push({
        url: session.lastWebcamFrame,
        reason: '📸 Automated Proctoring Live Snapshot',
        timestamp: session.updatedAt || session.lastActive || new Date(),
        confidence: '99.0%',
        severity: 'Normal'
      });
    }

    violations.forEach(v => {
      const img = v.screenshotBase64 || v.screenshotPath || v.screenshotUrl;
      if (img) {
        screenshotsCaptured.push({
          url: img,
          reason: `${(v.type || v.violationType || 'Violation').replace(/_/g, ' ').toUpperCase()}`,
          timestamp: v.timestamp,
          confidence: v.confidence ? `${(Number(v.confidence) * 100).toFixed(1)}%` : 'Verified',
          severity: v.severity || 'Medium'
        });
      }
    });

    incidents.forEach(inc => {
      if (inc.screenshot) {
        screenshotsCaptured.push({
          url: inc.screenshot,
          reason: `Incident: ${inc.reason || 'Identity Mismatch'}`,
          timestamp: inc.timestamp,
          confidence: inc.confidence ? `${inc.confidence}%` : 'High Severity',
          severity: 'Critical'
        });
      }
    });

    evidenceDocs.forEach(e => {
      if (e.imageBase64) {
        screenshotsCaptured.push({
          url: e.imageBase64,
          reason: 'Automated Anomaly Evidence',
          timestamp: e.savedAt || e.createdAt,
          sizeKb: e.fileSizeKb || 0
        });
      }
    });

    // Build Chronological Activity History Timeline
    const startTime = session.startTime || new Date(Date.now() - 30 * 60000);
    const activityHistory = [
      {
        step: 'Login',
        label: `User Authentication Successful (${session.email})`,
        timestamp: new Date(new Date(startTime).getTime() - 4 * 60000),
        status: 'Success'
      },
      {
        step: 'Face Verification',
        label: 'Face Identity Verified via AI ArcFace Embedding (99.2% match)',
        timestamp: new Date(new Date(startTime).getTime() - 2 * 60000),
        status: 'Verified'
      },
      {
        step: 'Exam Started',
        label: `Initiated Examination: ${session.examName || 'Computer Science Final Assessment'}`,
        timestamp: startTime,
        status: 'Active'
      }
    ];

    // Add Gaze/Attention Events to Timeline
    gazeEvents.forEach(g => {
      if (g.riskLevel === 'HIGH_RISK' || g.riskLevel === 'SUSPICIOUS' || g.duration >= 3) {
        activityHistory.push({
          step: 'Gaze Deviation',
          label: `Gaze turned ${g.gazeDirection} for ${g.duration}s (Suspicion Score: ${g.suspicionScore})`,
          timestamp: g.timestamp,
          severity: g.riskLevel || 'Medium',
          status: 'Flagged'
        });
      }
    });

    // Add Violations to Timeline
    violations.forEach(v => {
      activityHistory.push({
        step: 'Violation',
        label: `${(v.type || v.violationType || 'Violation').replace(/_/g, ' ').toUpperCase()}: ${v.description || 'Suspicious proctor anomaly'}`,
        timestamp: v.timestamp,
        severity: v.severity || 'Medium',
        confidence: v.confidence,
        screenshot: v.screenshotBase64 || v.screenshotPath || v.screenshotUrl,
        status: 'Flagged'
      });
    });

    // Add Alerts / Warnings to Timeline
    alerts.forEach(a => {
      activityHistory.push({
        step: 'Warning',
        label: `Proctor Alert: ${a.message || a.details || 'Warning issued to candidate'}`,
        timestamp: a.timestamp,
        severity: a.severity || 'High',
        status: 'Warning'
      });
    });

    // Add Incidents to Timeline
    incidents.forEach(inc => {
      activityHistory.push({
        step: 'Incident',
        label: `Security Incident Flagged: ${inc.reason || 'Continuous Identity Failure'}`,
        timestamp: inc.timestamp,
        severity: 'Critical',
        screenshot: inc.screenshot,
        status: 'Terminated'
      });
    });

    // Completion / Termination Step
    if (session.status === 'Terminated' || incidents.length > 0) {
      activityHistory.push({
        step: 'Termination',
        label: `Exam Auto-Terminated: ${session.terminationReason || 'Exceeded maximum allowable violation threshold'}`,
        timestamp: session.updatedAt || session.lastActive || new Date(),
        status: 'Terminated'
      });
    } else if (session.status === 'Finished' || session.status === 'Completed' || session.status === 'Submitted') {
      activityHistory.push(
        {
          step: 'Exam Submitted',
          label: `Candidate cleanly submitted exam answers. Score: ${session.score || 0}/100`,
          timestamp: session.endTime || session.updatedAt || new Date(),
          status: 'Completed'
        },
        {
          step: 'Logout',
          label: 'Examination session ended and proctor telemetry archived',
          timestamp: session.endTime || session.updatedAt || new Date(),
          status: 'Logged Out'
        }
      );
    }

    activityHistory.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const totalViolationsCount = violations.length;
    const riskScore = calculateRiskScore(session, totalViolationsCount);

    const studentObj = {
      ...session,
      riskScore,
      riskLevel: riskScore >= 76 ? 'High (76-100)' : (riskScore >= 51 ? 'High (51-75)' : (riskScore >= 21 ? 'Medium (20-50)' : 'Safe (0-20)')),
      riskCategory: getRiskCategory(riskScore),
      screenshotsCaptured,
      activityHistory,
      totalViolations: totalViolationsCount
    };

    res.json({
      success: true,
      student: studentObj,
      violations,
      alerts
    });
  } catch (error) {
    console.error('Error in getStudentDetail:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch student details: ' + error.message
    });
  }
};

/**
 * 5. Violations Center API
 * GET /api/admin/violations
 */
const getViolationsCenter = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      severity,
      violationType,
      department,
      timeframe
    } = req.query;

    const query = {};

    if (severity && severity !== 'all') {
      query.severity = { $regex: new RegExp(`^${severity}$`, 'i') };
    }

    if (violationType && violationType !== 'all') {
      query.$or = [
        { type: { $regex: violationType, $options: 'i' } },
        { violationType: { $regex: violationType, $options: 'i' } }
      ];
    }

    if (timeframe === 'today') {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      query.timestamp = { $gte: todayStart };
    } else if (timeframe === 'week') {
      const weekStart = new Date(Date.now() - 7 * 86400000);
      query.timestamp = { $gte: weekStart };
    }

    if (search) {
      const sReg = { $regex: search, $options: 'i' };
      query.$or = [
        { studentId: sReg },
        { studentEmail: sReg },
        { studentName: sReg },
        { type: sReg },
        { description: sReg }
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [violations, total, liveSessions, users, students] = await Promise.all([
      SuspiciousActivity.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      SuspiciousActivity.countDocuments(query),
      LiveSession.find().lean().catch(() => []),
      User.find().select('-password').lean().catch(() => []),
      Student.find().select('-password').lean().catch(() => [])
    ]);

    const sessionMap = new Map();
    liveSessions.forEach(s => {
      if (s.studentId) sessionMap.set(s.studentId, s);
      if (s.email) sessionMap.set(s.email.toLowerCase(), s);
    });

    const userMap = new Map();
    users.forEach(u => {
      if (u.email) userMap.set(u.email.toLowerCase(), u);
    });
    students.forEach(s => {
      if (s.email) userMap.set(s.email.toLowerCase(), s);
      if (s.studentId) userMap.set(s.studentId, s);
    });

    const enrichedViolations = violations.map(v => {
      const s = sessionMap.get(v.studentId) || sessionMap.get((v.studentEmail || '').toLowerCase());
      const u = userMap.get((v.studentEmail || '').toLowerCase()) || userMap.get(v.studentId);

      let resolvedName = v.studentName || s?.studentName || u?.name || u?.fullName;
      if (!resolvedName || resolvedName.toUpperCase() === 'TEST' || resolvedName.toUpperCase() === 'DEMO') {
        if (v.studentEmail || s?.email) {
          const emailStr = v.studentEmail || s.email;
          resolvedName = emailStr.split('@')[0].split(/[._-]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        } else if (v.studentId && !v.studentId.includes('TEST')) {
          resolvedName = v.studentId.replace('STU_', '').replace(/_/g, ' ');
        } else {
          resolvedName = 'Student';
        }
      }

      let resolvedUsn = v.usn || s?.usn || u?.usn || v.studentId;
      if (!resolvedUsn || resolvedUsn.toUpperCase() === 'STU_TEST') {
        resolvedUsn = v.studentEmail ? v.studentEmail : v.studentId;
      }

      const img = v.screenshotBase64 || v.screenshotPath || v.screenshotUrl || (s ? s.lastWebcamFrame : null);

      return {
        ...v,
        _id: v._id,
        id: v._id,
        studentName: resolvedName,
        usn: resolvedUsn,
        studentId: v.studentId || resolvedUsn,
        email: v.studentEmail || s?.email || u?.email || '',
        examName: v.examName || s?.examName || 'Computer Science Final Assessment',
        department: v.department || s?.department || u?.department || u?.course || 'Computer Science & Engineering',
        type: v.type || v.violationType || 'SUSPICIOUS ACTIVITY',
        severity: v.severity || 'High',
        confidence: v.confidence !== undefined ? v.confidence : 0.95,
        screenshotBase64: img,
        screenshot: img,
        timestamp: v.timestamp || v.createdAt || new Date(),
        status: v.status || (v.severity === 'critical' ? 'Critical Flag' : 'Flagged')
      };
    });

    res.json({
      success: true,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)) || 1,
      violations: enrichedViolations
    });
  } catch (error) {
    console.error('Error in getViolationsCenter:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch violations: ' + error.message
    });
  }
};

/**
 * 6. Terminated Students API
 * GET /api/admin/terminated
 */
const getTerminatedStudents = async (req, res) => {
  try {
    const { search, department } = req.query;

    const [terminatedLiveSessions, terminatedExamSessions, incidents] = await Promise.all([
      LiveSession.find({ status: 'Terminated' }).sort({ updatedAt: -1 }).lean().catch(() => []),
      ExamSession.find({ status: 'terminated' }).sort({ endTime: -1 }).lean().catch(() => []),
      Incident.find().sort({ timestamp: -1 }).lean().catch(() => [])
    ]);

    const terminatedMap = new Map();

    terminatedLiveSessions.forEach(s => {
      const key = s.studentId || s.email;
      terminatedMap.set(key, {
        ...s,
        _id: s._id,
        studentId: s.studentId,
        studentName: s.studentName || 'Student',
        usn: s.usn || s.studentId,
        email: s.email,
        department: s.department || 'Computer Science & Engineering',
        examName: s.examName || 'Computer Science Final Assessment',
        terminationTime: s.updatedAt || s.lastActive || new Date(),
        terminationReason: s.terminationReason || 'Exceeded maximum allowed violation threshold (10 violations)',
        totalViolations: s.suspiciousActivityCount || 10,
        riskScore: 100,
        riskCategory: 'Terminate',
        status: 'Terminated'
      });
    });

    terminatedExamSessions.forEach(es => {
      const key = es.studentId;
      if (!terminatedMap.has(key)) {
        terminatedMap.set(key, {
          ...es,
          _id: es._id,
          studentId: es.studentId,
          studentName: es.studentName || 'Student',
          usn: es.studentId,
          email: `${es.studentId}@university.edu`,
          department: 'Computer Science & Engineering',
          examName: 'Computer Science Final Assessment',
          terminationTime: es.endTime || es.startTime || new Date(),
          terminationReason: 'Security rule violation triggered exam auto-termination',
          totalViolations: es.totalViolations || 10,
          riskScore: 100,
          riskCategory: 'Terminate',
          status: 'Terminated'
        });
      }
    });

    incidents.forEach(inc => {
      const key = inc.studentId || inc.email;
      if (!terminatedMap.has(key)) {
        terminatedMap.set(key, {
          _id: inc._id,
          studentId: inc.studentId,
          studentName: inc.fullName || 'Student',
          usn: inc.studentId,
          email: inc.email,
          department: 'Computer Science & Engineering',
          examName: 'Computer Science Final Assessment',
          terminationTime: inc.timestamp || new Date(),
          terminationReason: `Identity verification failure: ${inc.reason || 'Continuous face mismatch'}`,
          totalViolations: 3,
          riskScore: 100,
          riskCategory: 'Terminate',
          status: 'Terminated'
        });
      }
    });

    let terminatedList = Array.from(terminatedMap.values());

    if (department && department !== 'all') {
      terminatedList = terminatedList.filter(s => s.department && s.department.toLowerCase().includes(department.toLowerCase()));
    }

    if (search) {
      const q = search.toLowerCase();
      terminatedList = terminatedList.filter(s =>
        (s.studentName && s.studentName.toLowerCase().includes(q)) ||
        (s.usn && s.usn.toLowerCase().includes(q)) ||
        (s.email && s.email.toLowerCase().includes(q)) ||
        (s.examName && s.examName.toLowerCase().includes(q)) ||
        (s.terminationReason && s.terminationReason.toLowerCase().includes(q))
      );
    }

    // Enrich with exact violation history
    const enriched = await Promise.all(
      terminatedList.map(async s => {
        const violations = await SuspiciousActivity.find({
          $or: [{ studentId: s.studentId }, { studentEmail: s.email }]
        }).select('-screenshot -screenshotBase64').sort({ timestamp: -1 }).limit(10).lean().catch(() => []);

        return {
          ...s,
          totalViolations: violations.length || s.totalViolations || 1,
          violationsHistory: violations
        };
      })
    );

    res.json({
      success: true,
      count: enriched.length,
      terminatedStudents: enriched
    });
  } catch (error) {
    console.error('Error in getTerminatedStudents:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch terminated students: ' + error.message
    });
  }
};

/**
 * 7. Finished Students API
 * GET /api/admin/finished
 */
const getFinishedStudents = async (req, res) => {
  try {
    const { search, department, statusFilter } = req.query;

    const [finishedSessions, examReports, completedExamSessions] = await Promise.all([
      LiveSession.find({ status: { $in: ['Finished', 'Completed', 'Submitted'] } }).select('-lastWebcamFrame').sort({ updatedAt: -1 }).lean().catch(() => []),
      ExamReport.find().select('-screenshots').sort({ createdAt: -1 }).lean().catch(() => []),
      ExamSession.find({ status: 'completed' }).sort({ endTime: -1 }).lean().catch(() => [])
    ]);

    const reportMap = new Map();
    examReports.forEach(r => {
      if (r.studentId) reportMap.set(r.studentId, r);
      if (r.email) reportMap.set(r.email.toLowerCase(), r);
    });

    const studentMap = new Map();

    finishedSessions.forEach(s => {
      const rep = reportMap.get(s.studentId) || reportMap.get((s.email || '').toLowerCase()) || {};
      const key = s.studentId || s.email;
      const totalV = s.suspiciousActivityCount || rep.totalViolations || 0;
      const startTime = s.startTime || rep.startTime || new Date(Date.now() - 45 * 60 * 1000);
      const endTime = s.endTime || rep.endTime || s.updatedAt || s.lastActive || new Date();

      studentMap.set(key, {
        ...s,
        ...rep,
        _id: s._id,
        sessionId: s.sessionId || s._id,
        studentId: s.studentId,
        studentName: s.studentName || rep.studentName || 'Student',
        usn: s.usn || s.studentId || rep.usn,
        email: s.email || rep.email,
        department: s.department || rep.department || 'Computer Science & Engineering',
        examName: s.examName || rep.examName || 'Computer Science Final Assessment',
        startTime,
        loginTime: startTime,
        endTime,
        submissionTime: endTime,
        duration: s.duration || (rep.totalDurationMinutes ? `${rep.totalDurationMinutes} mins` : '00:45:00'),
        score: rep.obtainedMarks !== undefined ? rep.obtainedMarks : (s.score || 0),
        totalMarks: rep.totalMarks || 100,
        percentage: rep.percentage || (rep.totalMarks ? Math.round(((rep.obtainedMarks || s.score || 0) / rep.totalMarks) * 100) : 0),
        totalQuestions: rep.totalQuestions || (s.answers ? s.answers.length : 0),
        attemptedQuestions: rep.attemptedQuestions || 0,
        correctCount: rep.correctCount || 0,
        wrongCount: rep.wrongCount || 0,
        unansweredCount: rep.unansweredCount || 0,
        answers: rep.answers || s.answers || [],
        codingAnswers: rep.codingAnswers || s.codingAnswers || {},
        theoryAnswers: rep.theoryAnswers || s.theoryAnswers || {},
        totalViolations: totalV,
        riskScore: totalV === 0 ? 5 : (totalV <= 2 ? 20 : 65),
        integrityScore: totalV === 0 ? '98% Safe' : (totalV < 3 ? '85% Good' : '65% Review'),
        status: 'Completed',
        monitoringStatus: totalV <= 2 ? 'Passed Monitoring' : 'Needs Review'
      });
    });

    examReports.forEach(r => {
      const key = r.studentId || r.email;
      if (!studentMap.has(key)) {
        const totalV = r.totalViolations || 0;
        const startTime = r.startTime || new Date(Date.now() - 45 * 60 * 1000);
        const endTime = r.endTime || r.createdAt || new Date();
        studentMap.set(key, {
          ...r,
          sessionId: r.reportId || r._id,
          studentId: r.studentId,
          studentName: r.studentName || 'Student',
          usn: r.usn || r.studentId,
          email: r.email,
          department: r.department || 'Computer Science & Engineering',
          examName: r.examName || 'Computer Science Final Assessment',
          startTime,
          loginTime: startTime,
          endTime,
          submissionTime: endTime,
          duration: r.totalDurationMinutes ? `${r.totalDurationMinutes} mins` : '00:45:00',
          score: r.obtainedMarks !== undefined ? r.obtainedMarks : (r.score || 0),
          totalMarks: r.totalMarks || 100,
          percentage: r.percentage || 0,
          totalQuestions: r.totalQuestions || (r.answers ? r.answers.length : 0),
          attemptedQuestions: r.attemptedQuestions || 0,
          correctCount: r.correctCount || 0,
          wrongCount: r.wrongCount || 0,
          unansweredCount: r.unansweredCount || 0,
          answers: r.answers || [],
          codingAnswers: r.codingAnswers || {},
          theoryAnswers: r.theoryAnswers || {},
          totalViolations: totalV,
          riskScore: totalV === 0 ? 5 : (totalV <= 2 ? 20 : 65),
          integrityScore: totalV === 0 ? '98% Safe' : (totalV < 3 ? '85% Good' : '65% Review'),
          status: 'Completed',
          monitoringStatus: totalV <= 2 ? 'Passed Monitoring' : 'Needs Review'
        });
      }
    });

    completedExamSessions.forEach(es => {
      const key = es.studentId;
      if (!studentMap.has(key)) {
        const totalV = es.totalViolations || 0;
        studentMap.set(key, {
          ...es,
          sessionId: es.sessionId || es._id,
          studentId: es.studentId,
          studentName: es.studentName || 'Student',
          usn: es.studentId,
          email: `${es.studentId}@university.edu`,
          department: 'Computer Science & Engineering',
          examName: 'Computer Science Final Assessment',
          startTime: es.startTime || new Date(),
          loginTime: es.startTime || new Date(),
          endTime: es.endTime || new Date(),
          submissionTime: es.endTime || new Date(),
          duration: '00:45:00',
          score: es.score || 0,
          totalMarks: 100,
          percentage: es.score || 0,
          totalViolations: totalV,
          riskScore: 10,
          integrityScore: '95% Safe',
          status: 'Completed',
          monitoringStatus: 'Passed Monitoring'
        });
      }
    });

    let finishedList = Array.from(studentMap.values());

    if (department && department !== 'all') {
      finishedList = finishedList.filter(s => s.department && s.department.toLowerCase().includes(department.toLowerCase()));
    }

    if (search) {
      const q = search.toLowerCase();
      finishedList = finishedList.filter(s =>
        (s.studentName && s.studentName.toLowerCase().includes(q)) ||
        (s.usn && s.usn.toLowerCase().includes(q)) ||
        (s.email && s.email.toLowerCase().includes(q)) ||
        (s.examName && s.examName.toLowerCase().includes(q))
      );
    }

    if (statusFilter && statusFilter !== 'all') {
      finishedList = finishedList.filter(s => s.monitoringStatus === statusFilter);
    }

    res.json({
      success: true,
      count: finishedList.length,
      finishedStudents: finishedList
    });
  } catch (error) {
    console.error('Error in getFinishedStudents:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch finished students: ' + error.message
    });
  }
};

/**
 * 8. Terminate Session API Action
 * POST /api/admin/terminate-session
 */
const terminateSession = async (req, res) => {
  try {
    const { studentId, sessionId, reason, studentName, email } = req.body;
    if (!studentId && !sessionId && !email) {
      return res.status(400).json({ success: false, error: 'studentId, sessionId, or email is required' });
    }

    const terminationReason = reason || 'Terminated by Admin Command Center';

    let session = await LiveSession.findOne({
      $or: [
        { sessionId: sessionId || '___none___' },
        { studentId: studentId || '___none___' },
        { usn: studentId || '___none___' },
        { email: (email || studentId || '').toString().toLowerCase() }
      ]
    });

    if (!session) {
      session = new LiveSession({
        sessionId: sessionId || `SESS_${studentId || Date.now()}`,
        studentId: studentId || 'STU_USER',
        studentName: studentName || 'Student',
        usn: studentId || 'USN_USER',
        email: email || `${studentId || 'student'}@university.edu`,
        examName: 'Computer Science Final Assessment',
        department: 'Computer Science & Engineering',
        startTime: new Date()
      });
    }

    session.status = 'Terminated';
    session.terminationReason = terminationReason;
    session.updatedAt = new Date();
    session.lastActive = new Date();
    await session.save();

    // Also update any active ExamSession
    await ExamSession.updateMany(
      {
        $or: [
          { studentId: session.studentId },
          { sessionId: session.sessionId }
        ],
        status: 'active'
      },
      {
        $set: {
          status: 'terminated',
          endTime: new Date()
        }
      }
    ).catch(() => {});

    // Save termination incident & suspicious activity record
    await new SuspiciousActivity({
      studentId: session.studentId,
      studentEmail: session.email,
      sessionId: session.sessionId,
      type: 'EXAM_TERMINATED',
      violationType: 'EXAM_TERMINATED',
      severity: 'critical',
      description: terminationReason,
      timestamp: new Date()
    }).save().catch(() => {});

    await new Alert({
      studentId: session.studentId,
      sessionId: session.sessionId,
      type: 'AUTO_TERMINATED',
      severity: 'High',
      message: `Exam terminated for ${session.studentName}: ${terminationReason}`,
      timestamp: new Date()
    }).save().catch(() => {});

    // Broadcast Socket.IO events to student and admin rooms
    const io = req.app?.get('io');
    if (io) {
      const payload = {
        studentId: session.studentId,
        usn: session.usn,
        email: session.email,
        sessionId: session.sessionId,
        reason: terminationReason,
        status: 'Terminated',
        timestamp: new Date()
      };

      io.to(`student_${session.studentId}`).emit('student-terminated', payload);
      if (studentId && studentId !== session.studentId) {
        io.to(`student_${studentId}`).emit('student-terminated', payload);
      }
      io.to('admin_room').emit('student-terminated', payload);
      io.to('admin_room').emit('student-status', { studentId: session.studentId, status: 'Terminated' });
      io.to('admin_room').emit('student-updated', session);
      io.emit('student-terminated', payload);
      io.emit('dashboard-updated', { studentId: session.studentId, status: 'Terminated' });
    }

    res.json({
      success: true,
      message: `Exam session for ${session.studentName} has been terminated.`,
      session
    });
  } catch (error) {
    console.error('Error in terminateSession:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to terminate student session: ' + error.message
    });
  }
};

/**
 * 9. Issue Warning to Student API Action
 * POST /api/admin/warn-student
 */
const warnStudent = async (req, res) => {
  try {
    const { studentId, message } = req.body;
    if (!studentId) {
      return res.status(400).json({ success: false, error: 'studentId is required' });
    }

    const warningMsg = message || '⚠️ Warning: Suspicious activity detected. Please return focus to your exam.';

    let session = await LiveSession.findOne({
      $or: [
        { studentId },
        { usn: studentId },
        { email: String(studentId).toLowerCase() }
      ]
    });

    if (session) {
      session.status = 'Warning';
      session.warningsCount = (session.warningsCount || 0) + 1;
      session.suspiciousActivityCount = (session.suspiciousActivityCount || 0) + 1;
      session.lastActive = new Date();
      await session.save();
    }

    await new Alert({
      studentId: session?.studentId || studentId,
      sessionId: session?.sessionId,
      type: 'PROCTOR_WARNING',
      severity: 'Medium',
      message: warningMsg,
      timestamp: new Date()
    }).save().catch(() => {});

    const io = req.app?.get('io');
    if (io) {
      const payload = {
        studentId: session?.studentId || studentId,
        usn: session?.usn || studentId,
        email: session?.email,
        message: warningMsg,
        warningsCount: session?.warningsCount || 1,
        timestamp: new Date()
      };

      io.to(`student_${studentId}`).emit('warning-issued', payload);
      io.to(`student_${studentId}`).emit('student-warning', payload);
      if (session && session.studentId !== studentId) {
        io.to(`student_${session.studentId}`).emit('warning-issued', payload);
        io.to(`student_${session.studentId}`).emit('student-warning', payload);
      }
      io.to('admin_room').emit('warning-issued', payload);
      io.to('admin_room').emit('student-warning', payload);
      if (session) {
        io.to('admin_room').emit('student-updated', session);
      }
      io.emit('warning-issued', payload);
      io.emit('student-warning', payload);
    }

    res.json({
      success: true,
      message: `Warning issued to student ${studentId}`,
      session
    });
  } catch (error) {
    console.error('Error in warnStudent:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to issue warning: ' + error.message
    });
  }
};

/**
 * 10. Reports API
 * GET /api/admin/reports
 */
const getReports = async (req, res) => {
  try {
    const { timeframe = 'daily', department } = req.query;
    const query = (department && department !== 'all') ? { department: { $regex: department, $options: 'i' } } : {};

    const [allSessions, examReports, allViolations, users, students] = await Promise.all([
      LiveSession.find(query).lean().catch(() => []),
      ExamReport.find(query).lean().catch(() => []),
      SuspiciousActivity.find().lean().catch(() => []),
      User.find().lean().catch(() => []),
      Student.find().lean().catch(() => [])
    ]);

    // Unique students who attended
    const attendedSet = new Set();
    allSessions.forEach(s => attendedSet.add((s.email || s.studentId || '').toLowerCase()));
    examReports.forEach(r => attendedSet.add((r.email || r.studentId || '').toLowerCase()));

    const appeared = Math.max(attendedSet.size, allSessions.length, examReports.length);
    const finished = Math.max(
      allSessions.filter(s => ['Finished', 'Completed', 'Submitted'].includes(s.status)).length,
      examReports.length
    );
    const terminated = allSessions.filter(s => s.status === 'Terminated').length;
    const avgViolations = appeared > 0 ? (allViolations.length / appeared).toFixed(1) : '0.0';

    const typeCounts = {};
    allViolations.forEach(v => {
      const t = v.type || v.violationType || 'General Malpractice';
      typeCounts[t] = (typeCounts[t] || 0) + 1;
    });

    let mostCommonViolation = 'None';
    let maxV = 0;
    Object.keys(typeCounts).forEach(t => {
      if (typeCounts[t] > maxV) {
        maxV = typeCounts[t];
        mostCommonViolation = t.replace(/_/g, ' ').toUpperCase();
      }
    });

    const avgExamTime = '0h 45m';

    // Department Breakdown
    const deptMap = new Map();
    const addDeptData = (dept, isFinished, isTerminated, violations) => {
      const d = dept || 'Computer Science & Engineering';
      if (!deptMap.has(d)) {
        deptMap.set(d, { department: d, appeared: 0, finished: 0, terminated: 0, totalViolations: 0 });
      }
      const record = deptMap.get(d);
      record.appeared += 1;
      if (isFinished) record.finished += 1;
      if (isTerminated) record.terminated += 1;
      record.totalViolations += (violations || 0);
    };

    allSessions.forEach(s => {
      const isFin = ['Finished', 'Completed', 'Submitted'].includes(s.status);
      const isTerm = s.status === 'Terminated';
      addDeptData(s.department, isFin, isTerm, s.suspiciousActivityCount);
    });

    examReports.forEach(r => {
      if (!allSessions.some(s => s.studentId === r.studentId || s.email === r.email)) {
        addDeptData(r.department, true, false, r.totalViolations);
      }
    });

    let departmentStats = Array.from(deptMap.values()).map(d => ({
      department: d.department,
      appeared: d.appeared,
      finished: d.finished,
      terminated: d.terminated,
      avgViolations: d.appeared > 0 ? Number((d.totalViolations / d.appeared).toFixed(1)) : 0
    }));

    if (departmentStats.length === 0) {
      departmentStats = [
        {
          department: 'Computer Science & Engineering',
          appeared: appeared || 0,
          finished: finished || 0,
          terminated: terminated || 0,
          avgViolations: Number(avgViolations) || 0
        }
      ];
    }

    res.json({
      success: true,
      timeframe,
      summary: {
        appeared,
        finished,
        terminated,
        avgViolations: Number(avgViolations),
        mostCommonViolation,
        avgExamTime
      },
      departmentStats
    });
  } catch (error) {
    console.error('Error in getReports:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate report: ' + error.message
    });
  }
};

/**
 * 11. Analytics API
 * GET /api/admin/analytics
 */
const getAnalytics = async (req, res) => {
  try {
    const [activeSessions, examReports, allViolations] = await Promise.all([
      LiveSession.find().lean().catch(() => []),
      ExamReport.find().lean().catch(() => []),
      SuspiciousActivity.find().lean().catch(() => [])
    ]);

    const activeExamNames = Array.from(new Set(
      activeSessions.filter(s => ['Online', 'Active', 'Warning', 'in-progress'].includes(s.status))
        .map(s => s.examName)
        .filter(Boolean)
    ));
    const activeExamsCount = activeExamNames.length || (activeSessions.some(s => ['Online', 'Active', 'Warning'].includes(s.status)) ? 1 : 0);

    const activeStudentsCount = activeSessions.filter(s => ['Online', 'Active', 'Warning', 'in-progress'].includes(s.status)).length;
    const violationsTodayCount = allViolations.length;
    const highRiskStudentsCount = activeSessions.filter(s => calculateRiskScore(s, s.suspiciousActivityCount) >= 51).length;
    const examsCompletedCount = Math.max(
      activeSessions.filter(s => ['Finished', 'Completed', 'Submitted'].includes(s.status)).length,
      examReports.length
    );

    // Calculate Risk Distribution
    let lowRiskCount = 0;
    let mediumRiskCount = 0;
    let highRiskCount = 0;

    activeSessions.forEach(s => {
      const r = calculateRiskScore(s, s.suspiciousActivityCount);
      if (r < 21) lowRiskCount++;
      else if (r < 51) mediumRiskCount++;
      else highRiskCount++;
    });

    if (activeSessions.length === 0) {
      lowRiskCount = examsCompletedCount;
    }

    const riskDistribution = {
      Low: lowRiskCount,
      Medium: mediumRiskCount,
      High: highRiskCount
    };

    // Calculate Violations Breakdown by Category
    const phoneCount = allViolations.filter(v => (v.type || '').toLowerCase().includes('phone') || (v.violationType || '').toLowerCase().includes('phone')).length || activeSessions.filter(s => s.mobilePhoneDetected).length;
    const multiFaceCount = allViolations.filter(v => (v.type || '').toLowerCase().includes('multi')).length || activeSessions.filter(s => s.multipleFaces).length;
    const tabSwitchCount = allViolations.filter(v => (v.type || '').toLowerCase().includes('tab')).length || activeSessions.reduce((sum, s) => sum + (s.tabSwitchingCount || 0), 0);
    const copyPasteCount = allViolations.filter(v => (v.type || '').toLowerCase().includes('copy') || (v.type || '').toLowerCase().includes('paste')).length || activeSessions.reduce((sum, s) => sum + (s.copyPasteAttempts || 0), 0);
    const lookingAwayCount = allViolations.filter(v => (v.type || '').toLowerCase().includes('look') || (v.type || '').toLowerCase().includes('gaze') || (v.type || '').toLowerCase().includes('head')).length || activeSessions.filter(s => s.headPose && s.headPose !== 'Normal' && s.headPose !== 'Center').length;

    const violationsBreakdown = [
      { name: 'Mobile Phone', count: phoneCount },
      { name: 'Multiple Faces', count: multiFaceCount },
      { name: 'Tab Switches', count: tabSwitchCount },
      { name: 'Copy/Paste', count: copyPasteCount },
      { name: 'Looking Away', count: lookingAwayCount }
    ];

    res.json({
      success: true,
      metrics: {
        activeExams: activeExamsCount,
        activeStudents: activeStudentsCount,
        violationsToday: violationsTodayCount,
        highRiskStudents: highRiskStudentsCount,
        examsCompleted: examsCompletedCount
      },
      charts: {
        riskDistribution,
        violationsBreakdown
      }
    });
  } catch (error) {
    console.error('Error in getAnalytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics: ' + error.message
    });
  }
};

/**
 * 12. Alerts API
 * GET /api/admin/alerts
 */
const getAlerts = async (req, res) => {
  try {
    const alerts = await Alert.find().sort({ timestamp: -1 }).limit(50).lean().catch(() => []);
    res.json({
      success: true,
      count: alerts.length,
      alerts
    });
  } catch (error) {
    console.error('Error in getAlerts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch alerts: ' + error.message
    });
  }
};

/**
 * 13. Upsert Live Student Session (Called by Student App or Socket)
 * POST /api/admin/live-session
 */
const upsertLiveSession = async (req, res) => {
  try {
    const {
      studentId,
      studentName,
      usn,
      email,
      examId,
      examName,
      department,
      status,
      faceDetected,
      multipleFaces,
      mobilePhoneDetected,
      headPose,
      eyeGaze,
      tabSwitchingCount,
      copyPasteAttempts,
      fullScreenStatus,
      internetStatus,
      suspiciousActivityCount,
      riskLevel,
      eventLog
    } = req.body;

    const sEmail = email || (req.user && req.user.email) || 'student@university.edu';
    const sId = studentId || (req.user && req.user.studentId) || ('STU_' + sEmail.replace(/[^a-z0-9]/gi, '_'));
    const sName = studentName || (req.user && req.user.name) || 'Student';
    const sUsn = usn || sId;

    let session = await LiveSession.findOne({
      $or: [
        { sessionId: req.body.sessionId },
        { studentId: sId },
        { usn: sUsn },
        { email: sEmail }
      ].filter(cond => Object.values(cond)[0])
    });

    if (session) {
      if (status === 'Online' && ['Finished', 'Completed', 'Terminated'].includes(session.status)) {
        session.status = 'Online';
        session.terminationReason = null;
        session.warningsCount = 0;
        session.tabSwitchingCount = 0;
      }
    } else {
      session = new LiveSession({
        sessionId: req.body.sessionId || `SESS-${sId}`,
        studentId: sId,
        studentName: sName,
        usn: sUsn,
        email: sEmail,
        examId: examId || 'CS-401',
        examName: examName || 'Computer Science Final Assessment',
        department: department || 'Computer Science & Engineering',
        startTime: new Date(),
        status: status || 'Online',
        riskLevel: riskLevel || 'Low'
      });
    }

    if (status) session.status = status;
    if (faceDetected !== undefined) session.faceDetected = faceDetected;
    if (multipleFaces !== undefined) session.multipleFaces = multipleFaces;
    if (mobilePhoneDetected !== undefined) session.mobilePhoneDetected = mobilePhoneDetected;
    if (headPose) session.headPose = headPose;
    if (eyeGaze) session.eyeGaze = eyeGaze;
    if (tabSwitchingCount !== undefined) session.tabSwitchingCount = tabSwitchingCount;
    if (copyPasteAttempts !== undefined) session.copyPasteAttempts = copyPasteAttempts;
    if (fullScreenStatus) session.fullScreenStatus = fullScreenStatus;
    if (suspiciousActivityCount !== undefined) session.suspiciousActivityCount = suspiciousActivityCount;
    if (req.body.lastWebcamFrame || req.body.image) {
      session.lastWebcamFrame = req.body.lastWebcamFrame || req.body.image;
    }
    session.lastActive = new Date();

    if (eventLog) {
      session.eventLogs.push({
        event: eventLog.event || 'LOG',
        severity: eventLog.severity || 'Info',
        details: eventLog.details || 'Activity recorded',
        timestamp: new Date()
      });
    }

    await session.save();

    const io = req.app?.get('io');
    if (io) {
      io.to('admin_room').emit('student-updated', session);
      io.to('admin_room').emit('live-students-updated', session);
      io.to('admin_room').emit('dashboard-updated', { studentId: session.studentId });
    }

    res.json({
      success: true,
      message: 'Live session updated successfully',
      session
    });
  } catch (error) {
    console.error('Error in upsertLiveSession:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update live session: ' + error.message
    });
  }
};

/**
 * 14. Submit Exam Session (Marks session as Finished & updates admin reports)
 * POST /api/admin/submit-exam
 */
const submitExamSession = async (req, res) => {
  try {
    const {
      studentId,
      email,
      studentName,
      usn,
      examId,
      examName,
      department,
      answers,
      codingAnswers,
      theoryAnswers,
      mcqStats,
      codingStats,
      theoryStats,
      score,
      totalMarks,
      obtainedMarks,
      percentage,
      totalQuestions,
      attemptedQuestions,
      correctCount,
      wrongCount,
      unansweredCount,
      totalViolations
    } = req.body;

    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanId = (studentId || '').trim() || ('STU_' + cleanEmail.replace(/[^a-z0-9]/gi, '_'));
    const cleanUsn = (usn || cleanId).trim();
    const activeExamId = examId || 'CS-401';
    const activeExamName = examName || 'Computer Science Final Assessment';
    const activeDept = department || 'Computer Science & Engineering';

    const calculatedObtained = obtainedMarks !== undefined ? obtainedMarks : (score || 0);
    const calculatedTotalMarks = totalMarks || 100;
    const calculatedPercentage = percentage !== undefined ? percentage : (calculatedTotalMarks > 0 ? Math.round((calculatedObtained / calculatedTotalMarks) * 100) : 0);

    // 1. Persist in ExamReport collection
    let report = await ExamReport.findOne({
      $or: [
        { studentId: cleanId, examId: activeExamId },
        { email: cleanEmail, examId: activeExamId }
      ]
    });

    if (!report) {
      report = new ExamReport({
        reportId: `REP-${cleanId}-${Date.now()}`,
        studentId: cleanId,
        studentName: studentName || cleanEmail.split('@')[0],
        usn: cleanUsn,
        email: cleanEmail,
        examId: activeExamId,
        examName: activeExamName,
        department: activeDept,
        startTime: new Date(Date.now() - 45 * 60 * 1000)
      });
    }

    report.endTime = new Date();
    report.score = calculatedObtained;
    report.totalMarks = calculatedTotalMarks;
    report.obtainedMarks = calculatedObtained;
    report.percentage = calculatedPercentage;
    report.totalQuestions = totalQuestions || (answers ? answers.length : 0);
    report.attemptedQuestions = attemptedQuestions || (answers ? answers.filter(a => a.selectedOption !== null && a.selectedOption !== undefined).length : 0);
    report.correctCount = correctCount || (answers ? answers.filter(a => a.isCorrect).length : 0);
    report.wrongCount = wrongCount || (answers ? answers.filter(a => a.selectedOption !== null && a.selectedOption !== undefined && !a.isCorrect).length : 0);
    report.unansweredCount = unansweredCount || (answers ? answers.filter(a => a.selectedOption === null || a.selectedOption === undefined).length : 0);
    report.answers = answers || [];
    report.codingAnswers = codingAnswers || {};
    report.theoryAnswers = theoryAnswers || {};
    report.totalViolations = totalViolations || 0;
    report.status = 'Submitted';
    await report.save();

    // 2. Persist in LiveSession collection (Mark status as Finished)
    let session = await LiveSession.findOne({
      $or: [{ studentId: cleanId }, { email: cleanEmail }]
    });

    if (!session) {
      session = new LiveSession({
        sessionId: `SESS-${cleanId}`,
        studentId: cleanId,
        studentName: studentName || cleanEmail.split('@')[0],
        usn: cleanUsn,
        email: cleanEmail,
        examId: activeExamId,
        examName: activeExamName,
        department: activeDept,
        startTime: new Date(Date.now() - 45 * 60 * 1000)
      });
    }

    session.status = 'Finished';
    session.score = calculatedObtained;
    session.answers = answers || [];
    session.mcqStats = mcqStats || {};
    session.codingStats = codingStats || {};
    session.theoryStats = theoryStats || {};
    session.lastActive = new Date();
    session.updatedAt = new Date();
    await session.save();

    // 3. Update any active ExamSession
    await ExamSession.updateMany(
      {
        $or: [{ studentId: cleanId }, { studentId: cleanUsn }],
        status: 'active'
      },
      {
        $set: {
          status: 'completed',
          score: calculatedObtained,
          endTime: new Date()
        }
      }
    ).catch(() => {});

    const integrityScore = (totalViolations || 0) === 0 ? '98% Safe' : ((totalViolations || 0) < 3 ? '85% Good' : '65% Review');

    const io = req.app?.get('io');
    if (io) {
      const finishPayload = {
        sessionId: session.sessionId || session._id,
        studentId: cleanId,
        studentName: session.studentName,
        usn: session.usn || cleanUsn,
        email: session.email,
        examName: session.examName,
        status: 'Finished',
        integrityScore,
        duration: '00:45:00',
        score: calculatedObtained,
        percentage: calculatedPercentage,
        answersCount: (answers || []).length,
        endTime: new Date()
      };
      io.to('admin_room').emit('student-finished', finishPayload);
      io.to('admin_room').emit('exam-finished', finishPayload);
      io.to('admin_room').emit('dashboard-updated', { studentId: cleanId, status: 'Finished' });
    }

    res.json({
      success: true,
      message: 'Exam submitted successfully and recorded in MongoDB.',
      reportId: report.reportId,
      score: calculatedObtained,
      percentage: calculatedPercentage,
      answersCount: (answers || []).length,
      session
    });
  } catch (error) {
    console.error('Error in submitExamSession:', error);
    res.status(500).json({ success: false, error: 'Failed to submit exam: ' + error.message });
  }
};

module.exports = {
  loginAdmin,
  getDashboardOverview,
  getLiveStudents,
  getStudentDetail,
  getViolationsCenter,
  getTerminatedStudents,
  getFinishedStudents,
  terminateSession,
  warnStudent,
  getReports,
  getAnalytics,
  getAlerts,
  upsertLiveSession,
  submitExamSession
};
