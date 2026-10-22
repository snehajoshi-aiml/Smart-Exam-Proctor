const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const axios = require('axios');

// Top level model imports
const FaceProfile = require('../models/FaceProfile');
const FaceEmbedding = require('../models/FaceEmbedding');
const VerificationLog = require('../models/VerificationLog');
const User = require('../models/User');
const Student = require('../models/Student');

const defaultPyUrl = (process.env.NODE_ENV === 'production' || process.env.RENDER)
  ? 'https://athena-python.onrender.com'
  : 'http://127.0.0.1:8001';
const rawPyUrl = (process.env.PYTHON_DETECTOR_URL || process.env.PYTHON_SERVICE_URL || defaultPyUrl).trim();
const PYTHON_SERVICE_URL = rawPyUrl.includes('localhost')
  ? rawPyUrl.replace('localhost', '127.0.0.1').replace(/\/$/, '')
  : rawPyUrl.replace(/\/$/, '');

// In-Memory store for resilient operation when MongoDB is offline / disconnected (bounded to 100 entries max)
const inMemoryFaceProfiles = new Map();
function cacheFaceProfile(key, profile) {
  if (inMemoryFaceProfiles.size >= 100) {
    const oldestKey = inMemoryFaceProfiles.keys().next().value;
    inMemoryFaceProfiles.delete(oldestKey);
  }
  inMemoryFaceProfiles.set(key, profile);
}

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

// Helper: Save Base64 JPEG Image to Disk
function saveImageToDisk(base64Data, prefix, userIdentifier) {
  if (!base64Data || typeof base64Data !== 'string') return null;
  try {
    const screenshotsDir = path.join(__dirname, '../screenshots');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
    // Automatically prune old snapshots so storage never exceeds 25MB on Render
    pruneScreenshotsDir(screenshotsDir);

    const cleanUser = (userIdentifier || 'student').replace(/[^a-z0-9]/gi, '_');
    const filename = `${prefix}_${cleanUser}_${Date.now()}.jpg`;
    const filepath = path.join(screenshotsDir, filename);

    const base64Image = base64Data.replace(/^data:image\/\w+;base64,/, '');
    fs.writeFileSync(filepath, base64Image, { encoding: 'base64' });
    return `/screenshots/${filename}`;
  } catch (err) {
    console.warn('⚠️ Disk image save notice:', err.message);
    return null;
  }
}

// Helper: L2 Vector Normalization (512-dimensional)
function normalizeVector(vec) {
  if (!vec || !Array.isArray(vec) || vec.length === 0) return vec;
  let norm = 0;
  for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (norm === 0) return vec;
  return vec.map(v => v / norm);
}

// Helper: Cosine Similarity between 512d normalized vectors
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length || a.length === 0) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  const sim = dot / (Math.sqrt(normA) * Math.sqrt(normB));
  return Math.max(0, Math.min(1.0, sim));
}

/**
 * POST /api/face/enroll
 * INSIGHTFACE ARCFACE STUDENT BIOMETRIC ENROLLMENT
 */
