# Smart Exam Proctoring System — Setup & Execution Guide

This document provides step-by-step instructions for running the complete Smart Exam Proctoring System (Backend, Frontend, and Python YOLOv8 Detector).

---

## 📋 System Overview

The system consists of 3 microservices:
1. **Node.js Express Backend** (`http://localhost:5000`)
   - MongoDB database models (Student, FaceEmbedding, ExamSession, SuspiciousActivity, ScreenshotEvidence)
   - JWT authentication & security APIs
   - Socket.IO real-time event server
   - Proxy endpoints for YOLO object detection

2. **React Frontend** (`http://localhost:3000`)
   - Modern dark-themed Proctoring Dashboard & Command Panel
   - Face Verification Login & Enrollment modal
   - Continuous Face Identity Verification (face-api.js)
   - Advanced Phone & Headphone/Earbud Detection Cards
   - Browser Security Controls (tab switch, copy/paste, devtools, right-click block)
   - Socket.IO real-time notification toasts

3. **Python YOLOv8 Detector Service** (`http://localhost:8001`)
   - FastAPI microservice
   - Real-time mobile phone detection via YOLOv8 (`yolov8n.pt`)
   - Headphone / Earbuds / AirPods / Neckbands detection

---

## 🛠️ Step 1: Prerequisites

- **Node.js**: v16.0.0 or higher
- **MongoDB**: Local MongoDB instance (`mongodb://localhost:27017`) OR MongoDB Atlas connection string
- **Python**: v3.9 or higher (for YOLOv8 detection service)
- **Webcam**: A functional webcam for face and object detection testing

---

## 🚀 Step 2: Running the Backend Server

```bash
# Navigate to the backend directory
cd backend

# Install dependencies (if not already installed)
npm install

# Start the backend server
npm start
# OR for development mode with auto-reload:
npm run dev
```

The backend server will start on **`http://localhost:5000`**. You should see:
```text
=================================
🎓 Smart Proctoring System
=================================
🚀 Server running on http://localhost:5000
✅ MongoDB Connected: localhost
🔌 Socket.IO connected
=================================
```

---

## 💻 Step 3: Running the React Frontend

```bash
# Navigate to the frontend directory
cd frontend

# Install dependencies
npm install

# Start the React development server
npm start
```

The frontend application will start at **`http://localhost:3000`** (or proxy to port 5000 if configured).

---

## 🐍 Step 4: Running the Python YOLOv8 Detector Service

```bash
# Navigate to python_detector directory
cd python_detector

# Install Python requirements
pip install -r requirements.txt

# Start the FastAPI uvicorn server
python main.py
# OR:
uvicorn main:app --host 0.0.0.0 --port 8001
```

The Python detection service will start on **`http://localhost:8001`**. On first run, it will automatically download `yolov8n.pt` weights.

---

## 👤 Step 5: Testing the End-to-End Features

### 1. Face Verification Login Flow
1. Open `http://localhost:3000/` in your browser.
2. Sign in with student credentials or register a new student account.
3. On first login, the **Face Enrollment Modal** will prompt you to enroll your face by capturing 5 descriptors.
4. Once enrolled, subsequent logins require **Face Verification** before dashboard access is granted.

### 2. Continuous Face Identity Verification
1. Navigate to `/proctor-dashboard`.
2. The webcam feed will initialize and continuously extract 128-d face descriptors.
3. If you move out of frame for >5 seconds, a `no_face_critical` violation is triggered.
4. If another person appears, a `face_mismatch` violation is logged.

### 3. Advanced Phone Detection (YOLOv8)
1. Hold a mobile phone up to the webcam on the `/proctor-dashboard` page.
2. The **Phone Detection Status Card** will update in real time to **PHONE DETECTED** with confidence score.
3. The violation will be logged in the history panel and saved to MongoDB.

### 4. Headphones & Earbuds Detection
1. Put on or hold headphones/earbuds near your ears in the webcam view.
2. The **Headphone / Earbuds Card** will mark the detection and save an evidence screenshot.

### 5. Security Violations
- Try switching tabs or minimizing the window -> Tab switch violation logged.
- Try copying, pasting, or right-clicking -> Action blocked + violation logged.
- Try pressing F12 or opening DevTools -> DevTools violation logged.

---

## 📂 Database Schema Summary

| Schema | Purpose |
|--------|---------|
| `Student` | Student account profile, credentials, `faceEnrolled` status |
| `FaceEmbedding` | 128-dimensional face feature vector stored securely |
| `ExamSession` | Active and past exam session metrics & violation counts |
| `SuspiciousActivity` | Log of all proctoring violations (type, confidence, timestamp, severity) |
| `ScreenshotEvidence` | Base64 evidence screenshots attached to violations |

---

## 🔧 Troubleshooting

- **MongoDB connection error**: Ensure MongoDB service is running locally (`mongod`) or update `MONGO_URI` in `backend/.env`.
- **Python detector offline**: If the Python service isn't running on port 8001, the system automatically falls back to client-side detection.
- **Webcam permission denied**: Make sure your browser has permission to access your webcam.
