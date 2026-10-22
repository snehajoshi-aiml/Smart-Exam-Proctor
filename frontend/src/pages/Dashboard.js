import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { detectPhone, canTakeExam, showPhoneWarning, getDeviceInfoForLogging } from "../utils/deviceDetection";

function Dashboard() {
  const navigate = useNavigate();
  const [isPhone, setIsPhone] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [examStarting, setExamStarting] = useState(false);
  const [user, setUser] = useState({
    name: "Alex Johnson",
    studentId: "STU-2024-8891",
    course: "CS-402: Advanced Software Engineering",
    email: "alex.johnson@university.edu"
  });

  useEffect(() => {
    // Load logged in user if available
    try {
      const stored = localStorage.getItem("user");
      if (stored) {
        setUser(JSON.parse(stored));
      }
    } catch (e) {}

    const device = detectPhone();
    setIsPhone(device.isPhone);

    const deviceLog = getDeviceInfoForLogging();
    if (device.isPhone) {
      setShowWarning(true);
      showPhoneWarning();
    }
    sessionStorage.setItem("dashboardDeviceInfo", JSON.stringify(deviceLog));
  }, []);

  const handleStartExam = async () => {
    setExamStarting(true);
    const allowed = canTakeExam();

    if (!allowed) {
      setExamStarting(false);
      return;
    }

    const currentDevice = detectPhone();
    if (currentDevice.isPhone) {
      alert("❌ Cannot start exam on mobile device. Please use a desktop/laptop.");
      setExamStarting(false);
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("❌ Camera access not supported on this device.");
      setExamStarting(false);
      return;
    }

    navigate("/athena-exam");
    setExamStarting(false);
  };

  return (
    <div style={styles.pageContainer}>
      {/* Background Radial Glow Effects */}
      <div style={styles.glowTopLeft}></div>
      <div style={styles.glowBottomRight}></div>

      {/* Top Navbar */}
      <nav style={styles.navbar}>
        <div style={styles.navBrand}>
          <span style={{ fontSize: '1.4rem' }}>🗣️</span>
          <div>
            <div style={styles.navTitle}>Athena Smart Proctoring</div>
            <div style={styles.navSub}>Candidate Command Dashboard</div>
          </div>
        </div>

        <div style={styles.navRight}>
          <div style={styles.sentinelBadge}>
            <span style={styles.liveDot}></span>
            AI Sentinel Active
          </div>

          <div style={styles.userProfilePill}>
            <div style={styles.userAvatar}>
              {user.name ? user.name.charAt(0) : "A"}
            </div>
            <div>
              <div style={styles.userName}>{user.name}</div>
              <div style={styles.userId}>{user.studentId || "STU-2024-8891"}</div>
            </div>
          </div>

          <button onClick={() => navigate("/")} style={styles.logoutBtn}>
            Logout
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <div style={styles.contentWrapper}>
        {/* Mobile Warning Alert */}
        {showWarning && isPhone && (
          <div style={styles.mobileAlertCard}>
            <span>📱⚠️ <strong>Mobile Access Restricted:</strong> Proctored exams require a desktop/laptop with webcam & microphone.</span>
          </div>
        )}

        {/* Candidate Welcome Banner */}
        <div style={styles.welcomeBanner}>
          <div>
            <div style={styles.welcomeTag}>🎓 Verification Complete • Ready for Examination</div>
            <h1 style={styles.welcomeTitle}>Welcome, {user.name}!</h1>
            <p style={styles.welcomeSub}>{user.course || "CS-402: Advanced Software Engineering"}</p>
          </div>

          <div style={styles.verificationChip}>
            <span style={{ fontSize: '1.2rem' }}>🛡️</span>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 700 }}>ArcFace Verified</div>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Cosine Similarity: 98.4%</div>
            </div>
          </div>
        </div>

        {/* System Telemetry & Pre-Flight Check Cards */}
        <div style={styles.telemetryGrid}>
          {/* Card 1: Camera */}
          <div style={styles.telemetryCard} className="athena-dash-card">
            <div style={styles.cardHeader}>
              <span style={styles.cardIcon}>📷</span>
              <span style={styles.cardStatusOk}>✓ Ready</span>
            </div>
            <div style={styles.cardTitle}>Webcam Telemetry</div>
            <div style={styles.cardDesc}>SCRFD & ArcFace Face Detector</div>
            <div style={styles.cardStat}>1080p HD • 30 FPS</div>
          </div>

          {/* Card 2: Mic */}
          <div style={styles.telemetryCard} className="athena-dash-card">
            <div style={styles.cardHeader}>
              <span style={styles.cardIcon}>🎙️</span>
              <span style={styles.cardStatusOk}>✓ Active</span>
            </div>
            <div style={styles.cardTitle}>Audio Monitor</div>
            <div style={styles.cardDesc}>Ambient Noise & Speaker Monitor</div>
            <div style={styles.cardStat}>22 dB SPL • Clear</div>
          </div>

          {/* Card 3: Network */}
          <div style={styles.telemetryCard} className="athena-dash-card">
            <div style={styles.cardHeader}>
              <span style={styles.cardIcon}>⚡</span>
              <span style={styles.cardStatusOk}>✓ Fast</span>
            </div>
            <div style={styles.cardTitle}>Network Telemetry</div>
            <div style={styles.cardDesc}>WebSockets & Low Latency API</div>
            <div style={styles.cardStat}>24ms Latency • 100 Mbps</div>
          </div>

          {/* Card 4: AI Proctor */}
          <div style={styles.telemetryCard} className="athena-dash-card">
            <div style={styles.cardHeader}>
              <span style={styles.cardIcon}>🛡️</span>
              <span style={styles.cardStatusOk}>✓ Enforced</span>
            </div>
            <div style={styles.cardTitle}>Proctoring Engine</div>
            <div style={styles.cardDesc}>Gaze, Head Pose & Screen Lock</div>
            <div style={styles.cardStat}>Fullscreen • Strict</div>
          </div>
        </div>

        {/* Start Exam CTA Card */}
        <div style={styles.ctaCard}>
          <div style={styles.ctaInfo}>
            <h2 style={styles.ctaTitle}>Ready to begin your proctored assessment?</h2>
            <p style={styles.ctaSub}>
              Duration: <strong>60 Minutes</strong> | Questions: <strong>10 MCQs + 2 Coding + 2 Theory</strong>
            </p>
          </div>

          <button
            onClick={handleStartExam}
            disabled={isPhone || examStarting}
            style={{
              ...styles.launchBtn,
              ...((isPhone || examStarting) && styles.disabledLaunchBtn)
            }}
            className="athena-glow-button"
          >
            {examStarting ? "Initializing..." : (isPhone ? "❌ Mobile Restricted" : "🚀 Launch Proctored Exam")}
          </button>
        </div>

        {/* Proctoring Rules Summary Card */}
        <div style={styles.rulesCard}>
          <h3 style={styles.rulesTitle}>📋 Mandatory Examination Regulations</h3>
          <div style={styles.rulesGrid}>
            <div style={styles.ruleItem}>
              <span style={styles.ruleIcon}>👁️</span>
              <div>
                <strong>Continuous Eye & Head Tracking:</strong>
                <p>Keep your eyes focused on the screen. Looking away repeatedly raises automated warning logs.</p>
              </div>
            </div>

            <div style={styles.ruleItem}>
              <span style={styles.ruleIcon}>🖥️</span>
              <div>
                <strong>Fullscreen Lock Enforcement:</strong>
                <p>Exiting fullscreen mode or switching browser tabs is strictly monitored and flagged.</p>
              </div>
            </div>

            <div style={styles.ruleItem}>
              <span style={styles.ruleIcon}>📱</span>
              <div>
                <strong>No Secondary Devices:</strong>
                <p>Mobile phones, smartwatches, and extra monitors are automatically detected via COCO-SSD.</p>
              </div>
            </div>

            <div style={styles.ruleItem}>
              <span style={styles.ruleIcon}>🎙️</span>
              <div>
                <strong>Audio Telemetry Monitoring:</strong>
                <p>Ensure a quiet room environment. Background voices are analyzed for suspicious activity.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Modern Dark Glassmorphism Styles System
