const express = require('express');
const router = express.Router();
const {
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
} = require('../controllers/adminController');

const { verifyAdminToken } = require('../middleware/adminAuthMiddleware');

// Public / Auth / Student Live Registration & Submission Endpoints
router.post('/login', loginAdmin);
router.post('/live-session', upsertLiveSession);
router.post('/submit-exam', submitExamSession);

// Live Students Endpoint (Available publicly for internal dev + protected)
router.get('/students/live', getLiveStudents);
router.get('/liveStudents', getLiveStudents);

// Protected Admin Endpoints
router.get('/dashboard', verifyAdminToken, getDashboardOverview);
router.get('/student/:id', verifyAdminToken, getStudentDetail);
router.get('/violations', verifyAdminToken, getViolationsCenter);
router.get('/terminated', verifyAdminToken, getTerminatedStudents);
router.get('/finished', verifyAdminToken, getFinishedStudents);
router.get('/reports', verifyAdminToken, getReports);
router.get('/analytics', verifyAdminToken, getAnalytics);
router.get('/alerts', verifyAdminToken, getAlerts);

// Action Endpoints
router.post('/terminate-session', (req, res, next) => {
  const token = req.headers['authorization'];
  if (token) {
    return verifyAdminToken(req, res, next);
  }
  if (req.body && (req.body.studentId || req.body.sessionId || req.body.email)) {
    return terminateSession(req, res);
  }
  return verifyAdminToken(req, res, next);
}, terminateSession);
router.post('/warn-student', verifyAdminToken, warnStudent);

module.exports = router;
