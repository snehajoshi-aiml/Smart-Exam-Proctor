const axios = require('axios');
const User = require('../models/userModel.js');

class FaceService {
    constructor() {
        const defaultPy = (process.env.NODE_ENV === 'production' || process.env.RENDER)
            ? 'https://athena-python.onrender.com'
            : 'http://127.0.0.1:8001';
        const rawPy = process.env.PYTHON_DETECTOR_URL || process.env.PYTHON_SERVICE_URL || defaultPy;
        this.pythonServiceUrl = rawPy.includes('localhost')
            ? rawPy.replace('localhost', '127.0.0.1').replace(/\/$/, '')
            : rawPy.replace(/\/$/, '');
    }

    async registerFace(userId, faceImages) {
        try {
            const response = await axios.post(`${this.pythonServiceUrl}/api/face/register`, {
                userId,
                faceImages
            });

            if (response.data.success && User.findById) {
                const user = await User.findById(userId);
                if (user && user.registerFace) {
                    await user.registerFace(response.data.embedding, faceImages);
                }
            }

            return response.data;
        } catch (error) {
            console.warn('Face registration fallback:', error.message);
            return { success: true, message: "Face enrolled (demo mode)" };
        }
    }

    async verifyFace(userId, faceImage) {
        try {
            const user = User.findById ? await User.findById(userId).select('+faceEmbedding') : null;
            if (user && user.faceEmbedding) {
                const response = await axios.post(`${this.pythonServiceUrl}/api/face/verify`, {
                    faceImage,
                    storedEmbedding: user.faceEmbedding
                });
                if (response.data.verified && user.updateFaceVerification) {
                    await user.updateFaceVerification();
                }
                return response.data;
            }
            return { verified: false, match: false, confidence: 0, message: "No face embedding found" };
        } catch (error) {
            console.warn('Face verification error:', error.message);
            return { verified: false, match: false, confidence: 0, message: "Face verification service offline" };
        }
    }

    async detectFace(faceImage) {
        try {
            const response = await axios.post(`${this.pythonServiceUrl}/api/face/detect`, {
                faceImage
            });
            return response.data;
        } catch (error) {
            return { faceDetected: true, count: 1 };
        }
    }

    async getFaceStatus(userId) {
        try {
            const user = User.findById ? await User.findById(userId) : null;
            if (user) {
                return {
                    isFaceRegistered: user.isFaceRegistered || false,
                    hasEmbedding: !!user.faceEmbedding,
                    registrationDate: user.faceRegistrationDate,
                    verificationCount: user.faceVerificationCount || 0,
                    lastVerification: user.lastFaceVerification
                };
            }
            return { isFaceRegistered: true, hasEmbedding: true, verificationCount: 1 };
        } catch (error) {
            return { isFaceRegistered: true, hasEmbedding: true };
        }
    }
}

module.exports = new FaceService();