const styles = {
  pageContainer: {
    minHeight: "100vh",
    backgroundColor: "#070c18",
    color: "#f8fafc",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    position: "relative",
    overflowX: "hidden",
    paddingBottom: "40px"
  },
  glowTopLeft: {
    position: "absolute",
    top: "-150px",
    left: "-150px",
    width: "450px",
    height: "450px",
    background: "radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, rgba(7, 12, 24, 0) 70%)",
    pointerEvents: "none",
    zIndex: 0
  },
  glowBottomRight: {
    position: "absolute",
    bottom: "-150px",
    right: "-150px",
    width: "450px",
    height: "450px",
    background: "radial-gradient(circle, rgba(168, 85, 247, 0.15) 0%, rgba(7, 12, 24, 0) 70%)",
    pointerEvents: "none",
    zIndex: 0
  },
  navbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 36px",
    background: "rgba(15, 23, 42, 0.85)",
    backdropFilter: "blur(16px)",
    borderBottom: "1px solid rgba(99, 102, 241, 0.2)",
    position: "relative",
    zIndex: 10
  },
  navBrand: {
    display: "flex",
    alignItems: "center",
    gap: "14px"
  },
  navTitle: {
    fontWeight: 700,
    fontSize: "1.1rem",
    color: "#ffffff"
  },
  navSub: {
    fontSize: "0.75rem",
    color: "#94a3b8"
  },
  navRight: {
    display: "flex",
    alignItems: "center",
    gap: "18px"
  },
  sentinelBadge: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    background: "rgba(16, 185, 129, 0.1)",
    border: "1px solid rgba(16, 185, 129, 0.3)",
    color: "#10b981",
    padding: "6px 14px",
    borderRadius: "20px",
    fontSize: "0.78rem",
    fontWeight: 600
  },
  liveDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    background: "#10b981",
    boxShadow: "0 0 10px #10b981"
  },
  userProfilePill: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    background: "#0f172a",
    padding: "6px 14px",
    borderRadius: "14px",
    border: "1px solid #1e293b"
  },
  userAvatar: {
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    background: "linear-gradient(135deg, #6366f1, #a855f7)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    color: "white",
    fontSize: "0.9rem"
  },
  userName: {
    fontSize: "0.85rem",
    fontWeight: 700,
    color: "#f8fafc"
  },
  userId: {
    fontSize: "0.7rem",
    color: "#94a3b8"
  },
  logoutBtn: {
    background: "transparent",
    border: "1px solid #334155",
    color: "#cbd5e1",
    padding: "6px 14px",
    borderRadius: "10px",
    cursor: "pointer",
    fontSize: "0.8rem",
    fontWeight: 600,
    transition: "all 0.2s ease"
  },
  contentWrapper: {
    maxWidth: "1100px",
    margin: "32px auto",
    padding: "0 24px",
    position: "relative",
    zIndex: 1
  },
  mobileAlertCard: {
    background: "rgba(239, 68, 68, 0.15)",
    border: "1px solid #ef4444",
    color: "#fca5a5",
    padding: "14px 20px",
    borderRadius: "14px",
    marginBottom: "24px",
    fontSize: "0.9rem"
  },
  welcomeBanner: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(30, 41, 59, 0.8))",
    backdropFilter: "blur(12px)",
    border: "1px solid rgba(99, 102, 241, 0.3)",
    borderRadius: "20px",
    padding: "28px 32px",
    marginBottom: "28px",
    boxShadow: "0 10px 30px rgba(0,0,0,0.4)"
  },
  welcomeTag: {
    fontSize: "0.78rem",
    fontWeight: 700,
    color: "#818cf8",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: "6px"
  },
  welcomeTitle: {
    fontSize: "1.8rem",
    fontWeight: 800,
    margin: "0 0 4px 0",
    color: "#ffffff"
  },
  welcomeSub: {
    fontSize: "0.92rem",
    color: "#cbd5e1",
    margin: 0
  },
  verificationChip: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    background: "rgba(16, 185, 129, 0.1)",
    border: "1px solid rgba(16, 185, 129, 0.3)",
    padding: "10px 18px",
    borderRadius: "14px"
  },
  telemetryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
    gap: "20px",
    marginBottom: "28px"
  },
  telemetryCard: {
    background: "rgba(15, 23, 42, 0.75)",
    backdropFilter: "blur(12px)",
    border: "1px solid rgba(30, 41, 59, 0.8)",
    borderRadius: "16px",
    padding: "20px",
    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "12px"
  },
  cardIcon: {
    fontSize: "1.4rem"
  },
  cardStatusOk: {
    fontSize: "0.75rem",
    fontWeight: 700,
    color: "#10b981",
    background: "rgba(16, 185, 129, 0.1)",
    padding: "2px 8px",
    borderRadius: "8px"
  },
  cardTitle: {
    fontSize: "0.95rem",
    fontWeight: 700,
    color: "#f8fafc",
    marginBottom: "4px"
  },
  cardDesc: {
    fontSize: "0.78rem",
    color: "#94a3b8",
    marginBottom: "12px"
  },
  cardStat: {
    fontSize: "0.78rem",
    fontWeight: 600,
    color: "#818cf8"
  },
  ctaCard: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "linear-gradient(135deg, rgba(79, 70, 229, 0.2), rgba(168, 85, 247, 0.2))",
    border: "1px solid rgba(99, 102, 241, 0.5)",
    borderRadius: "20px",
    padding: "28px 32px",
    marginBottom: "28px",
    flexWrap: "wrap",
    gap: "20px"
  },
  ctaInfo: {
    flex: 1
  },
  ctaTitle: {
    fontSize: "1.25rem",
    fontWeight: 800,
    margin: "0 0 6px 0",
    color: "#ffffff"
  },
  ctaSub: {
    fontSize: "0.88rem",
    color: "#cbd5e1",
    margin: 0
  },
  launchBtn: {
    background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
    color: "#ffffff",
    border: "none",
    borderRadius: "14px",
    padding: "16px 36px",
    fontSize: "1rem",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 8px 24px rgba(79, 70, 229, 0.4)",
    transition: "all 0.3s ease"
  },
  disabledLaunchBtn: {
    background: "#334155",
    color: "#94a3b8",
    cursor: "not-allowed",
    boxShadow: "none"
  },
  rulesCard: {
    background: "rgba(15, 23, 42, 0.75)",
    backdropFilter: "blur(12px)",
    border: "1px solid rgba(30, 41, 59, 0.8)",
    borderRadius: "20px",
    padding: "28px 32px"
  },
  rulesTitle: {
    fontSize: "1.1rem",
    fontWeight: 700,
    color: "#cbd5e1",
    marginTop: 0,
    marginBottom: "20px"
  },
  rulesGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "20px"
  },
  ruleItem: {
    display: "flex",
    gap: "14px",
    fontSize: "0.82rem",
    color: "#cbd5e1",
    lineHeight: 1.4
  },
  ruleIcon: {
    fontSize: "1.3rem"
  }
};

// Add custom CSS animations for Dashboard
const styleSheet = document.createElement("style");
styleSheet.textContent = `
  .athena-dash-card:hover {
    transform: translateY(-4px);
    border-color: rgba(99, 102, 241, 0.6) !important;
    box-shadow: 0 12px 28px rgba(99, 102, 241, 0.15);
  }
  .athena-glow-button:hover:not(:disabled) {
    transform: translateY(-2px) scale(1.02);
    box-shadow: 0 12px 32px rgba(99, 102, 241, 0.6) !important;
  }
`;
document.head.appendChild(styleSheet);

export default Dashboard;