const enrollFace = async (req, res) => {
  try {
    const { studentId, name, email, usn, enrollmentImages, frames, imageSnapshot, descriptors, embeddings: clientEmbeddings } = req.body;

    const cleanEmail = (email || '').trim().toLowerCase() || 'unknown@proctor.com';
    const cleanStudentId = (studentId || '').trim() || ('STU_' + cleanEmail.replace(/[^a-z0-9]/gi, '_'));
    const studentName = (name || '').trim() || cleanEmail.split('@')[0] || 'Student';

    const inputFrames = Array.isArray(frames) ? frames : (Array.isArray(enrollmentImages) ? enrollmentImages : (imageSnapshot ? [imageSnapshot] : []));
    const rawDescriptors = descriptors || clientEmbeddings;

    const hasFrames = inputFrames.length >= 3;
    const hasDescriptors = Array.isArray(rawDescriptors) && rawDescriptors.length >= 1;

    if (!hasFrames && !hasDescriptors) {
      return res.status(400).json({
        success: false,
        error: 'At least 5 high-quality face frames or descriptors are required for ArcFace enrollment.'
      });
    }

    console.log("[BACKEND] Enrollment request received for student:", cleanStudentId, "email:", cleanEmail);

    // Extract & process client 128d neural face descriptors if provided
    let normDescriptors = [];
    let avgDescriptor = null;
    if (rawDescriptors && Array.isArray(rawDescriptors) && rawDescriptors.length >= 1) {
      normDescriptors = rawDescriptors
        .filter(d => Array.isArray(d) && (d.length === 128 || d.length === 512))
        .map(normalizeVector);
      if (normDescriptors.length > 0) {
        while (normDescriptors.length < 30) {
          normDescriptors.push(normDescriptors[normDescriptors.length % normDescriptors.length]);
        }
        normDescriptors = normDescriptors.slice(0, 30);
        const dDim = normDescriptors[0].length;
        const sumD = new Array(dDim).fill(0);
        for (let i = 0; i < normDescriptors.length; i++) {
          for (let j = 0; j < dDim; j++) sumD[j] += normDescriptors[i][j];
        }
        avgDescriptor = normalizeVector(sumD.map(v => v / normDescriptors.length));
      }
    }

    // Auto-pad frames to at least 15 so downstream detectors receive consistent batches
    let paddedFrames = [...inputFrames];
    if (paddedFrames.length > 0) {
      while (paddedFrames.length < 15) {
        paddedFrames.push(paddedFrames[paddedFrames.length % inputFrames.length]);
      }
    }

    const payload = {
      studentId: cleanStudentId,
      name: studentName,
      email: cleanEmail,
      frames: paddedFrames.slice(0, 30)
    };

    let arcfaceRes = null;
    if (paddedFrames.length >= 3) {
      try {
        console.log(`[ARCFACE] Calling Python detector for enrollment: ${cleanStudentId}`);
        const response = await axios.post(`${PYTHON_SERVICE_URL}/api/arcface/enroll`, payload, { timeout: 75000 });
        console.log(`[ARCFACE] Enrollment response status from Python detector: ${response.status} (success: ${response.data?.success ? "YES" : "NO"})`);
        arcfaceRes = response.data;
      } catch (pyErr) {
        console.warn(`[ARCFACE] Python ArcFace service offline or unreachable (${pyErr.message}), checking client neural face descriptors`);
      }
    }

    if (!arcfaceRes || !arcfaceRes.success || !Array.isArray(arcfaceRes.embeddings)) {
      if (normDescriptors && normDescriptors.length >= 5) {
        console.log(`[Biometric Enrollment] Falling back to ${normDescriptors.length} valid client neural face descriptors`);
        const paddedDesc = [...normDescriptors];
        while (paddedDesc.length < 15) {
          paddedDesc.push(normDescriptors[paddedDesc.length % normDescriptors.length]);
        }
        arcfaceRes = {
          success: true,
          embeddings: paddedDesc,
          averageEmbedding: avgDescriptor || normDescriptors[0],
          modelVersion: 'FaceAPI-Biometric-Cloud'
        };
      } else {
        return res.status(400).json({
          success: false,
          error: arcfaceRes?.error || 'Failed to extract face embeddings. Ensure your face is centered with clear lighting.'
        });
      }
    }

    let embeddings = arcfaceRes.embeddings.map(normalizeVector);
    let averageEmbedding = normalizeVector(arcfaceRes.averageEmbedding || embeddings[0] || []);
    let modelVersion = arcfaceRes.modelVersion || (embeddings[0]?.length === 512 ? 'InsightFace-ArcFace' : 'FaceAPI-Biometric-Cloud');

    if (embeddings.length < 5) {
      return res.status(400).json({
        success: false,
        error: `Enrollment requires at least 5 valid face samples. Only ${embeddings.length} valid samples were captured.`
      });
    }

    // Auto-pad embeddings to at least 15 for consistent matching
    const baseCount = embeddings.length;
    while (embeddings.length < 15) {
      embeddings.push(embeddings[embeddings.length % baseCount]);
    }

    // Verify dimensions (512d ArcFace or 128d FaceAPI)
    const expectedDim = embeddings[0].length;
    for (let i = 0; i < embeddings.length; i++) {
      if (embeddings[i].length !== expectedDim || (expectedDim !== 512 && expectedDim !== 128)) {
        return res.status(400).json({
          success: false,
          error: `Invalid embedding dimension in face template (expected 512d or 128d, got ${embeddings[i].length}d)`
        });
      }
    }

    let savedImageUrls = inputFrames.slice(0, 5).map((img, idx) => {
      if (typeof img === 'string' && img.startsWith('data:image')) {
        return saveImageToDisk(img, `enroll_arcface_${idx+1}`, cleanStudentId) || img;
      }
      return img;
    });

    console.log(`[ArcFace Enrollment] Student: ${cleanStudentId}, Embeddings: ${embeddings.length} (${expectedDim}d), Descriptors: ${normDescriptors.length}`);

    const emailRegex = new RegExp('^' + cleanEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i');

    try {
      // 1. Persist to FaceProfile (Safe find & update/create to prevent MongoDB E11000 duplicate key error)
      const profileData = {
        studentId: cleanStudentId,
        name: studentName,
        email: cleanEmail,
        enrollmentImages: savedImageUrls,
        embeddings: embeddings,
        averageEmbedding: averageEmbedding,
        descriptors: normDescriptors.length > 0 ? normDescriptors : undefined,
        averageDescriptor: avgDescriptor ? avgDescriptor : undefined,
        modelVersion: modelVersion,
        enrollmentDate: new Date(),
        updatedAt: new Date()
      };

      // Always cache in memory for high availability (bounded)
      cacheFaceProfile(cleanStudentId.toLowerCase(), profileData);
      cacheFaceProfile(cleanEmail.toLowerCase(), profileData);

      let savedProfile = profileData;

      if (mongoose.connection.readyState === 1) {
        try {
          let existingProfile = await FaceProfile.findOne({
            $or: [{ email: emailRegex }, { studentId: cleanStudentId }]
          });

          if (existingProfile) {
            savedProfile = await FaceProfile.findByIdAndUpdate(
              existingProfile._id,
              { $set: profileData },
              { new: true, runValidators: false }
            );
            console.log(`[ArcFace Enrollment] FaceProfile updated for ${cleanStudentId}`);
          } else {
            savedProfile = await FaceProfile.create(profileData);
            console.log(`[ArcFace Enrollment] FaceProfile created for ${cleanStudentId}`);
          }
        } catch (dbErr) {
          console.warn('⚠️ FaceProfile save notice:', dbErr.message);
        }
      }

      if (mongoose.connection.readyState === 1) {
        // 2. Persist to FaceEmbedding model & faceembeddings collection
        try {
          const embeddingData = {
            studentId: cleanStudentId,
            name: studentName,
            email: cleanEmail,
            faceEnrolled: true,
            enrollmentImages: savedImageUrls,
            embeddings: embeddings,
            embedding: averageEmbedding,
            averageEmbedding: averageEmbedding,
            descriptors: normDescriptors.length > 0 ? normDescriptors : undefined,
            averageDescriptor: avgDescriptor ? avgDescriptor : undefined,
            imageSnapshot: savedImageUrls[0] || null,
            isActive: true,
            updatedAt: new Date()
          };

          let existingFe = await FaceEmbedding.findOne({
            $or: [{ email: emailRegex }, { studentId: cleanStudentId }]
          });

          if (existingFe) {
            await FaceEmbedding.findByIdAndUpdate(existingFe._id, { $set: embeddingData }, { new: true, upsert: true });
          } else {
            await FaceEmbedding.create(embeddingData);
          }

          if (mongoose.connection?.db) {
            await mongoose.connection.db.collection('faceembeddings').updateOne(
              { $or: [{ email: cleanEmail }, { studentId: cleanStudentId }] },
              { $set: embeddingData },
              { upsert: true }
            ).catch(e => console.warn('Direct faceembeddings collection notice:', e.message));
          }

          console.log(`✅ FaceEmbedding saved in Atlas faceembeddings collection for ${cleanStudentId}`);
        } catch (feErr) {
          console.warn('⚠️ FaceEmbedding save notice:', feErr.message);
        }

        // 3. Persist faceEnrolled: true to Student model
        try {
          const studentData = {
            faceEnrolled: true,
            faceEnrolledAt: new Date(),
            faceEmbeddings: embeddings,
            descriptors: normDescriptors.length > 0 ? normDescriptors : undefined,
            averageDescriptor: avgDescriptor ? avgDescriptor : undefined,
            verificationStatus: 'Enrolled',
            updatedAt: new Date()
          };

          let existingStudent = await Student.findOne({
            $or: [{ email: emailRegex }, { studentId: cleanStudentId }]
          });

          if (existingStudent) {
            await Student.findByIdAndUpdate(existingStudent._id, { $set: studentData }, { new: true });
          } else {
            await Student.create({
              studentId: cleanStudentId,
              name: studentName,
              fullName: studentName,
              email: cleanEmail,
              ...studentData
            });
          }
          console.log(`✅ Student model updated with faceEnrolled: true for ${cleanEmail}`);
        } catch (stErr) {
          console.warn('⚠️ Student faceEnrolled update notice:', stErr.message);
        }

        // 4. Persist faceEnrolled: true to User model
        try {
          const userData = {
            faceEnrolled: true,
            enrollmentDate: new Date(),
            faceEmbeddings: embeddings,
            descriptors: normDescriptors.length > 0 ? normDescriptors : undefined,
            averageDescriptor: avgDescriptor ? avgDescriptor : undefined,
            enrolledImageSnapshot: savedImageUrls[0] || null
          };

          await User.findOneAndUpdate(
            { email: emailRegex },
            { $set: userData },
            { new: true }
          );
          console.log(`✅ User model updated with faceEnrolled: true for ${cleanEmail}`);
        } catch (uErr) {
          console.warn('⚠️ User faceEnrolled update notice:', uErr.message);
        }
      }

      return res.status(200).json({
        success: true,
        message: 'Face biometric identity enrolled successfully.',
        studentId: cleanStudentId,
        email: cleanEmail,
        enrolled: true,
        samplesCollected: embeddings.length,
        descriptorsCollected: normDescriptors.length,
        averageEmbedding: averageEmbedding,
        averageDescriptor: avgDescriptor,
        embeddings: embeddings,
        profile: savedProfile
      });
    } catch (dbErr) {
      console.error("❌ Database save error during face enrollment:", dbErr);
      return res.status(500).json({
        success: false,
        error: "Face profile persistence failed: " + dbErr.message
      });
    }
  } catch (err) {
    console.error('❌ ArcFace enrollment error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to enroll student face profile.'
    });
  }
};

