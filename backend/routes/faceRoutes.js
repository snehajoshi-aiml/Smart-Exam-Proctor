const express = require('express');
const router = express.Router();
const { 
  enrollFace, 
  verifyFace, 
  getFaceProfile, 
  deleteFaceEnrollment,
  saveCheatingLog, 
  getCheatingLogs,
  getFaceDebug 
} = require('../controllers/faceController');


// Specification 12: Backend APIs
// POST /api/face/enroll
router.post('/enroll', enrollFace);
router.post('/face/enroll', enrollFace);
router.post('/face/register', enrollFace);

// DELETE /api/face/enrollment/:studentId
router.delete('/enrollment/:studentId', deleteFaceEnrollment);
router.delete('/enroll/:studentId', deleteFaceEnrollment);
router.delete('/face/enrollment/:studentId', deleteFaceEnrollment);

// POST /api/face/verify
router.post('/verify', verifyFace);
router.post('/face/verify', verifyFace);

// GET /api/face/profile/:id
router.get('/profile/:id', getFaceProfile);
router.get('/face/profile/:id', getFaceProfile);

// GET /api/face/debug/:studentId
router.get('/debug/:studentId', getFaceDebug);
router.get('/face/debug/:studentId', getFaceDebug);

// GET /api/face/logs
router.get('/logs', getCheatingLogs);
router.get('/face/logs', getCheatingLogs);

// Cheating Logs API
router.post('/cheating-log', saveCheatingLog);
router.post('/face/cheating-log', saveCheatingLog);


// Status route
router.get('/status/:email', async (req, res) => {
  try {
    const FaceProfile = require('../models/FaceProfile');
    const FaceEmbedding = require('../models/FaceEmbedding');
    const Student = require('../models/Student');
    const User = require('../models/User');
    const rawEmail = (req.params.email || '').trim();
    const cleanEmail = rawEmail.toLowerCase();
    const emailRegex = cleanEmail.includes('@') ? new RegExp('^' + cleanEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') : null;

    let profile = await FaceProfile.findOne({
      $or: [
        ...(emailRegex ? [{ email: emailRegex }] : [{ email: cleanEmail }]),
        { studentId: rawEmail }
      ]
    });
    if (profile && ((profile.embeddings && profile.embeddings.length > 0) || (profile.descriptors && profile.descriptors.length > 0))) {
      const count = (profile.embeddings && profile.embeddings.length) || (profile.descriptors && profile.descriptors.length) || 0;
      const dim = profile.embeddings?.[0]?.length || profile.descriptors?.[0]?.length || 512;
      return res.json({
        enrolled: true,
        descriptorsCount: count,
        embeddingDim: dim,
        name: profile.name,
        studentId: profile.studentId
      });
    }

    let faceEmb = await FaceEmbedding.findOne({
      $or: [
        ...(emailRegex ? [{ email: emailRegex }] : [{ email: cleanEmail }]),
        { studentId: rawEmail }
      ]
    });
    if (faceEmb && ((faceEmb.embeddings && faceEmb.embeddings.length > 0) || (faceEmb.descriptors && faceEmb.descriptors.length > 0) || faceEmb.faceEnrolled)) {
      const count = (faceEmb.embeddings && faceEmb.embeddings.length) || (faceEmb.descriptors && faceEmb.descriptors.length) || 0;
      const dim = faceEmb.embeddings?.[0]?.length || faceEmb.descriptors?.[0]?.length || 512;
      return res.json({
        enrolled: true,
        descriptorsCount: count,
        embeddingDim: dim,
        name: faceEmb.name,
        studentId: faceEmb.studentId
      });
    }

    const student = await Student.findOne({
      $or: [
        ...(emailRegex ? [{ email: emailRegex }] : [{ email: cleanEmail }]),
        { studentId: rawEmail }
      ]
    });
    if (student && student.faceEnrolled) {
      return res.json({
        enrolled: true,
        descriptorsCount: student.faceEmbeddings ? (Array.isArray(student.faceEmbeddings[0]) ? student.faceEmbeddings.length : 1) : 0,
        name: student.fullName || student.name,
        studentId: student.studentId
      });
    }

    const user = await User.findOne({
      $or: [
        ...(emailRegex ? [{ email: emailRegex }] : [{ email: cleanEmail }])
      ]
    });
    res.json({
      enrolled: !!(user && user.faceEnrolled),
      descriptorsCount: user && user.faceEmbeddings ? (Array.isArray(user.faceEmbeddings[0]) ? user.faceEmbeddings.length : 1) : 0,
      name: user ? user.name : ''
    });
  } catch (e) {
    res.json({ enrolled: false, descriptorsCount: 0 });
  }
});

module.exports = router;