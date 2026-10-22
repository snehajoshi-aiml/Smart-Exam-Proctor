# 🏛️ Connected Project Architecture & File Guide
## Athena AI Smart Proctoring System

> [!IMPORTANT]
> ### ⚡ MANDATORY RULE FOR ANTIGRAVITY & DEVELOPERS
> **BEFORE starting ANY development or making ANY changes to this codebase:**
> 1. **Read [PROJECT_RULES.md](file:///c:/Users/ksubh/OneDrive/Desktop/Smart-Exam-Proctoring-System-main1/PROJECT_RULES.md)** and strictly follow all listed constraints.
> 2. **Never break MongoDB Schema Integrity** or delete existing schemas.
> 3. **Preserve Face Verification Constraints**: Store 30 enrollment frames, require minimum 20/30 matching frames, do not use distance thresholds, and allow verification from longer camera distances.
> 4. **Maintain Cheating Detection Subsystems**: Multiple Faces, Phone Detection, Tab Switching, Continuous Gaze / Eye-down tracking, and Audio Anomaly Detection.
> 5. **Git Policy**: Never run `git push` autonomously. Pushes are handled manually by the user.

---

## 🌳 Full Connected Project Tree & File Directory

```
Smart-Exam-Proctoring-System/
│
├── 📄 PROJECT_RULES.md                              # Defines mandatory project rules (DB integrity, 30-frame face verification, cheating detection policies)
├── 📄 PROJECT_STRUCTURE.md                          # Full codebase map with connected tree layout & file descriptions
├── 📄 README.md                                     # Project introduction, key features overview, and system capabilities
├── 📄 SETUP.md                                      # Step-by-step developer installation, environment configuration, & run guide
├── 📄 package.json                                  # Root dependencies and project orchestrator scripts
├── 📄 vercel.json                                   # Deployment configuration for Vercel cloud hosting
│
├── 📂 .agents/                                      # Antigravity AI Agent Rules and Behavior Configuration
│   └── 📄 AGENTS.md                                 # Core agent instructions (Mandatory reading of PROJECT_RULES.md, Git push restrictions)
│
├── 📂 frontend/                                     # React.js Candidate Portal & Client-Side AI Vision System
│   ├── 📄 package.json                              # Frontend dependencies (React, face-api.js, TensorFlow.js, Axios, Socket.IO)
│   ├── 📂 public/                                   # Static assets and WebAssembly ML models
│   │   ├── 📂 models/                               # Pre-trained face-api.js neural network weight shards (TinyFaceDetector, FaceLandmark68, FaceRecognition)
│   │   └── 📄 index.html                            # Single Page Application HTML root template
│   │
│   └── 📂 src/                                      # React application source code
│       ├── 📄 App.js                                # Application router defining routes (Login, Register, Exam Suite, Diagnostics, Admin)
│       ├── 📄 index.js                              # React DOM mounting entry point
│       ├── 📄 proctoring.css                        # Glassmorphism dark-theme styling, camera overlay HUD styles, and animations
│       │
│       ├── 📂 config/                               # Config parameters & calibration constants
│       │   └── 📄 gazeConfig.js                     # Gaze thresholds (10s deviation limit, scoring brackets, decay rates, typing grace window)
│       │
│       ├── 📂 services/                             # Core Business & AI Processing Services
│       │   ├── 📄 proctoringPipeline.js             # Client AI Engine: processes webcam frames every 300ms, tracks faces, blinks, iris gaze & HUD overlays
│       │   ├── 📄 gazeAttentionService.js           # Temporal gaze deviation analysis, decay scoring, debouncing, & offline event queueing
│       │   ├── 📄 enhancedProctoringService.js      # Coordinates webcam stream, screenshot captures, and audio telemetry
│       │   ├── 📄 faceVerificationService.js        # Face enrollment (30 frames) & multi-descriptor matching against verified profile
│       │   └── 📄 socketService.js                  # WebSocket client for real-time telemetry streaming to proctor dashboard
│       │
│       ├── 📂 utils/                                # Browser and Hardware Helper Utilities
│       │   ├── 📄 eyeMovementDetection.js           # High-accuracy pupil intensity extraction & continuous 10s eye-down timer violation detection
│       │   ├── 📄 phoneDetection.js                 # Anti-cheat detectors: tab switching, window blur, copy-paste, F12 / DevTools blocks
│       │   ├── 📄 deviceDetection.js                # Checks WebRTC camera/mic access, screen resolution, and hardware support
│       │   ├── 📄 faceModelLoader.js                # Asynchronously loads face-api.js weight manifests into memory with fallback retry
│       │   └── 📄 config.js                         # Dynamic base URL resolver for backend API & WebSocket connections
│       │
│       ├── 📂 pages/                                # Route Views & Main Application Screens
│       │   ├── 📄 AthenaExamDashboard.js            # Main Exam Interface: Split view with live camera, MCQ/Coding sections, timers, & AI HUD
│       │   ├── 📄 AdminMonitor.js                   # Proctor grid monitor with live candidate streams, logs, and violation feeds
│       │   ├── 📄 Login.js                          # Candidate login with credential validation & face capture matching
│       │   ├── 📄 Register.js                       # Candidate registration with 30-frame face enrollment & 6-digit email OTP
│       │   ├── 📄 Diagnostics.js                    # Pre-exam hardware system check (Webcam, Mic, Browser, Network Latency)
│       │   ├── 📄 Dashboard.js                      # Student home dashboard showing assigned exams and guidelines
│       │   ├── 📄 Exam.js                           # Standard assessment interface for taking exams
│       │   ├── 📄 ProctorDashboard.js               # Legacy proctor overview screen
│       │   └── 📄 ProctoringDashboard.js            # Real-time session status and violation summaries
│       │
│       └── 📂 components/                           # Reusable UI & Widget Components
│           ├── 📄 EyeTrackingWidget.js              # Floating calibration and live iris direction widget with recalibrate trigger
│           ├── 📄 FaceEnrollment.js                 # Camera capture interface capturing 30 face descriptors during signup
│           ├── 📄 FaceVerification.js               # Pre-exam identity gate verifying candidate against enrolled descriptors
│           ├── 📄 FaceVerificationStatus.js         # Visual badge displaying real-time identity match status and confidence %
│           ├── 📄 HeadphoneDetectionCard.js         # Telemetry card showing audio anomalies and earphone warnings
│           ├── 📄 PhoneDetectionCard.js             # Telemetry card displaying phone detection status
│           ├── 📄 NotificationToast.js              # Floating toast banner for non-blocking alerts
│           ├── 📄 Proctoring.js                     # Legacy proctoring overlay wrapper
│           ├── 📄 Sidebar.js                        # Navigation drawer for dashboard pages
│           ├── 📄 ViolationHistory.js               # Interactive log displaying timestamped incident records
│           │
│           └── 📂 athena/                           # Athena Exam Suite UI Components
│               ├── 📄 WebcamFeed.js                 # Camera canvas displaying bounding boxes, live FPS, and triggering violations
│               ├── 📄 AIMonitoringSidebar.js        # Live sidebar with Face Status, Eye Tracking, Attention Risk, Phone & Tab metrics
│               ├── 📄 MCQSection.js                 # Multiple Choice Question panel with option selectors, review mark, & nav controls
│               ├── 📄 CodingSection.js              # Interactive code editor with language picker, custom test cases, & run simulator
│               ├── 📄 TheorySection.js              # Subjective essay answer editor with autosave indicators
│               ├── 📄 AudioWaveMeter.js             # Web Audio API ambient noise level visualizer (dB SPL meter & multi-voice detector)
│               ├── 📄 ExamBlockerModal.js           # Fullscreen security freeze modal locking the test until proctor unblock or OTP pass
│               ├── 📄 LivenessChallengeModal.js     # Random active challenge modal (blink / smile / turn) to thwart photo spoofing
│               ├── 📄 QuestionPalette.js            # Interactive question grid showing Answered, Marked for Review, & Unanswered state
│               ├── 📄 AthenaHeader.js               # Top navigation bar showing student info, verified badge, countdown timer, & Submit
│               ├── 📄 ActivityLogPanel.js           # Real-time timeline log of all detected proctoring events
│               ├── 📄 AttentionStatusCard.js        # Colored status badge indicating normal / suspicious / high-risk attention score
│               ├── 📄 CriticalAlertBox.js           # Banner notification showing urgent cheating warnings
│               ├── 📄 OtpSixBoxInput.jsx            # 6-box numeric OTP input component for unblock identity challenges
│               ├── 📄 StatusBadgeCard.js            # Standardized metric card with icon, title, value, status dot, and subtext
│               └── 📄 SubmitConfirmationModal.js    # Final exam submission prompt summarizing answered questions
│
├── 📂 backend/                                      # Node.js Express & Socket.IO Backend Server
│   ├── 📄 package.json                              # Backend dependencies (Express, Mongoose, Socket.IO, JWT, Nodemailer, Bcrypt)
│   ├── 📄 server.js                                 # Server entry point: Express routes, MongoDB connection, Socket.IO server, & CORS setup
│   ├── 📄 seed.js                                   # Populates MongoDB with test exam questions, sample candidates, & initial admins
│   ├── 📄 cleanupLegacy.js                          # Maintenance script cleaning orphaned logs and stale test sessions
│   │
│   ├── 📂 models/                                   # MongoDB Mongoose Data Schemas
│   │   ├── 📄 User.js / Student.js                  # Candidate account records, password hashes, and enrollment flags
│   │   ├── 📄 LiveSession.js                        # Active exam session telemetry (candidate status, current gaze, live warnings)
│   │   ├── 📄 ExamSession.js                        # Completed exam history, question responses, timestamps, and cheating flags
│   │   ├── 📄 FaceEmbedding.js / FaceProfile.js     # Stores 30 facial 128-d biometric descriptor vectors per student
│   │   ├── 📄 Violation.js / CheatingLog.js         # Logged cheating incidents with violation type, severity, & screenshot URL
│   │   ├── 📄 GazeEvent.js                          # Gaze deviation telemetry events (direction, duration, suspicion score)
│   │   ├── 📄 OTP.js                                # Ephemeral 6-digit email codes with TTL expiration for verification
│   │   ├── 📄 Admin.js                              # Proctor / administrator credentials and role permissions
│   │   ├── 📄 Alert.js / Incident.js                # System-generated proctor alerts and intervention logs
│   │   ├── 📄 VerificationLog.js                    # Identity check history with matching frame counts and similarity score
│   │   ├── 📄 ScreenshotEvidence.js                 # Metadata and image paths for captured incident proofs
│   │   ├── 📄 examModel.js                          # Exam definition (title, duration, total marks, passing score)
│   │   └── 📄 quesModel.js                          # Question bank items (MCQ choices, correct answer, coding templates, testcases)
│   │
│   ├── 📂 routes/                                   # REST API Route Endpoints
│   │   ├── 📄 proctoringRoutes.js                   # Handles violation reporting, telemetry updates, audio alerts, and evidence saves
│   │   ├── 📄 proctorApi.js                         # Proctor control endpoints (session unlock, manual warning, terminate exam)
│   │   ├── 📄 faceRoutes.js                         # Biometric face enrollment upload, descriptor storage, & verification match
│   │   ├── 📄 otpRoutes.js                          # Generates & verifies 6-digit email OTPs for registration and unblocking
│   │   ├── 📄 adminRoutes.js / adminApi.js          # Admin dashboard analytics, session lists, student summaries, & exam reports
│   │   ├── 📄 userRoutes.js                         # Student login, registration, and profile management
│   │   ├── 📄 examRoutes.js                         # Exam retrieval, question fetching, and answer submission endpoints
│   │   └── 📄 headMovementRoutes.js                 # Endpoints for head pose telemetry logs and historical deviations
│   │
│   ├── 📂 controllers/                              # Express Request Handlers
│   │   └── 📄 (Business logic separating route endpoints from MongoDB operations)
│   │
│   ├── 📂 middleware/                               # Express Middleware
│   │   └── 📄 authMiddleware.js                     # JWT verification, student identity checks, and proctor role authorization
│   │
│   └── 📂 services/                                 # Server Utility Services
│       └── 📄 (Email dispatch service, PDF report generation, and screenshot file management)
│
├── 📂 admin/                                        # React Admin & Proctor Control Center
│   ├── 📄 package.json                              # Admin panel dependencies (Material UI, Chart.js, Lucide Icons, Socket.IO)
│   │
│   └── 📂 src/                                      # Admin frontend application
│       ├── 📄 App.jsx                               # Admin router (Live Video Wall, Student Analytics, Exam Config, Session Audits)
│       ├── 📄 index.js                              # Admin React mounting root
│       │
│       ├── 📂 pages/                                # Admin Monitoring Views
│       │   ├── 📄 LiveMonitorPage.jsx               # Multi-candidate live video stream wall with instantaneous violation popups
│       │   ├── 📄 AnalyticsPage.jsx                 # Statistical charts tracking frequency of looking down, phones, & tab switches
│       │   ├── 📄 StudentDetailPage.jsx             # Detailed candidate timeline audit view with screenshot proof gallery
│       │   └── 📄 (Session management and exam configuration screens)
│       │
│       ├── 📂 components/                           # Admin Widgets & Panels
│       │   ├── 📂 common/FilterPanel.jsx            # Filters candidates by status (Online, Suspicious, Terminated, High Risk)
│       │   └── 📂 (Candidate card tiles, audio monitor badges, and warning dispatch buttons)
│       │
│       ├── 📂 context/                              # Shared State Providers
│       │   └── 📄 (Admin authentication context and live WebSocket state)
│       │
│       └── 📂 services/                             # Admin API & Socket Connectors
│           └── 📄 (HTTP client for fetching live candidate lists and sending proctor overrides)
│
└── 📂 python_detector/                              # Python AI Computer Vision Microservice (Optional Secondary Engine)
    ├── 📄 main.py                                   # FastAPI / OpenCV service running YOLOv8 (phone/books/earphones) & MediaPipe Face Mesh
    ├── 📄 requirements.txt                          # Python dependencies (`ultralytics`, `mediapipe`, `opencv-python`, `torch`)
    └── 📄 start.bat                                 # Windows batch launcher to spin up the Python detector on port 8000
```