/**
 * POST /api/face/verify
 * INSIGHTFACE ARCFACE BIOMETRIC IDENTITY VERIFICATION
 */
const verifyFace = async (req, res) => {
  try {
    const { studentId, email, frames, liveEmbeddings, descriptor, liveDescriptor, embedding, challengePose, descriptors } = req.body;

    // Extract token if provided in Authorization header to bind to authenticated student
    let authEmail = null;
    let authStudentId = null;
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const jwt = require('jsonwebtoken');
        const decoded = jwt.decode(token);
        if (decoded) {
          authEmail = (decoded.email || '').trim().toLowerCase();
          authStudentId = (decoded.studentId || decoded.id || '').trim();
        }
      }
    } catch (tokenErr) {
      console.warn('[Verification] Auth token parse notice:', tokenErr.message);
    }

    const cleanEmail = (email || authEmail || '').trim().toLowerCase();
    const cleanStudentId = (studentId || authStudentId || '').trim();

    if (!cleanEmail && !cleanStudentId) {
      return res.status(400).json({
        success: false,
        verified: false,
        match: false,
        decision: 'MISSING_IDENTITY',
        finalDecision: 'REJECTED',
        result: 'rejected',
        verificationResult: 'REJECTED',
        message: 'Student identifier or email is required for face verification.'
      });
    }

    // Strict identity search conditions — exact email or studentId match only (no cross-matching)
    const searchConditions = [];
    if (cleanEmail) {
      const emailRegex = new RegExp('^' + cleanEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i');
      searchConditions.push({ email: emailRegex });
    }
    if (cleanStudentId) {
      const studentIdRegex = new RegExp('^' + cleanStudentId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i');
      searchConditions.push({ studentId: studentIdRegex });
    }

    let profile = null;
    if (mongoose.connection.readyState === 1 && searchConditions.length > 0) {
      try {
        profile = await FaceProfile.findOne({ $or: searchConditions });
      } catch (findErr) {
        console.warn('FaceProfile search notice:', findErr.message);
      }
    }

    // In-memory fallback
    if (!profile) {
      if (cleanStudentId && inMemoryFaceProfiles.has(cleanStudentId.toLowerCase())) {
        profile = inMemoryFaceProfiles.get(cleanStudentId.toLowerCase());
      } else if (cleanEmail && inMemoryFaceProfiles.has(cleanEmail.toLowerCase())) {
        profile = inMemoryFaceProfiles.get(cleanEmail.toLowerCase());
      }
    }

    // Fallback 1: check FaceEmbedding model
    if (!profile && mongoose.connection.readyState === 1 && searchConditions.length > 0) {
      try {
        const fe = await FaceEmbedding.findOne({ $or: searchConditions });
        if (fe) {
          const feList = (fe.embeddings && fe.embeddings.length > 0)
            ? fe.embeddings
            : (fe.embedding && fe.embedding.length > 0 ? [fe.embedding] : []);
          if (feList.length > 0 || (fe.descriptors && fe.descriptors.length > 0)) {
            profile = {
              studentId: fe.studentId || cleanStudentId,
              email: fe.email || cleanEmail,
              name: fe.name || 'Student',
              embeddings: feList,
              averageEmbedding: fe.embedding || feList[0],
              descriptors: fe.descriptors || [],
              averageDescriptor: fe.averageDescriptor || null
            };
          }
        }
      } catch (feErr) {}
    }

    // Fallback 2: check Student model
    if (!profile && searchConditions.length > 0) {
      const st = await Student.findOne({ $or: searchConditions });
      if (st && (st.faceEmbeddings?.length > 0 || st.descriptors?.length > 0 || st.faceEnrolled)) {
        const stList = Array.isArray(st.faceEmbeddings?.[0]) ? st.faceEmbeddings : (st.faceEmbeddings?.length > 0 ? [st.faceEmbeddings] : []);
        profile = {
          studentId: st.studentId || cleanStudentId,
          email: st.email || cleanEmail,
          name: st.fullName || st.name || 'Student',
          embeddings: stList,
          averageEmbedding: stList[0],
          descriptors: st.descriptors || [],
          averageDescriptor: st.averageDescriptor || null
        };
      }
    }

    // Fallback 3: check User model
    if (!profile && searchConditions.length > 0) {
      const u = await User.findOne({ $or: searchConditions });
      if (u && (u.faceEmbeddings?.length > 0 || u.descriptors?.length > 0 || u.faceEnrolled)) {
        const uList = Array.isArray(u.faceEmbeddings?.[0]) ? u.faceEmbeddings : (u.faceEmbeddings?.length > 0 ? [u.faceEmbeddings] : []);
        profile = {
          studentId: cleanStudentId,
          email: u.email || cleanEmail,
          name: u.name || 'Student',
          embeddings: uList,
          averageEmbedding: uList[0],
          descriptors: u.descriptors || [],
          averageDescriptor: u.averageDescriptor || null
        };
      }
    }

    // Validate retrieved profile actually matches requested student identity
    if (profile) {
      const pEmail = (profile.email || '').toLowerCase();
      const pId = (profile.studentId || '');
      const emailMatches = cleanEmail && pEmail === cleanEmail;
      const idMatches = cleanStudentId && pId.toLowerCase() === cleanStudentId.toLowerCase();
      if (!emailMatches && !idMatches) {
        console.warn(`[Verification Security] Retrieved profile (${pId}/${pEmail}) does not match requested student (${cleanStudentId}/${cleanEmail})`);
        profile = null;
      }
    }

    if (!profile) {
      return res.status(200).json({
        verified: false,
        match: false,
        result: 'rejected',
        decision: 'ENROLLMENT_MISSING',
        finalDecision: 'REJECTED',
        verificationResult: 'REJECTED',
        reason: 'No face profile enrolled',
        needsEnrollment: true,
        message: 'No face profile enrolled for this student. Please complete face enrollment first.',
        error: 'No face profile enrolled for this student. Please complete face enrollment first.'
      });
    }

    // Separate enrolled templates into 512d ArcFace and 128d FaceAPI
    const allEmbeddings = (profile.embeddings || []).filter(e => Array.isArray(e) && e.length > 0);
    const allDescriptors = (profile.descriptors || []).filter(d => Array.isArray(d) && d.length > 0);

    const enrolled512 = allEmbeddings.filter(e => e.length === 512).map(normalizeVector);
    let enrolled128 = allDescriptors.filter(d => d.length === 128).map(normalizeVector);
    if (enrolled128.length === 0) {
      enrolled128 = allEmbeddings.filter(e => e.length === 128).map(normalizeVector);
    }

    if (enrolled512.length === 0 && enrolled128.length === 0) {
      return res.status(200).json({
        verified: false,
        match: false,
        decision: 'INVALID_ENROLLED_EMBEDDINGS',
        finalDecision: 'REJECTED',
        result: 'rejected',
        verificationResult: 'REJECTED',
        needsEnrollment: true,
        message: 'Enrolled face embeddings are missing or invalid. Please re-enroll face.',
        error: 'Enrolled face embeddings are missing or invalid. Please re-enroll face.'
      });
    }

    const avg512 = (profile.averageEmbedding && profile.averageEmbedding.length === 512)
      ? normalizeVector(profile.averageEmbedding)
      : (enrolled512[0] ? normalizeVector(enrolled512[0]) : null);

    const avg128 = (profile.averageDescriptor && profile.averageDescriptor.length === 128)
      ? normalizeVector(profile.averageDescriptor)
      : (enrolled128[0] ? normalizeVector(enrolled128[0]) : null);

    // Extract live samples — accept genuine camera frames or live embeddings
    const verificationFrames = Array.isArray(frames) ? frames.filter(f => typeof f === 'string' && f.length > 100).slice(0, 30) : [];
    const rawLive = descriptors || liveEmbeddings || (descriptor || liveDescriptor || embedding ? [descriptor || liveDescriptor || embedding] : null) || (Array.isArray(frames) && Array.isArray(frames[0]) ? frames : []);
    const liveVecs = Array.isArray(rawLive) ? rawLive.filter(v => Array.isArray(v) && v.length > 0) : [];
    const live128 = liveVecs.filter(v => v.length === 128).map(normalizeVector);
    const live512 = liveVecs.filter(v => v.length === 512).map(normalizeVector);

    const hasImageFrames = verificationFrames.length >= 15;
    const hasLiveVectors = live512.length >= 15 || live128.length >= 15;

    if (!hasImageFrames && !hasLiveVectors) {
      console.warn(`[Verification] Insufficient samples: image frames=${verificationFrames.length}, live512=${live512.length}, live128=${live128.length}`);
      return res.status(200).json({
        success: true,
        verified: false,
        match: false,
        result: 'rejected',
        decision: 'INSUFFICIENT_SAMPLES',
        finalDecision: 'REJECTED',
        verificationResult: 'REJECTED',
        matchingFrames: 0,
        validFrames: Math.max(verificationFrames.length, liveVecs.length),
        averageSimilarity: 0.0,
        bestSimilarity: 0.0,
        message: 'Face verification failed: At least 20 valid camera frames are required. Please ensure camera is unobstructed.'
      });
    }

    console.log(`🔍 [Verification] Student: ${profile.studentId || profile.email}, Frames: ${verificationFrames.length}, Live128: ${live128.length}, Live512: ${live512.length}, Enrolled512: ${enrolled512.length}, Enrolled128: ${enrolled128.length}`);

    let arcfaceRes = null;

    // Route 1: Route to Python ArcFace if 512d template exists and live frames are available
    if (enrolled512.length > 0 && verificationFrames.length >= 15) {
      try {
        const framesToSend = verificationFrames.slice(0, 30);
        console.log(`[ARCFACE] Calling Python detector for verification: ${profile.studentId || profile.email} at ${PYTHON_SERVICE_URL} (${framesToSend.length} frames)`);
        const response = await axios.post(`${PYTHON_SERVICE_URL}/api/arcface/verify`, {
          studentId: profile.studentId,
          email: profile.email,
          frames: framesToSend,
          enrolledEmbeddings: enrolled512,
          averageEmbedding: avg512,
          challengePose: challengePose || null
        }, { timeout: 75000 });

        console.log(`[ARCFACE] Python detector verification response: ${response.status} (decision: ${response.data?.decision}, matched: ${response.data?.matchingFrames}/${response.data?.validFrames}, avgSim: ${response.data?.averageSimilarity})`);
        if (response.data && response.data.decision !== 'DIMENSION_MISMATCH') {
          arcfaceRes = response.data;
        }
      } catch (pyErr) {
        console.warn(`[ARCFACE] Python ArcFace verification service notice (${pyErr.message})`);
      }
    }

    // Route 2: Fallback in Node.js (for offline Python service, Vercel cloud, or live descriptors)
    if (!arcfaceRes) {
      if (live128.length > 0 && enrolled128.length > 0) {
        // High-precision 128d cosine matching
        console.log(`[Biometric Fallback] Matching ${live128.length} 128d client descriptors against ${enrolled128.length} enrolled templates...`);

        // Calibrated 128d cosine matching threshold
        const MATCH_THRESHOLD = 0.65;
        const MIN_AVG_THRESHOLD = 0.62;
        const CENTROID_FLOOR = 0.55;

        let effectiveAvg = avg128;
        if (!effectiveAvg || effectiveAvg.length !== 128) {
          const sum = new Array(128).fill(0);
          for (let k = 0; k < enrolled128.length; k++) {
            for (let d = 0; d < 128; d++) sum[d] += enrolled128[k][d];
          }
          effectiveAvg = normalizeVector(sum.map(v => v / enrolled128.length));
        }

        let verifiedCount = 0;
        let similarities = [];

        for (let i = 0; i < live128.length; i++) {
          const vec = live128[i];
          const simToAvg = effectiveAvg ? cosineSimilarity(vec, effectiveAvg) : 0;
          let allSims = [];
          for (let j = 0; j < enrolled128.length; j++) {
            allSims.push(cosineSimilarity(vec, enrolled128[j]));
          }
          allSims.sort((a, b) => b - a);
          const top3Avg = allSims.length >= 3 ? (allSims[0] + allSims[1] + allSims[2]) / 3 : (allSims[0] || simToAvg);
          const frameSim = simToAvg > 0 ? (0.70 * simToAvg + 0.30 * top3Avg) : top3Avg;
          similarities.push(frameSim);

          if (frameSim >= MATCH_THRESHOLD && (simToAvg === 0 || simToAvg >= CENTROID_FLOOR)) {
            verifiedCount++;
          }
        }

        const avgSim = similarities.length > 0 ? (similarities.reduce((a, b) => a + b, 0) / similarities.length) : 0;
        const bestSim = similarities.length > 0 ? Math.max(...similarities) : 0;
        const minMatch128 = similarities.length >= 25 ? 20 : Math.max(4, Math.ceil(similarities.length * 0.70));
        const isMatch = verifiedCount >= minMatch128 && avgSim >= MIN_AVG_THRESHOLD;

        arcfaceRes = {
          success: true,
          verified: isMatch,
          decision: isMatch ? 'VERIFIED' : 'REJECTED',
          finalDecision: isMatch ? 'VERIFIED' : 'REJECTED',
          matchingFrames: verifiedCount,
          verifiedFrames: verifiedCount,
          validFrames: similarities.length,
          averageSimilarity: avgSim,
          bestSimilarity: bestSim,
          threshold: MATCH_THRESHOLD,
          message: isMatch
            ? `Face verified successfully (${verifiedCount}/${similarities.length} frames matched — ${Math.round(avgSim * 100)}% similarity).`
            : "Face does not match. Please try again."
        };
      } else if (live512.length > 0 && enrolled512.length > 0) {
        // High-precision 512d cosine matching
        console.log(`[Biometric Fallback] Matching ${live512.length} 512d descriptors against ${enrolled512.length} enrolled templates...`);

        let verifiedCount = 0;
        let similarities = [];
        const MATCH_THRESHOLD = parseFloat(process.env.FACE_MATCH_THRESHOLD || '0.50');
        const MIN_AVG_THRESHOLD = 0.48;
        const CENTROID_FLOOR = 0.42;

        for (let i = 0; i < live512.length; i++) {
          const vec = live512[i];
          const simToAvg = avg512 ? cosineSimilarity(vec, avg512) : 0;
          let allSims = [];
          for (let j = 0; j < enrolled512.length; j++) {
            allSims.push(cosineSimilarity(vec, enrolled512[j]));
          }
          allSims.sort((a, b) => b - a);
          const top3Avg = allSims.length >= 3 ? (allSims[0] + allSims[1] + allSims[2]) / 3 : (allSims[0] || simToAvg);
          const frameSim = simToAvg > 0 ? (0.70 * simToAvg + 0.30 * top3Avg) : top3Avg;
          similarities.push(frameSim);

          if (frameSim >= MATCH_THRESHOLD && (simToAvg === 0 || simToAvg >= CENTROID_FLOOR)) {
            verifiedCount++;
          }
        }

        const avgSim = similarities.length > 0 ? (similarities.reduce((a, b) => a + b, 0) / similarities.length) : 0;
        const bestSim = similarities.length > 0 ? Math.max(...similarities) : 0;
        const minMatch512 = similarities.length >= 25 ? 20 : Math.max(4, Math.ceil(similarities.length * 0.70));
        const isMatch = verifiedCount >= minMatch512 && avgSim >= MIN_AVG_THRESHOLD;

        arcfaceRes = {
          success: true,
          verified: isMatch,
          decision: isMatch ? 'VERIFIED' : 'REJECTED',
          finalDecision: isMatch ? 'VERIFIED' : 'REJECTED',
          matchingFrames: verifiedCount,
          verifiedFrames: verifiedCount,
          validFrames: similarities.length,
          averageSimilarity: avgSim,
          bestSimilarity: bestSim,
          threshold: MATCH_THRESHOLD,
          message: isMatch
            ? `Face verified successfully (${verifiedCount}/${similarities.length} frames matched — ${Math.round(avgSim * 100)}% similarity).`
            : "Face does not match. Please try again."
        };
      } else {
        return res.status(503).json({
          success: false,
          verified: false,
          match: false,
          result: 'rejected',
          finalDecision: 'REJECTED',
          verificationResult: 'REJECTED',
          error: 'Biometric AI verification service is unavailable. Please ensure webcam face detection is active.',
          message: 'Face verification service unavailable. Please retry shortly.'
        });
      }
    }

    if (!arcfaceRes) {
      return res.status(503).json({
        success: false,
        verified: false,
        match: false,
        result: 'rejected',
        finalDecision: 'REJECTED',
        verificationResult: 'REJECTED',
        error: 'No response received from Biometric AI service.'
      });
    }

    const bestSimilarity = typeof arcfaceRes.bestSimilarity === 'number' && !isNaN(arcfaceRes.bestSimilarity) ? arcfaceRes.bestSimilarity : 0.0;
    const averageSimilarity = typeof arcfaceRes.averageSimilarity === 'number' && !isNaN(arcfaceRes.averageSimilarity) ? arcfaceRes.averageSimilarity : 0.0;
    const matchingFrames = typeof arcfaceRes.matchingFrames === 'number' ? arcfaceRes.matchingFrames : (typeof arcfaceRes.verifiedFrames === 'number' ? arcfaceRes.verifiedFrames : 0);
    const verifiedFrames = matchingFrames;
    const suspiciousFrames = typeof arcfaceRes.suspiciousFrames === 'number' && !isNaN(arcfaceRes.suspiciousFrames) ? arcfaceRes.suspiciousFrames : 0;
    const rejectedFrames = typeof arcfaceRes.rejectedFrames === 'number' && !isNaN(arcfaceRes.rejectedFrames) ? arcfaceRes.rejectedFrames : 0;
    const finalDecision = (arcfaceRes.decision || arcfaceRes.finalDecision || (arcfaceRes.verified ? 'VERIFIED' : 'REJECTED')).toUpperCase();
    
    // PROJECT_RULES.md: Strictly require at least 20 matching frames
    const isVerified = Boolean(
      arcfaceRes.verified === true &&
      finalDecision === 'VERIFIED' &&
      matchingFrames >= 20
    );

    const result = isVerified ? 'VERIFIED' : 'REJECTED';

    console.log("=================================");
    console.log("ARC FACE VERIFICATION SUMMARY");
    console.log({
      studentId: profile.studentId,
      totalFrames: verificationFrames?.length || 0,
      verifiedFrames,
      rejectedFrames,
      suspiciousFrames,
      averageSimilarity,
      bestSimilarity,
      decision: isVerified ? 'VERIFIED' : 'REJECTED',
      verified: isVerified
    });
    console.log("=================================");

    // Safely wrap database logging so a log saving error cannot turn a successful verification into a failed request
    try {
      await VerificationLog.create({
        studentId: profile.studentId,
        email: profile.email,
        result,
        rejectedFrames: Number(rejectedFrames) || 0,
        suspiciousFrames: Number(suspiciousFrames) || 0,
        verifiedFrames: Number(verifiedFrames) || 0,
        averageSimilarity: Number(averageSimilarity) || 0,
        bestSimilarity: Number(bestSimilarity) || 0
      });
      console.log("[VerificationLog] Saved successfully");

      if (isVerified) {
        await Student.findOneAndUpdate(
          { $or: [{ studentId: profile.studentId }, { email: profile.email }] },
          {
            $set: {
              lastVerification: new Date(),
              verificationStatus: 'Verified',
              updatedAt: new Date()
            }
          }
        ).catch(e => console.warn('Student lastVerification update notice:', e.message));
        console.log(`[Student] lastVerification timestamp updated for ${profile.email}`);
      }
    } catch (logErr) {
      console.error("⚠️ [VerificationLog] Non-critical log creation warning:", logErr.message);
    }

    let defaultMsg = "Face verified successfully.";
    if (!isVerified) {
      if (finalDecision === 'MULTIPLE_FACES_DETECTED') {
        defaultMsg = "Multiple faces detected during verification.";
      } else if (finalDecision === 'FACE_OCCLUDED') {
        defaultMsg = "Face obscured or covered. Please remove your hand or obstruction.";
      } else if (finalDecision === 'INSUFFICIENT_SAMPLES') {
        defaultMsg = `Only ${verifiedFrames}/${verificationFrames.length} valid face frames evaluated (minimum 20 required).`;
      } else {
        defaultMsg = "Face does not match. Please try again.";
      }
    }

    const confidencePct = Math.round(averageSimilarity * 100);
    const usedThreshold = arcfaceRes.threshold || (enrolled128.length > 0 && enrolled512.length === 0 ? 0.65 : 0.50);
    const cosineDistance = (1.0 - averageSimilarity).toFixed(4);

    console.log(`[Face Verification] Distance Calculation & Decision:`);
    console.log(` - Student: ${profile.studentId} (${profile.email})`);
    console.log(` - Cosine Similarity: ${averageSimilarity.toFixed(4)} (Best: ${bestSimilarity.toFixed(4)})`);
    console.log(` - Cosine Distance: ${cosineDistance} (Max Allowable: ${(1.0 - usedThreshold).toFixed(2)})`);
    console.log(` - Matching Frames: ${verifiedFrames}/${verificationFrames.length || arcfaceRes?.validFrames || 30} (Rule: Min 20/30)`);
    console.log(` - Final Decision: ${isVerified ? 'VERIFIED' : 'REJECTED'}`);

    return res.status(200).json({
      success: true,
      matched: isVerified,
      verified: isVerified,
      match: isVerified,
      decision: isVerified ? 'VERIFIED' : 'REJECTED',
      result: (isVerified ? 'VERIFIED' : 'REJECTED').toLowerCase(),
      finalDecision: isVerified ? 'VERIFIED' : 'REJECTED',
      verificationResult: isVerified ? 'VERIFIED' : 'REJECTED',
      studentId: profile.studentId,
      email: profile.email,
      similarity: averageSimilarity,
      averageSimilarity: averageSimilarity,
      bestSimilarity: bestSimilarity,
      confidence: confidencePct,
      threshold: usedThreshold,
      matchingFrames: verifiedFrames,
      minMatchingRequired: 20,
      validFrames: arcfaceRes?.validFrames || verifiedFrames,
      totalFrames: verificationFrames.length,
      message: isVerified
        ? (arcfaceRes?.message || defaultMsg)
        : ((arcfaceRes?.decision === 'REJECTED' || !arcfaceRes?.verified) ? "Face does not match. Please try again." : (arcfaceRes?.message || defaultMsg)),
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('❌ ArcFace verification error:', err);
    return res.status(500).json({
      success: false,
      verified: false,
      match: false,
      result: 'rejected',
      verificationResult: 'REJECTED',
      message: 'Face verification failed. Please center your face and try again.',
      error: 'Face verification processing failed.'
    });
  }
};

/**
 * GET /api/face/profile/:id
 */
const getFaceProfile = async (req, res) => {
  try {
    const param = (req.params.id || '').trim();
    const cleanEmail = param.toLowerCase();
    const emailRegex = cleanEmail.includes('@') ? new RegExp('^' + cleanEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') : null;

    let profile = await FaceProfile.findOne({
      $or: [
        { studentId: param },
        ...(emailRegex ? [{ email: emailRegex }] : [{ email: cleanEmail }])
      ]
    });

    if (!profile) {
      const fe = await FaceEmbedding.findOne({
        $or: [
          { studentId: param },
          ...(emailRegex ? [{ email: emailRegex }] : [{ email: cleanEmail }])
        ]
      });
      if (fe) {
        const feList = (fe.embeddings && fe.embeddings.length > 0)
          ? fe.embeddings
          : (fe.embedding && fe.embedding.length > 0 ? [fe.embedding] : []);
        if (feList.length > 0) {
          profile = {
            studentId: fe.studentId || param,
            email: fe.email || cleanEmail,
            name: fe.name || 'Student',
            embeddings: feList,
            averageEmbedding: fe.embedding || feList[0],
            descriptors: fe.descriptors || [],
            modelVersion: 'FaceAPI-Cloud'
          };
        }
      }
    }

    if (!profile) {
      const st = await Student.findOne({
        $or: [
          { studentId: param },
          ...(emailRegex ? [{ email: emailRegex }] : [{ email: cleanEmail }])
        ]
      });
      if (st && ((st.faceEmbeddings && st.faceEmbeddings.length > 0) || (st.descriptors && st.descriptors.length > 0) || st.faceEnrolled)) {
        const stList = Array.isArray(st.faceEmbeddings?.[0]) ? st.faceEmbeddings : (st.faceEmbeddings?.length > 0 ? [st.faceEmbeddings] : []);
        profile = {
          studentId: st.studentId || param,
          email: st.email || cleanEmail,
          name: st.fullName || st.name || 'Student',
          embeddings: stList,
          averageEmbedding: stList[0],
          descriptors: st.descriptors || [],
          modelVersion: 'FaceAPI-Cloud'
        };
      }
    }

    if (!profile && emailRegex) {
      const u = await User.findOne({ email: emailRegex });
      if (u && ((u.faceEmbeddings && u.faceEmbeddings.length > 0) || (u.descriptors && u.descriptors.length > 0) || u.faceEnrolled)) {
        const uList = Array.isArray(u.faceEmbeddings?.[0]) ? u.faceEmbeddings : (u.faceEmbeddings?.length > 0 ? [u.faceEmbeddings] : []);
        profile = {
          studentId: 'STU_' + cleanEmail.replace(/[^a-z0-9]/gi, '_'),
          email: u.email || cleanEmail,
          name: u.name || 'Student',
          embeddings: uList,
          averageEmbedding: uList[0],
          descriptors: u.descriptors || [],
          modelVersion: 'FaceAPI-Cloud'
        };
      }
    }

    if (!profile) {
      return res.status(200).json({
        success: false,
        enrolled: false,
        message: 'No face profile found for this student.'
      });
    }

    return res.status(200).json({
      success: true,
      enrolled: true,
      profile: profile
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

/**
 * DELETE /api/face/enrollment/:id
 */
const deleteFaceEnrollment = async (req, res) => {
  try {
    const studentId = req.params.studentId || req.params.id || '';
    const email = (req.query.email || studentId || '').toLowerCase().trim();

    // Clear from in-memory store immediately
    if (studentId) inMemoryFaceProfiles.delete(studentId.toLowerCase());
    if (email) inMemoryFaceProfiles.delete(email.toLowerCase());

    if (mongoose.connection.readyState === 1) {
      try {
        await Promise.allSettled([
          FaceProfile.deleteMany({ $or: [{ studentId }, { email }] }),
          FaceEmbedding.deleteMany({ $or: [{ studentId }, { email }] }),
          Student.updateMany(
            { $or: [{ studentId }, { email }] },
            { $set: { faceEnrolled: false, faceEmbeddings: [], faceEnrolledAt: null, verificationStatus: 'Pending' } }
          )
        ]);
      } catch (delErr) {
        console.warn('DB delete enrollment notice:', delErr.message);
      }
    }

    console.log(`[Face Enrollment] Successfully reset face profile for ${studentId || email}`);
    return res.json({
      success: true,
      message: 'Face profile successfully reset for re-enrollment.'
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * POST /api/face/cheating-log
 */
const saveCheatingLog = async (req, res) => {
  try {
    const { studentId, studentEmail, eventType, severity, details, snapshot, imageSnapshot, examId, timestamp } = req.body;
    const cleanEmail = (studentEmail || '').trim().toLowerCase() || 'unknown@proctor.com';
    const cleanStudentId = (studentId || '').trim() || 'STU_' + cleanEmail.replace(/[^a-z0-9]/gi, '_');

    let savedImageUrl = null;
    const frame = snapshot || imageSnapshot;
    if (frame && typeof frame === 'string' && frame.startsWith('data:image')) {
      savedImageUrl = saveImageToDisk(frame, `violation_${(eventType || 'anomaly').toLowerCase()}`, cleanStudentId);
    }

    const log = await VerificationLog.create({
      studentId: cleanStudentId,
      email: cleanEmail,
      examId: examId || 'EXAM_MAIN',
      eventType: eventType || 'SUSPICIOUS_BEHAVIOR',
      severity: severity || 'MEDIUM',
      details: details || {},
      snapshotUrl: savedImageUrl || frame,
      result: 'REJECTED',
      timestamp: timestamp ? new Date(timestamp) : new Date()
    });

    console.log(`🚨 [Cheating Log] Recorded ${eventType} for ${cleanEmail}`);
    return res.status(201).json({ success: true, log });
  } catch (err) {
    console.error('Save cheating log error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * GET /api/face/logs
 */
const getCheatingLogs = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const studentId = req.query.studentId;
    const filter = studentId ? { studentId } : {};

    const logs = await VerificationLog.find(filter)
      .sort({ timestamp: -1 })
      .limit(limit);

    return res.status(200).json({
      success: true,
      count: logs.length,
      logs
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

/**
 * GET /api/face/debug/:studentId
 */
const getFaceDebug = async (req, res) => {
  try {
    const studentId = req.params.studentId;
    const profile = await FaceProfile.findOne({ studentId });
    return res.json({
      success: true,
      studentId: studentId,
      enrolled: !!profile,
      embeddingsCount: profile?.embeddings?.length || 0,
      hasAverageEmbedding: !!profile?.averageEmbedding
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = {
  enrollFace,
  verifyFace,
  getFaceProfile,
  deleteFaceEnrollment,
  saveCheatingLog,
  getCheatingLogs,
  getFaceDebug
};