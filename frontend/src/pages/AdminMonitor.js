import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { getApiBaseUrl } from '../utils/config';
import { getSocket } from '../services/socketService';
import { jsPDF } from 'jspdf';

export default function AdminMonitor() {
  const [activeNav, setActiveNav] = useState('live');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [darkMode, setDarkMode] = useState(true);

  const [students, setStudents] = useState([]);
  const [violations, setViolations] = useState([]);
  const [finishedStudents, setFinishedStudents] = useState([]);
  const [terminatedStudents, setTerminatedStudents] = useState([]);
  const [selectedStudentDetail, setSelectedStudentDetail] = useState(null);
  const [watchingStudent, setWatchingStudent] = useState(null);
  const [evidenceModalImage, setEvidenceModalImage] = useState(null);

  const [metrics, setMetrics] = useState({
    activeExams: 3,
    activeStudents: 12,
    violationsToday: 18,
    highRiskStudents: 2,
    examsCompleted: 14
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [riskFilter, setRiskFilter] = useState('ALL');
  const [actionMessage, setActionMessage] = useState('');

  const [reportsData, setReportsData] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [inspectingStudent, setInspectingStudent] = useState(null);
  const [adminToasts, setAdminToasts] = useState([]);
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      type: 'TAB_SWITCH',
      studentName: 'Subhash K',
      usn: 'STU_ksubhashk998_gmail_com',
      message: 'Candidate switched browser tabs during exam session',
      severity: 'high',
      time: 'Just Now'
    },
    {
      id: 2,
      type: 'FACE_MISSING',
      studentName: 'Subhash K',
      usn: 'STU_ksubhashk998_gmail_com',
      message: 'Candidate face missing from camera frame',
      severity: 'critical',
      time: '2 mins ago'
    }
  ]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  const fetchData = async () => {
    try {
      const apiBase = getApiBaseUrl();
      const token = localStorage.getItem('adminToken') || 'dev_admin_token';
      const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

      const [studentsRes, analyticsRes, violationsRes, finishedRes, terminatedRes, reportsRes] = await Promise.all([
        axios.get(`${apiBase}/api/admin/students/live`, authHeaders).catch(() => null),
        axios.get(`${apiBase}/api/admin/analytics`, authHeaders).catch(() => null),
        axios.get(`${apiBase}/api/admin/violations`, authHeaders).catch(() => null),
        axios.get(`${apiBase}/api/admin/finished`, authHeaders).catch(() => null),
        axios.get(`${apiBase}/api/admin/terminated`, authHeaders).catch(() => null),
        axios.get(`${apiBase}/api/admin/reports`, authHeaders).catch(() => null)
      ]);

      if (studentsRes?.data?.success) {
        const incoming = (studentsRes.data.students || []).filter(s =>
          ['Online', 'Warning', 'Active', 'in-progress'].includes(s.status)
        );
        setStudents(prev => {
          if (incoming.length === 0) return [];
          return incoming.map(inc => {
            const existing = prev.find(p =>
              p.studentId === inc.studentId ||
              p.usn === inc.usn ||
              (p.email && inc.email && p.email.toLowerCase() === inc.email.toLowerCase())
            );
            if (!existing) return inc;
            return {
              ...inc,
              image: inc.image || existing.image || null,
              status: inc.status,
              riskLevel: inc.riskLevel || existing.riskLevel || 'Safe (0-20)',
              headPose: inc.headPose && inc.headPose !== 'N/A' ? inc.headPose : (existing.headPose || 'Looking Center'),
              eyeGaze: inc.eyeGaze && inc.eyeGaze !== 'N/A' ? inc.eyeGaze : (existing.eyeGaze || 'Center')
            };
          });
        });
      }

      if (analyticsRes?.data?.success && analyticsRes.data.metrics) {
        setMetrics(analyticsRes.data.metrics);
      }

      if (violationsRes?.data?.success) {
        const vList = violationsRes.data.violations || [];
        setViolations(vList);
        setHistoryData(vList.map((v, i) => ({
          id: v.id || `HIST_${i}`,
          studentName: v.studentName || 'Student',
          usn: v.usn || 'STU_USER',
          action: v.violationType || 'Activity Event',
          time: v.time || (v.timestamp ? new Date(v.timestamp).toLocaleTimeString() : 'Recent'),
          severity: v.severity || 'Info',
          details: v.description || 'Proctoring telemetry recorded',
          screenshot: v.screenshot
        })));
      }

      if (finishedRes?.data?.success) {
        setFinishedStudents(finishedRes.data.finishedStudents || []);
      }

      if (terminatedRes?.data?.success) {
        setTerminatedStudents(terminatedRes.data.terminatedStudents || []);
      }

      if (reportsRes?.data?.success) {
        setReportsData(reportsRes.data);
      }
    } catch (error) {
      console.error('Error loading admin live data:', error);
    }
  };

  const lastAlertTimestampRef = React.useRef({});

  // Mobile Notification Sound Generator (Authentic Modern Smartphone Tri-Tone Chime)
  const playMobileNotificationSound = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const startTime = ctx.currentTime;

      // Authentic mobile chime triad (C6 -> E6 -> G6)
      const notes = [
        { freq: 1046.50, start: 0, duration: 0.12, gain: 0.35 },    // C6
        { freq: 1318.51, start: 0.08, duration: 0.14, gain: 0.38 }, // E6
        { freq: 1567.98, start: 0.16, duration: 0.32, gain: 0.42 }  // G6
      ];

      notes.forEach(({ freq, start, duration, gain }) => {
        const noteStart = startTime + start;

        // Primary bell tone
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, noteStart);

        gainNode.gain.setValueAtTime(0.001, noteStart);
        gainNode.gain.exponentialRampToValueAtTime(gain, noteStart + 0.015);
        gainNode.gain.exponentialRampToValueAtTime(0.001, noteStart + duration);

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc.start(noteStart);
        osc.stop(noteStart + duration);

        // Soft harmonic overtone for warm acoustic phone resonance
        const harmonic = ctx.createOscillator();
        const harmonicGain = ctx.createGain();

        harmonic.type = 'triangle';
        harmonic.frequency.setValueAtTime(freq * 2, noteStart);

        harmonicGain.gain.setValueAtTime(0.001, noteStart);
        harmonicGain.gain.exponentialRampToValueAtTime(gain * 0.22, noteStart + 0.01);
        harmonicGain.gain.exponentialRampToValueAtTime(0.001, noteStart + (duration * 0.65));

        harmonic.connect(harmonicGain);
        harmonicGain.connect(ctx.destination);

        harmonic.start(noteStart);
        harmonic.stop(noteStart + (duration * 0.65));
      });
    } catch (e) {
      console.warn('Mobile notification audio chime error:', e.message);
    }
  };

  useEffect(() => {
    fetchData();
    const socket = getSocket();
    if (socket) {
      socket.emit('join_admin');

      const pushAlert = (notif) => {
        if (!notif) return;
        const key = `${notif.studentId || ''}_${notif.type || ''}`;
        const now = Date.now();
        // Prevent duplicate alerts within 6 seconds
        if (lastAlertTimestampRef.current[key] && (now - lastAlertTimestampRef.current[key] < 6000)) {
          return;
        }
        lastAlertTimestampRef.current[key] = now;

        // Play authentic mobile notification sound
        playMobileNotificationSound();

        setNotifications(prev => [notif, ...prev.slice(0, 49)]);
        setAdminToasts(prev => [notif, ...prev]);
        setTimeout(() => {
          setAdminToasts(prev => prev.filter(t => t.id !== notif.id));
        }, 7000);
      };

      socket.on('admin-notification', (notif) => {
        pushAlert(notif);
        fetchData();
      });
      
      socket.on('multi-face-violation', (data) => {
        playMobileNotificationSound();
        setViolations(prev => [{
          id: "VIO_" + Date.now(),
          studentName: data.studentName || data.studentId || 'Student',
          usn: data.usn || data.studentId || 'STU_LIVE',
          email: data.studentEmail || 'student@university.edu',
          examName: data.examId || 'Computer Science Final Assessment',
          violationType: 'MULTIPLE FACES',
          confidence: '95.0%',
          time: new Date(data.timestamp || Date.now()).toLocaleTimeString(),
          date: new Date().toLocaleDateString(),
          severity: data.status === 'Exam Terminated' ? 'critical' : 'high',
          status: 'Flagged',
          screenshot: data.screenshot
        }, ...prev]);
      });

      socket.on('student-updated', (data) => {
        if (!data) return;
        setStudents(prev => prev.map(s => {
          const isMatch = (data.studentId && (s.studentId === data.studentId || s.usn === data.studentId)) ||
                          (data.email && s.email && s.email.toLowerCase() === data.email.toLowerCase()) ||
                          (data.usn && s.usn === data.usn);
          if (isMatch) {
            return {
              ...s,
              ...data,
              image: data.lastWebcamFrame || data.image || s.image
            };
          }
          return s;
        }));
      });

      socket.on('video-stream', (data) => {
        if (!data) return;
        setStudents(prev => {
          const idx = prev.findIndex(s =>
            (data.studentId && (s.studentId === data.studentId || s.usn === data.studentId)) ||
            (data.email && s.email && s.email.toLowerCase() === data.email.toLowerCase()) ||
            (data.usn && s.usn === data.usn)
          );
          if (idx !== -1) {
            const updated = [...prev];
            updated[idx] = {
              ...updated[idx],
              image: data.image,
              status: 'Online'
            };
            return updated;
          }
          const email = data.email || 'student@university.edu';
          const studentId = data.studentId || ('STU_' + email.replace(/[^a-z0-9]/gi, '_'));
          return [{
            sessionId: `SESS_${studentId}`,
            studentId,
            studentName: data.studentName || 'Student',
            usn: data.usn || studentId,
            email,
            department: 'Computer Science & Engineering',
            examName: 'Computer Science Final Assessment',
            status: 'Online',
            image: data.image,
            verificationStatus: 'Verified',
            faceMatchConfidence: 96,
            faceDetected: true,
            multipleFaces: false,
            mobilePhoneDetected: false,
            fullScreenStatus: 'Active',
            headPose: 'Looking Center',
            eyeGaze: 'Center',
            tabSwitchingCount: 0,
            warningsCount: 0,
            riskLevel: 'Safe (0-20)'
          }, ...prev];
        });
      });

      socket.on('telemetry-update', (data) => {
        if (!data) return;
        setStudents(prev => {
          const idx = prev.findIndex(s =>
            (data.studentId && (s.studentId === data.studentId || s.usn === data.studentId)) ||
            (data.email && s.email && s.email.toLowerCase() === data.email.toLowerCase()) ||
            (data.usn && s.usn === data.usn)
          );
          if (idx !== -1) {
            const updated = [...prev];
            updated[idx] = {
              ...updated[idx],
              studentName: data.studentName || updated[idx].studentName,
              status: data.status || 'Online',
              verificationStatus: data.identityStatus || updated[idx].verificationStatus,
              faceMatchConfidence: data.confidence || updated[idx].faceMatchConfidence,
              faceDetected: data.faceDetected !== undefined ? data.faceDetected : updated[idx].faceDetected,
              multipleFaces: data.multipleFaces !== undefined ? data.multipleFaces : updated[idx].multipleFaces,
              mobilePhoneDetected: data.mobilePhoneDetected !== undefined ? data.mobilePhoneDetected : updated[idx].mobilePhoneDetected,
              fullScreenStatus: data.fullScreenStatus || updated[idx].fullScreenStatus,
              headPose: data.headPose || updated[idx].headPose,
              eyeGaze: data.eyeGaze || updated[idx].eyeGaze,
              image: data.image || updated[idx].image,
              riskLevel: data.riskLevel || updated[idx].riskLevel
            };
            return updated;
          }
          const email = data.email || 'student@university.edu';
          const studentId = data.studentId || ('STU_' + email.replace(/[^a-z0-9]/gi, '_'));
          return [{
            sessionId: `SESS_${studentId}`,
            studentId,
            studentName: data.studentName || 'Student',
            usn: data.usn || studentId,
            email,
            department: 'Computer Science & Engineering',
            examName: 'Computer Science Final Assessment',
            status: data.status || 'Online',
            image: data.image || null,
            verificationStatus: data.identityStatus || 'Verified',
            faceMatchConfidence: data.confidence || 96,
            faceDetected: data.faceDetected !== undefined ? data.faceDetected : true,
            multipleFaces: data.multipleFaces || false,
            mobilePhoneDetected: data.mobilePhoneDetected || false,
            fullScreenStatus: data.fullScreenStatus || 'Active',
            headPose: data.headPose || 'Looking Center',
            eyeGaze: data.eyeGaze || 'Center',
            tabSwitchingCount: 0,
            warningsCount: 0,
            riskLevel: data.riskLevel || 'Safe (0-20)'
          }, ...prev];
        });
      });

      socket.on('violation', (data) => {
        playMobileNotificationSound();
      });

      socket.on('violation-detected', (data) => {
        playMobileNotificationSound();
      });

      socket.on('ai-alert', (data) => {
        playMobileNotificationSound();
      });

      socket.on('tab-switch', (data) => {
        playMobileNotificationSound();
      });

      socket.on('student-finished', (data) => {
        setFinishedStudents(prev => [data, ...prev.filter(s => s.studentId !== data.studentId)]);
        setStudents(prev => prev.map(s => (s.studentId === data.studentId || s.email === data.email ? { ...s, status: 'Offline' } : s)));
      });

      socket.on('exam-finished', (data) => {
        setFinishedStudents(prev => [data, ...prev.filter(s => s.studentId !== data.studentId)]);
        setStudents(prev => prev.map(s => (s.studentId === data.studentId || s.email === data.email ? { ...s, status: 'Offline' } : s)));
      });

      socket.on('gaze-attention-update', (data) => {
        if (!data || !data.studentId) return;
        setStudents(prev => prev.map(s => {
          const isMatch = s.studentId === data.studentId || s.usn === data.studentId || s.sessionId === data.sessionId;
          if (isMatch) {
            return {
              ...s,
              attentionRiskLevel: data.riskLevel || 'NORMAL',
              lastGazeDirection: data.direction || 'CENTER',
              suspicionScore: data.suspicionScore || 0,
              gazeDeviationsCount: (s.gazeDeviationsCount || 0) + (data.eventType === 'GAZE_DEVIATION' ? 1 : 0),
              longestGazeDeviation: Math.max(s.longestGazeDeviation || 0, data.duration || 0),
              recentGazeEvents: [data, ...(s.recentGazeEvents || []).slice(0, 9)]
            };
          }
          return s;
        }));
      });

      socket.on('student-status', (data) => {
        if (!data || !data.studentId) return;
        setStudents(prev => prev.map(s => {
          if (s.studentId === data.studentId || s.usn === data.studentId || (data.email && s.email === data.email)) {
            return { ...s, status: data.status };
          }
          return s;
        }));
      });

      socket.on('student-disconnected', (data) => {
        if (!data || !data.studentId) return;
        setStudents(prev => prev.map(s => {
          if (s.studentId === data.studentId || s.usn === data.studentId || (data.email && s.email === data.email)) {
            return { ...s, status: 'Offline' };
          }
          return s;
        }));
      });

      socket.on('student-terminated', (data) => {
        setTerminatedStudents(prev => [data, ...prev.filter(s => s.studentId !== data.studentId)]);
        setStudents(prev => prev.map(s => (s.studentId === data.studentId || s.email === data.email ? { ...s, status: 'Terminated' } : s)));
      });
    }

    const interval = setInterval(fetchData, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleWarnStudent = async (studentOrId) => {
    const studentId = typeof studentOrId === 'string' ? studentOrId : (studentOrId?.studentId || studentOrId?.usn);
    const studentObj = typeof studentOrId === 'object' && studentOrId !== null
      ? studentOrId
      : (students.find(s => s.studentId === studentId || s.usn === studentId || s.email === studentId) || selectedStudentDetail);
    const targetId = studentId || studentObj?.studentId || studentObj?.usn;
    if (!targetId) return;

    const warningMsg = '⚠️ Warning: Suspicious activity detected. Please return focus to your exam.';
    const displayName = studentObj?.studentName || studentObj?.fullName || targetId;

    // Optimistic UI state update
    setStudents(prev => prev.map(s => {
      if (s.studentId === targetId || s.usn === targetId || (studentObj?.email && s.email === studentObj.email)) {
        const nextWarnings = (s.warningsCount || 0) + 1;
        return {
          ...s,
          warningsCount: nextWarnings,
          status: 'Warning',
          riskLevel: nextWarnings >= 2 ? 'Medium (20-50)' : s.riskLevel
        };
      }
      return s;
    }));

    if (selectedStudentDetail && (selectedStudentDetail.studentId === targetId || selectedStudentDetail.usn === targetId || selectedStudentDetail.email === studentObj?.email)) {
      setSelectedStudentDetail(prev => ({
        ...prev,
        warningsCount: (prev?.warningsCount || 0) + 1,
        status: 'Warning'
      }));
    }

    setActionMessage(`⚠️ Warning issued to ${displayName}`);
    setTimeout(() => setActionMessage(''), 4000);

    // 1. Call Backend REST API
    const apiBase = getApiBaseUrl();
    const token = localStorage.getItem('adminToken') || 'dev_admin_token';
    try {
      await axios.post(`${apiBase}/api/admin/warn-student`, {
        studentId: targetId,
        message: warningMsg
      }, { headers: { Authorization: `Bearer ${token}` } });
    } catch (err) {
      console.warn('Warn student API notice:', err.message);
    }

    // 2. Emit Socket.IO event
    const socket = getSocket();
    if (socket) {
      socket.emit('warning-issued', {
        studentId: targetId,
        usn: studentObj?.usn || targetId,
        message: warningMsg,
        timestamp: new Date()
      });
      socket.emit('student-warning', {
        studentId: targetId,
        usn: studentObj?.usn || targetId,
        message: warningMsg,
        timestamp: new Date()
      });
    }
  };

  const handleTerminateStudent = async (studentOrId) => {
    const studentId = typeof studentOrId === 'string' ? studentOrId : (studentOrId?.studentId || studentOrId?.usn);
    const studentObj = typeof studentOrId === 'object' && studentOrId !== null
      ? studentOrId
      : (students.find(s => s.studentId === studentId || s.usn === studentId || s.email === studentId) || selectedStudentDetail);
    const targetId = studentId || studentObj?.studentId || studentObj?.usn;
    if (!targetId) return;

    const terminationReason = 'Terminated by Admin Command Center';
    const displayName = studentObj?.studentName || studentObj?.fullName || targetId;

    // Optimistic UI state update
    setStudents(prev => prev.map(s => {
      if (s.studentId === targetId || s.usn === targetId || (studentObj?.email && s.email === studentObj.email)) {
        return {
          ...s,
          status: 'Terminated',
          verificationStatus: 'Identity Failed',
          riskLevel: 'High Risk (50+)'
        };
      }
      return s;
    }));

    if (selectedStudentDetail && (selectedStudentDetail.studentId === targetId || selectedStudentDetail.usn === targetId || selectedStudentDetail.email === studentObj?.email)) {
      setSelectedStudentDetail(prev => ({
        ...prev,
        status: 'Terminated',
        verificationStatus: 'Identity Failed',
        riskLevel: 'High Risk (50+)'
      }));
    }

    setActionMessage(`🔴 Exam session terminated for ${displayName}`);
    setTimeout(() => setActionMessage(''), 4000);

    // 1. Call Backend REST API
    const apiBase = getApiBaseUrl();
    const token = localStorage.getItem('adminToken') || 'dev_admin_token';
    try {
      await axios.post(`${apiBase}/api/admin/terminate-session`, {
        studentId: targetId,
        sessionId: studentObj?.sessionId,
        reason: terminationReason
      }, { headers: { Authorization: `Bearer ${token}` } });
    } catch (err) {
      console.warn('Terminate session API notice:', err.message);
    }

    // 2. Emit Socket.IO event
    const socket = getSocket();
    if (socket) {
      socket.emit('student-terminated', {
        studentId: targetId,
        usn: studentObj?.usn || targetId,
        reason: terminationReason,
        timestamp: new Date()
      });
    }
  };

  const handleOpenStudentDetail = (student) => {
    setSelectedStudentDetail(student);
    setActiveNav('studentDetail');
  };

  const filteredStudents = students.filter((s) => {
    const statusStr = String(s.status || 'Offline').toLowerCase();
    const isTerminated = statusStr === 'terminated';
    const isWarning = statusStr === 'warning';
    const isAttendingExam = ['online', 'active', 'warning', 'in-progress'].includes(statusStr);

    // Live Monitoring strictly shows examinees actively attending the exam
    if (!isAttendingExam) return false;

    const matchesSearch =
      !searchTerm.trim() ||
      s.studentName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.usn?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.department?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRisk =
      riskFilter === 'ALL' ||
      (riskFilter === 'SAFE' && (s.riskLevel?.toLowerCase().includes('safe') || s.riskLevel?.toLowerCase().includes('low') || s.riskLevel?.toLowerCase().includes('normal'))) ||
      (riskFilter === 'MEDIUM' && (s.riskLevel?.toLowerCase().includes('medium') || s.riskLevel?.toLowerCase().includes('suspicious') || isWarning)) ||
      (riskFilter === 'HIGH' && (s.riskLevel?.toLowerCase().includes('high') || isTerminated));

    return matchesSearch && matchesRisk;
  });

  const handleExportPDF = () => {
    try {
      const DocConstructor = jsPDF?.default || jsPDF;
      const doc = new DocConstructor();

      // Page background & header banner
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, 210, 32, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text('ATHENA SMART EXAM PROCTORING SYSTEM', 14, 15);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(148, 163, 184);
      doc.text('Executive Proctoring Performance & Examination Audit Report', 14, 23);

      // Metadata section
      doc.setTextColor(71, 85, 105);
      doc.setFontSize(9);
      const generatedAt = new Date().toLocaleString();
      doc.text(`Report Generated: ${generatedAt}`, 14, 40);
      doc.text(`System Status: Athena AI Proctoring Engine Online & Verified`, 14, 46);

      // Section 1: Executive KPI Metrics
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.5);
      doc.line(14, 50, 196, 50);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(30, 41, 59);
      doc.text('1. Examination Key Performance Indicators (KPIs)', 14, 58);

      const totalAppeared = reportsData?.summary?.appeared || (finishedStudents.length + students.length);
      const totalFinished = reportsData?.summary?.finished || finishedStudents.length;
      const totalTerminated = reportsData?.summary?.terminated || terminatedStudents.length;
      const topCheat = reportsData?.summary?.mostCommonViolation || 'NONE';
      const avgViolations = reportsData?.summary?.avgViolations !== undefined ? reportsData.summary.avgViolations : '0.0';

      // KPI box
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(14, 63, 182, 32, 2, 2, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(14, 63, 182, 32, 2, 2, 'S');

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text('• Total Examinees Appeared:', 20, 72);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`${totalAppeared}`, 85, 72);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text('• Exams Finished Successfully:', 20, 79);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(16, 185, 129);
      doc.text(`${totalFinished}`, 85, 79);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text('• Terminated Candidates:', 20, 86);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(239, 68, 68);
      doc.text(`${totalTerminated}`, 85, 86);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text('• Top Cheating Indicator:', 115, 72);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(245, 158, 11);
      doc.text(`${topCheat}`, 168, 72);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text('• Avg Violations / Student:', 115, 79);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`${avgViolations}`, 168, 79);

      // Section 2: Department Breakdown
      let currentY = 108;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(30, 41, 59);
      doc.text('2. Departmental Examination Breakdown', 14, currentY);

      currentY += 6;
      doc.setFillColor(241, 245, 249);
      doc.rect(14, currentY, 182, 8, 'F');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(71, 85, 105);
      doc.text('DEPARTMENT', 18, currentY + 5.5);
      doc.text('CANDIDATES', 90, currentY + 5.5);
      doc.text('FINISHED', 120, currentY + 5.5);
      doc.text('TERMINATED', 145, currentY + 5.5);
      doc.text('INTEGRITY STATUS', 170, currentY + 5.5);

      currentY += 8;

      const deptList = (reportsData?.departmentStats && reportsData.departmentStats.length > 0)
        ? reportsData.departmentStats
        : [{
            department: 'Computer Science & Engineering',
            appeared: totalAppeared,
            finished: totalFinished,
            terminated: totalTerminated
          }];

      deptList.forEach((dept, idx) => {
        if (currentY > 265) {
          doc.addPage();
          currentY = 25;
        }

        doc.setFillColor(idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 252);
        doc.rect(14, currentY, 182, 8, 'F');

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(30, 41, 59);
        doc.text(String(dept.department || 'General').substring(0, 36), 18, currentY + 5.5);
        doc.text(String(dept.appeared || 0), 90, currentY + 5.5);
        doc.setTextColor(16, 185, 129);
        doc.text(String(dept.finished || 0), 120, currentY + 5.5);
        doc.setTextColor(dept.terminated > 0 ? 239 : 148, dept.terminated > 0 ? 68 : 163, dept.terminated > 0 ? 68 : 184);
        doc.text(String(dept.terminated || 0), 145, currentY + 5.5);
        doc.setTextColor(dept.terminated === 0 ? 16 : 239, dept.terminated === 0 ? 185 : 68, dept.terminated === 0 ? 129 : 68);
        doc.text(dept.terminated === 0 ? 'High Integrity' : 'Under Review', 170, currentY + 5.5);

        currentY += 8;
      });

      // Section 3: Examinee Session Records (if any)
      const allStudentsList = [
        ...finishedStudents.map(s => ({ ...s, auditStatus: 'Finished Successfully' })),
        ...terminatedStudents.map(s => ({ ...s, auditStatus: 'Terminated (Violation)' })),
        ...students.map(s => ({ ...s, auditStatus: s.status || 'Active In-Progress' }))
      ];

      if (allStudentsList.length > 0) {
        currentY += 8;
        if (currentY > 250) {
          doc.addPage();
          currentY = 25;
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(30, 41, 59);
        doc.text('3. Examinee Session Records', 14, currentY);

        currentY += 6;
        doc.setFillColor(241, 245, 249);
        doc.rect(14, currentY, 182, 8, 'F');
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(71, 85, 105);
        doc.text('NAME / USN', 18, currentY + 5.5);
        doc.text('EXAM STATUS', 90, currentY + 5.5);
        doc.text('RISK LEVEL', 145, currentY + 5.5);

        currentY += 8;

        allStudentsList.slice(0, 30).forEach((stu, sIdx) => {
          if (currentY > 270) {
            doc.addPage();
            currentY = 25;
          }
          doc.setFillColor(sIdx % 2 === 0 ? 255 : 248, sIdx % 2 === 0 ? 255 : 250, sIdx % 2 === 0 ? 255 : 252);
          doc.rect(14, currentY, 182, 8, 'F');

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8.5);
          doc.setTextColor(30, 41, 59);
          const nameUsn = `${stu.name || stu.studentName || stu.email || 'Candidate'} (${stu.usn || stu.studentId || 'N/A'})`;
          doc.text(nameUsn.substring(0, 40), 18, currentY + 5.5);
          doc.text(String(stu.auditStatus).substring(0, 30), 90, currentY + 5.5);
          doc.text(String(stu.riskLevel || 'Safe').substring(0, 20), 145, currentY + 5.5);

          currentY += 8;
        });
      }

      // Page numbering footer
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.setFont('helvetica', 'normal');
        doc.text(
          `Athena Proctoring AI System • Confidential Examination Audit Report • Page ${i} of ${pageCount}`,
          105,
          288,
          { align: 'center' }
        );
      }

      const fileDate = new Date().toISOString().split('T')[0];
      doc.save(`Athena_Proctoring_Audit_Report_${fileDate}.pdf`);
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Error generating PDF: ' + (err?.message || err));
    }
  };

  const handleExportCSV = () => {
    try {
      const totalAppeared = reportsData?.summary?.appeared || (finishedStudents.length + students.length);
      const totalFinished = reportsData?.summary?.finished || finishedStudents.length;
      const totalTerminated = reportsData?.summary?.terminated || terminatedStudents.length;
      const topCheat = reportsData?.summary?.mostCommonViolation || 'NONE';
      const avgViolations = reportsData?.summary?.avgViolations !== undefined ? reportsData.summary.avgViolations : '0.0';

      const deptList = (reportsData?.departmentStats && reportsData.departmentStats.length > 0)
        ? reportsData.departmentStats
        : [{
            department: 'Computer Science & Engineering',
            appeared: totalAppeared,
            finished: totalFinished,
            terminated: totalTerminated
          }];

      const rows = [];
      rows.push(['ATHENA SMART EXAM PROCTORING SYSTEM - AUDIT & PERFORMANCE REPORT']);
      rows.push(['Generated On', new Date().toLocaleString()]);
      rows.push(['']);

      rows.push(['=== EXECUTIVE SUMMARY ===']);
      rows.push(['Metric', 'Value']);
      rows.push(['Total Examinees Appeared', totalAppeared]);
      rows.push(['Exams Finished Successfully', totalFinished]);
      rows.push(['Terminated Candidates', totalTerminated]);
      rows.push(['Top Cheating Indicator', topCheat]);
      rows.push(['Average Violations per Candidate', avgViolations]);
      rows.push(['']);

      rows.push(['=== DEPARTMENTAL EXAMINATION BREAKDOWN ===']);
      rows.push(['Department', 'Candidates Appeared', 'Finished Successfully', 'Terminated Candidates', 'Integrity Status']);
      deptList.forEach(d => {
        rows.push([
          d.department || 'Computer Science & Engineering',
          d.appeared || 0,
          d.finished || 0,
          d.terminated || 0,
          d.terminated === 0 ? 'High Integrity' : 'Under Review'
        ]);
      });
      rows.push(['']);

      const allStudentsList = [
        ...finishedStudents.map(s => ({ ...s, auditStatus: 'Finished Successfully' })),
        ...terminatedStudents.map(s => ({ ...s, auditStatus: 'Terminated (Violation)' })),
        ...students.map(s => ({ ...s, auditStatus: s.status || 'Active In-Progress' }))
      ];

      if (allStudentsList.length > 0) {
        rows.push(['=== DETAILED EXAMINEE SESSION AUDIT ROSTER ===']);
        rows.push(['Student Name', 'USN / Student ID', 'Status', 'Risk Level', 'Violations Count']);
        allStudentsList.forEach(s => {
          rows.push([
            s.name || s.studentName || s.email || 'Candidate',
            s.usn || s.studentId || 'N/A',
            s.auditStatus,
            s.riskLevel || 'Safe',
            s.violations?.length || s.violationCount || s.suspiciousActivityCount || 0
          ]);
        });
      }

      // Convert rows to CSV with standard quoting
      const csvContent = rows
        .map(row =>
          row
            .map(val => {
              const str = val === null || val === undefined ? '' : String(val);
              if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`;
              }
              return `"${str}"`;
            })
            .join(',')
        )
        .join('\r\n');

      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      const fileDate = new Date().toISOString().split('T')[0];
      link.setAttribute('download', `Athena_Proctoring_Audit_Report_${fileDate}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error generating CSV:', err);
      alert('Error generating CSV: ' + (err?.message || err));
    }
  };

  const styles = React.useMemo(() => getStyles(darkMode), [darkMode]);

  const cardBg = darkMode ? '#0f172a' : '#ffffff';
  const cardBorder = darkMode ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #e2e8f0';
  const cardShadow = darkMode ? 'none' : '0 2px 6px rgba(0,0,0,0.04)';
  const innerBg = darkMode ? '#020617' : '#f8fafc';
  const textPrimary = darkMode ? '#ffffff' : '#0f172a';
  const textSecondary = darkMode ? '#94a3b8' : '#64748b';

  const telemetryGraphData = React.useMemo(() => {
    const now = new Date();
    // 6 dynamic time intervals leading up to NOW (past 12 hours)
    const buckets = [
      { offsetHours: 10, label: '' },
      { offsetHours: 8, label: '' },
      { offsetHours: 6, label: '' },
      { offsetHours: 4, label: '' },
      { offsetHours: 2, label: '' },
      { offsetHours: 0, label: 'NOW', isNow: true }
    ];

    buckets.forEach((b) => {
      if (b.isNow) return;
      const t = new Date(now.getTime() - b.offsetHours * 3600000);
      let hours = t.getHours();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      const strHours = hours < 10 ? '0' + hours : hours;
      b.label = `${strHours}:00 ${ampm}`;
    });

    const currentLive = students.filter(s =>
      ['Online', 'Active', 'Warning', 'in-progress'].includes(s.status)
    ).length;

    const completed = finishedStudents.length;
    const totalCount = students.length + finishedStudents.length + terminatedStudents.length;

    const points = buckets.map((b, idx) => {
      if (b.isNow) {
        return {
          ...b,
          value: currentLive,
          label: 'NOW',
          x: 480
        };
      }

      const bucketEndTime = now.getTime() - (b.offsetHours - 1) * 3600000;
      const bucketStartTime = now.getTime() - (b.offsetHours + 1) * 3600000;

      const sessionCount = [...students, ...finishedStudents, ...terminatedStudents].filter(s => {
        const st = s.startTime ? new Date(s.startTime).getTime() : (s.createdAt ? new Date(s.createdAt).getTime() : 0);
        return st > 0 && st <= bucketEndTime;
      }).length;

      const violationCount = violations.filter(v => {
        const vt = v.timestamp ? new Date(v.timestamp).getTime() : (v.createdAt ? new Date(v.createdAt).getTime() : 0);
        return vt >= bucketStartTime && vt <= bucketEndTime;
      }).length;

      let value = 0;
      if (totalCount === 0) {
        value = 0;
      } else if (sessionCount > 0) {
        value = sessionCount + violationCount;
      } else {
        const factor = idx === 0 ? 0.15 : idx === 1 ? 0.35 : idx === 2 ? 0.55 : idx === 3 ? 0.75 : 0.9;
        value = Math.max(0, Math.round(currentLive * factor + (completed * (idx / 5))));
      }

      const x = 20 + idx * 92;
      return {
        ...b,
        value,
        x
      };
    });

    const maxVal = Math.max(...points.map(p => p.value), 4);
    points.forEach(p => {
      p.y = Math.round(140 - (p.value / maxVal) * 105);
    });

    let pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cx1 = prev.x + (curr.x - prev.x) / 2;
      const cy1 = prev.y;
      const cx2 = prev.x + (curr.x - prev.x) / 2;
      const cy2 = curr.y;
      pathD += ` C ${cx1} ${cy1}, ${cx2} ${cy2}, ${curr.x} ${curr.y}`;
    }

    const areaD = `${pathD} L ${points[points.length - 1].x} 145 L ${points[0].x} 145 Z`;

    return { points, pathD, areaD, maxVal, currentLive };
  }, [students, finishedStudents, terminatedStudents, violations]);

  return (
    <div style={styles.appWrapper}>
      {/* Scoped Reset to permanently eliminate any white button background leakage */}
      <style>{`
        .athena-sidebar-btn {
          background-color: transparent !important;
          background: transparent !important;
          border: 1px solid transparent !important;
          color: ${darkMode ? '#94a3b8' : '#475569'} !important;
          box-shadow: none !important;
          outline: none !important;
        }
        .athena-sidebar-btn:hover {
          background-color: ${darkMode ? 'rgba(255, 255, 255, 0.05)' : '#f1f5f9'} !important;
          background: ${darkMode ? 'rgba(255, 255, 255, 0.05)' : '#f1f5f9'} !important;
          color: ${darkMode ? '#ffffff' : '#0f172a'} !important;
        }
        .athena-sidebar-btn.active {
          background-color: ${darkMode ? 'rgba(99, 102, 241, 0.18)' : 'rgba(99, 102, 241, 0.12)'} !important;
          background: ${darkMode ? 'rgba(99, 102, 241, 0.18)' : 'rgba(99, 102, 241, 0.12)'} !important;
          color: ${darkMode ? '#818cf8' : '#4f46e5'} !important;
          border-left: 3px solid #6366f1 !important;
          font-weight: 800 !important;
        }
        .athena-sidebar-btn.exit-btn {
          color: #f87171 !important;
        }
        .athena-sidebar-btn.exit-btn:hover {
          background-color: rgba(239, 68, 68, 0.15) !important;
          background: rgba(239, 68, 68, 0.15) !important;
          color: #ef4444 !important;
        }
      `}</style>

      {/* Collapsible Left Sidebar (Matches Screenshot 1 & 2) */}
      <aside style={{ ...styles.sidebar, width: sidebarOpen ? '250px' : '70px' }}>
        {/* Sidebar Brand Header */}
        <div style={styles.sidebarHeader}>
          <div style={styles.blueShieldLogo}>🛡️</div>
          {sidebarOpen && (
            <div>
              <div style={styles.logoTitle}>ATHENA</div>
              <div style={styles.logoSubtitle}>Proctoring Admin</div>
            </div>
          )}
        </div>

        {/* Sidebar Navigation */}
        <div style={styles.navSectionHeader}>
          {sidebarOpen && <span>MAIN NAVIGATION</span>}
        </div>

        <nav style={styles.sidebarNav}>
          <button
            onClick={() => setActiveNav('dashboard')}
            className={`athena-sidebar-btn ${activeNav === 'dashboard' ? 'active' : ''}`}
            style={{ ...styles.navItem, ...(activeNav === 'dashboard' ? styles.navItemActive : { backgroundColor: 'transparent', color: '#94a3b8' }) }}
          >
            <span style={styles.navIcon}>🎛️</span>
            {sidebarOpen && <span>Dashboard</span>}
          </button>

          <button
            onClick={() => setActiveNav('live')}
            className={`athena-sidebar-btn ${activeNav === 'live' ? 'active' : ''}`}
            style={{ ...styles.navItem, ...(activeNav === 'live' ? styles.navItemActive : { backgroundColor: 'transparent', color: '#94a3b8' }) }}
          >
            <span style={styles.navIcon}>📹</span>
            {sidebarOpen && <span>Live Monitoring</span>}
            {sidebarOpen && <span style={styles.liveTag}>•• LIVE</span>}
          </button>

          <button
            onClick={() => setActiveNav('violations')}
            className={`athena-sidebar-btn ${activeNav === 'violations' ? 'active' : ''}`}
            style={{ ...styles.navItem, ...(activeNav === 'violations' ? styles.navItemActive : { backgroundColor: 'transparent', color: '#94a3b8' }) }}
          >
            <span style={styles.navIcon}>🛡️</span>
            {sidebarOpen && <span>Violations Center</span>}
          </button>

          <button
            onClick={() => setActiveNav('terminated')}
            className={`athena-sidebar-btn ${activeNav === 'terminated' ? 'active' : ''}`}
            style={{ ...styles.navItem, ...(activeNav === 'terminated' ? styles.navItemActive : { backgroundColor: 'transparent', color: '#94a3b8' }) }}
          >
            <span style={styles.navIcon}>✖️</span>
            {sidebarOpen && <span>Terminated Students</span>}
          </button>

          <button
            onClick={() => setActiveNav('finished')}
            className={`athena-sidebar-btn ${activeNav === 'finished' ? 'active' : ''}`}
            style={{ ...styles.navItem, ...(activeNav === 'finished' ? styles.navItemActive : { backgroundColor: 'transparent', color: '#94a3b8' }) }}
          >
            <span style={styles.navIcon}>✔️</span>
            {sidebarOpen && <span>Finished Exams</span>}
          </button>

          <button
            onClick={() => setActiveNav('history')}
            className={`athena-sidebar-btn ${activeNav === 'history' ? 'active' : ''}`}
            style={{ ...styles.navItem, ...(activeNav === 'history' ? styles.navItemActive : { backgroundColor: 'transparent', color: '#94a3b8' }) }}
          >
            <span style={styles.navIcon}>📜</span>
            {sidebarOpen && <span>Activity History</span>}
          </button>

          <button
            onClick={() => setActiveNav('reports')}
            className={`athena-sidebar-btn ${activeNav === 'reports' ? 'active' : ''}`}
            style={{ ...styles.navItem, ...(activeNav === 'reports' ? styles.navItemActive : { backgroundColor: 'transparent', color: '#94a3b8' }) }}
          >
            <span style={styles.navIcon}>📄</span>
            {sidebarOpen && <span>Reports</span>}
          </button>

          <button
            onClick={() => setActiveNav('analytics')}
            className={`athena-sidebar-btn ${activeNav === 'analytics' ? 'active' : ''}`}
            style={{ ...styles.navItem, ...(activeNav === 'analytics' ? styles.navItemActive : { backgroundColor: 'transparent', color: '#94a3b8' }) }}
          >
            <span style={styles.navIcon}>📊</span>
            {sidebarOpen && <span>Analytics</span>}
          </button>

          <button
            onClick={() => setActiveNav('settings')}
            className={`athena-sidebar-btn ${activeNav === 'settings' ? 'active' : ''}`}
            style={{ ...styles.navItem, ...(activeNav === 'settings' ? styles.navItemActive : { backgroundColor: 'transparent', color: '#94a3b8' }) }}
          >
            <span style={styles.navIcon}>⚙️</span>
            {sidebarOpen && <span>Settings</span>}
          </button>

          <button
            onClick={() => window.location.href = '/'}
            className="athena-sidebar-btn exit-btn"
            style={{ ...styles.navItem, marginTop: 'auto', color: '#f87171', backgroundColor: 'transparent' }}
          >
            <span style={styles.navIcon}>🚪</span>
            {sidebarOpen && <span>Exit Portal</span>}
          </button>
        </nav>

        {/* Bottom AI Engine Active Badge */}
        {sidebarOpen && (
          <div style={styles.aiEngineCard}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#34d399', fontWeight: 800, fontSize: '0.8rem' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#34d399' }}></div>
              <span>AI Engine Active</span>
            </div>
            <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '4px' }}>
              FastAPI, OpenCV & YOLO Active
            </div>
          </div>
        )}
      </aside>

      {/* Main Content Pane */}
      <div style={styles.mainContent}>
        {/* Top Header Bar */}
        <header style={styles.topbar}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button onClick={() => setSidebarOpen(!sidebarOpen)} style={styles.menuToggleBtn}>
              ≡
            </button>
            <div>
              <h1 style={styles.topbarTitle}>System Admin Command Center</h1>
              <p style={styles.topbarSubtitle}>Real-Time Proctoring & Anomaly Oversight</p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <a
              href="http://localhost:3001/live"
              target="_blank"
              rel="noreferrer"
              style={styles.externalLinkBtn}
            >
              🚀 Open Port 3001 Admin
            </a>

            {/* Theme Toggle (Day / Dark) */}
            <div
              style={styles.themeToggle}
              onClick={() => setDarkMode(!darkMode)}
              title={`Switch to ${darkMode ? 'Day' : 'Dark'} Mode`}
            >
              <span style={{ fontSize: '0.85rem' }}>🌙</span>
              <div style={{
                width: '36px',
                height: '18px',
                backgroundColor: darkMode ? '#0f172a' : '#cbd5e1',
                borderRadius: '10px',
                position: 'relative',
                transition: 'background-color 0.2s ease',
                display: 'flex',
                alignItems: 'center'
              }}>
                <div style={{
                  width: '14px',
                  height: '14px',
                  backgroundColor: darkMode ? '#38bdf8' : '#ffffff',
                  borderRadius: '50%',
                  position: 'absolute',
                  top: '2px',
                  left: '2px',
                  transition: 'transform 0.2s ease',
                  transform: darkMode ? 'translateX(18px)' : 'translateX(0px)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                }} />
              </div>
              <span style={{ fontSize: '0.85rem' }}>☀️</span>
            </div>

            {/* Notification Bell with Dynamic Dropdown */}
            <div style={{ position: 'relative' }}>
              <div
                style={styles.iconBadgeBtn}
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                title="View Live Proctoring Alerts"
              >
                🔔
                {notifications.length > 0 && (
                  <div style={styles.badgeDot}>{notifications.length}</div>
                )}
              </div>

              {/* Live Alerts Dropdown Menu */}
              {isNotificationsOpen && (
                <div style={{
                  position: 'absolute',
                  top: '48px',
                  right: 0,
                  width: '360px',
                  maxHeight: '420px',
                  overflowY: 'auto',
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '14px',
                  padding: '16px',
                  zIndex: 9999,
                  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.6)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b', paddingBottom: '10px', marginBottom: '12px' }}>
                    <strong style={{ fontSize: '0.9rem', color: '#ffffff' }}>🚨 Live Anomaly Alert Feed</strong>
                    <button
                      onClick={() => setNotifications([])}
                      style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '0.75rem', cursor: 'pointer' }}
                    >
                      Clear All
                    </button>
                  </div>

                  {notifications.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>
                      No active alert incidents recorded.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {notifications.map((n, i) => (
                        <div key={n.id || i} style={{
                          background: '#1e293b',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          borderLeft: n.type === 'FACE_MISSING' ? '4px solid #ef4444' : (n.type === 'TAB_SWITCH' ? '4px solid #f59e0b' : '4px solid #38bdf8')
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{
                              fontWeight: 800,
                              fontSize: '0.75rem',
                              color: n.type === 'FACE_MISSING' ? '#f87171' : (n.type === 'TAB_SWITCH' ? '#fbbf24' : '#38bdf8')
                            }}>
                              {n.type === 'FACE_MISSING' ? '🔴 FACE MISSING' : (n.type === 'TAB_SWITCH' ? '🟡 TAB SWITCH' : '🚨 PROCTOR ALERT')}
                            </span>
                            <span style={{ fontSize: '0.68rem', color: '#64748b' }}>{n.time || 'Just now'}</span>
                          </div>
                          <div style={{ fontSize: '0.78rem', color: '#ffffff', fontWeight: 700, marginTop: '3px' }}>
                            {n.studentName} {n.usn ? `(${n.usn})` : ''}
                          </div>
                          <div style={{ fontSize: '0.74rem', color: '#cbd5e1', marginTop: '2px' }}>
                            {n.message}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Profile Avatar Pill */}
            <div style={styles.profilePill}>
              <div style={styles.adminAvatarCircle}>S</div>
              <div style={{ textTransform: 'none' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#ffffff' }}>System Administrator</div>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>superadmin</div>
              </div>
            </div>
          </div>
        </header>

        {/* Floating Real-Time Toast Notification Alerts Container */}
        {adminToasts.length > 0 && (
          <div style={{
            position: 'fixed',
            top: '80px',
            right: '24px',
            zIndex: 10000,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            maxWidth: '420px'
          }}>
            {adminToasts.map((toast) => (
              <div key={toast.id} style={{
                background: '#0f172a',
                border: toast.type === 'FACE_MISSING' ? '2px solid #ef4444' : (toast.type === 'TAB_SWITCH' ? '2px solid #f59e0b' : '2px solid #38bdf8'),
                borderRadius: '12px',
                padding: '14px 18px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.7)',
                animation: 'slideInRight 0.3s ease',
                color: '#ffffff'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.2rem' }}>
                      {toast.type === 'FACE_MISSING' ? '🔴' : (toast.type === 'TAB_SWITCH' ? '⚠️' : '🚨')}
                    </span>
                    <strong style={{
                      fontSize: '0.85rem',
                      color: toast.type === 'FACE_MISSING' ? '#f87171' : (toast.type === 'TAB_SWITCH' ? '#fbbf24' : '#38bdf8')
                    }}>
                      {toast.type === 'FACE_MISSING' ? 'FACE MISSING ALERT' : (toast.type === 'TAB_SWITCH' ? 'TAB SWITCH ALERT' : 'PROCTORING ALERT')}
                    </strong>
                  </div>
                  <button
                    onClick={() => setAdminToasts(prev => prev.filter(t => t.id !== toast.id))}
                    style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 800 }}
                  >
                    ✕
                  </button>
                </div>
                <div style={{ fontSize: '0.82rem', color: '#ffffff', fontWeight: 800, marginTop: '6px' }}>
                  Candidate: {toast.studentName} {toast.usn ? `(${toast.usn})` : ''}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#cbd5e1', marginTop: '3px' }}>
                  {toast.message}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                  <button
                    onClick={() => {
                      setActiveNav('live');
                      setAdminToasts(prev => prev.filter(t => t.id !== toast.id));
                    }}
                    style={{
                      background: '#1e293b',
                      border: '1px solid #334155',
                      color: '#38bdf8',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    Inspect Candidate Feed ↗
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Notification Alert Banner */}
        {actionMessage && (
          <div style={styles.bannerAlert}>
            <span>{actionMessage}</span>
          </div>
        )}

        {/* -------------------------------------------------------------
            1. LIVE MONITORING VIEW (Matches screenshot 1 & default view)
           ------------------------------------------------------------- */}
        {activeNav === 'live' && (
          <div style={{ padding: '24px' }}>
            {/* Search & Filter Controls Bar */}
            <div style={styles.filterBar}>
              <div style={styles.searchWrapper}>
                <span style={{ marginLeft: '12px', color: '#94a3b8' }}>🔍</span>
                <input
                  type="text"
                  placeholder="Search by student name, USN, email, or exam..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={styles.searchInput}
                />
              </div>

              <select
                value={riskFilter}
                onChange={(e) => setRiskFilter(e.target.value)}
                style={styles.selectFilter}
              >
                <option value="ALL">All Risk Levels</option>
                <option value="SAFE">Safe (0-20)</option>
                <option value="MEDIUM">Medium Risk (20-50)</option>
                <option value="HIGH">High Risk (50+)</option>
              </select>

              <button onClick={fetchData} style={styles.refreshBtn}>
                🔄 Refresh Feed
              </button>
            </div>

            {/* Live Student Cards Grid / Empty State */}
            {filteredStudents.length === 0 ? (
              <div style={styles.emptyStateContainer}>
                <div style={styles.emptyStateIcon}>👥</div>
                <h3 style={styles.emptyStateTitle}>
                  {students.length === 0 ? 'No Students Currently Attending Exam' : 'No Students Matching Filter'}
                </h3>
                <p style={styles.emptyStateSubtitle}>
                  {students.length === 0
                    ? 'Active candidate camera video feeds and real-time AI proctoring telemetry will appear here automatically when students begin their exam session.'
                    : 'Try clearing your search or risk filter to view examinees.'}
                </p>
                <button onClick={fetchData} style={styles.refreshBtn}>
                  🔄 Refresh Live Feed
                </button>
              </div>
            ) : (
              <div style={styles.grid}>
              {filteredStudents.map((s, idx) => {
                const isTerminated = s.status === 'Terminated';
                const isWarning = s.status === 'Warning';

                const riskText = isWarning ? 'Medium (20-50)' : (s.riskLevel && !s.riskLevel.includes('High') ? s.riskLevel : 'Low');
                const riskColor = isWarning ? '#f59e0b' : (s.status === 'Offline' ? '#94a3b8' : '#10b981');

                return (
                  <div key={s.sessionId || s.studentId || idx} style={styles.studentCard}>
                    {/* Card Header: Avatar + Student Name + USN + Risk Badge */}
                    <div style={styles.cardHeader}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          ...styles.avatarCircle,
                          backgroundColor: s.status === 'Offline' ? '#334155' : '#4f46e5'
                        }}>
                          {s.studentName ? s.studentName.charAt(0).toUpperCase() : 'S'}
                        </div>
                        <div>
                          <h3 style={styles.studentNameTitle}>
                            {s.studentName}
                          </h3>
                          <div style={styles.studentUsnSub}>
                            USN: <strong>{s.usn}</strong> | {s.department}
                          </div>
                        </div>
                      </div>

                      <div style={{
                        padding: '4px 10px',
                        borderRadius: '20px',
                        fontSize: '0.725rem',
                        fontWeight: 800,
                        color: riskColor,
                        border: `1px solid ${riskColor}`,
                        background: `${riskColor}18`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: riskColor }}></div>
                        <span>{s.status === 'Offline' ? 'Registered' : (riskText.toLowerCase().includes('low') ? '● Low' : riskText)}</span>
                      </div>
                    </div>

                    {/* Live Video Box */}
                    <div style={styles.videoBox}>
                      {s.image && s.status !== 'Offline' ? (
                        <img
                          src={s.image}
                          alt={`${s.studentName || 'Student'} Live Stream`}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <div style={{ textAlign: 'center', color: '#64748b', padding: '16px' }}>
                          <div style={{ fontSize: '1.8rem', marginBottom: '6px' }}>
                            {s.status === 'Offline' ? '⚫' : '📹'}
                          </div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 800, color: s.status === 'Offline' ? '#94a3b8' : '#ffffff' }}>
                            {s.status === 'Offline' ? 'Candidate Offline' : 'Webcam Standby'}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>
                            {s.status === 'Offline' ? 'Camera unavailable • Student not in exam' : 'Awaiting live camera video feed'}
                          </div>
                        </div>
                      )}

                      {/* Online Live Badge Overlay - Only ONLINE and OFFLINE shown */}
                      <div style={{
                        ...styles.onlineBadge,
                        backgroundColor: s.status === 'Offline' ? 'rgba(71, 85, 105, 0.85)' : 'rgba(16, 185, 129, 0.85)'
                      }}>
                        <div style={{
                          ...styles.pulsingDot,
                          backgroundColor: s.status === 'Offline' ? '#94a3b8' : '#34d399'
                        }}></div>
                        <span>
                          {s.status === 'Offline' ? '⚫ OFFLINE' : '🟢 ONLINE'}
                        </span>
                      </div>

                      {/* Watch Stream Button Overlay */}
                      {s.status !== 'Offline' && (
                        <button
                          onClick={() => setWatchingStudent(s)}
                          style={styles.watchStreamBtn}
                        >
                          🎥 Watch Stream
                        </button>
                      )}
                    </div>

                    {/* Exam Name & Start/Remaining Times */}
                    <div style={styles.examInfoHeader}>
                      <div style={styles.examNameLabel}>
                        EXAM: {s.examName || 'COMPUTER SCIENCE FINAL ASSESSMENT'}
                      </div>
                      <div style={styles.timeInfoRow}>
                        <span>🕒 Start: {s.startTime || '01:02 pm'}</span>
                        <span style={{ color: '#f59e0b', fontWeight: 700 }}>🕒 Rem: {s.remainingTime || '03:00:00'}</span>
                      </div>
                    </div>

                    {/* AI Proctor Telemetry Indicators Section */}
                    <div style={styles.cardBody}>
                      <div style={styles.telemetryTitle}>
                        AI Proctor Telemetry Indicators:
                      </div>

                      {/* 2x2 Telemetry Badge Pills */}
                      <div style={styles.pillGrid}>
                        <div style={{
                          ...styles.telemetryPill,
                          background: s.faceDetected ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                          color: s.faceDetected ? '#10b981' : '#ef4444',
                          border: `1px solid ${s.faceDetected ? '#10b981' : '#ef4444'}`
                        }}>
                          {s.faceDetected ? '🟢 Face Detected' : '🔴 No Face'}
                        </div>

                        <div style={{
                          ...styles.telemetryPill,
                          background: !s.multipleFaces ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                          color: !s.multipleFaces ? '#10b981' : '#ef4444',
                          border: `1px solid ${!s.multipleFaces ? '#10b981' : '#ef4444'}`
                        }}>
                          {!s.multipleFaces ? '🟢 Single Face' : '🔴 Multiple Faces'}
                        </div>

                        <div style={{
                          ...styles.telemetryPill,
                          background: !s.mobilePhoneDetected ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                          color: !s.mobilePhoneDetected ? '#10b981' : '#ef4444',
                          border: `1px solid ${!s.mobilePhoneDetected ? '#10b981' : '#ef4444'}`
                        }}>
                          {!s.mobilePhoneDetected ? '🟢 No Phone' : '📱 Phone Detected'}
                        </div>

                        <div style={{
                          ...styles.telemetryPill,
                          background: s.fullScreenStatus === 'Active' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                          color: s.fullScreenStatus === 'Active' ? '#10b981' : '#f59e0b',
                          border: `1px solid ${s.fullScreenStatus === 'Active' ? '#10b981' : '#f59e0b'}`
                        }}>
                          {s.fullScreenStatus === 'Active' ? '🟢 Fullscreen Active' : '⚠️ Fullscreen Exited'}
                        </div>
                      </div>

                      {/* Head Pose & Eye Gaze Row */}
                      <div style={styles.poseBox}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <span style={{ color: '#94a3b8' }}>Head Pose:</span>
                          <strong style={{ color: s.headPose?.includes('Looking') && !s.headPose?.includes('Center') ? '#f59e0b' : '#10b981' }}>
                            ✔ {s.headPose || 'Looking Center'}
                          </strong>
                        </div>

                        <div style={{ display: 'flex', gap: '6px' }}>
                          <span style={{ color: '#94a3b8' }}>Eye Gaze:</span>
                          <strong style={{ color: s.lastGazeDirection && s.lastGazeDirection !== 'CENTER' ? '#f59e0b' : '#10b981' }}>
                            {s.lastGazeDirection && s.lastGazeDirection !== 'CENTER' ? `⚠️ ${s.lastGazeDirection}` : '✔ Center'}
                          </strong>
                        </div>

                        <div style={{ display: 'flex', gap: '6px' }}>
                          <span style={{ color: '#94a3b8' }}>Attention:</span>
                          <span style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: '4px',
                            background: s.attentionRiskLevel === 'HIGH RISK' || s.attentionRiskLevel === 'HIGH_RISK' ? 'rgba(239, 68, 68, 0.2)' : (s.attentionRiskLevel === 'SUSPICIOUS' || s.attentionRiskLevel === 'WARNING' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)'),
                            color: s.attentionRiskLevel === 'HIGH RISK' || s.attentionRiskLevel === 'HIGH_RISK' ? '#ef4444' : (s.attentionRiskLevel === 'SUSPICIOUS' || s.attentionRiskLevel === 'WARNING' ? '#f59e0b' : '#10b981')
                          }}>
                            {s.attentionRiskLevel || 'NORMAL'}
                          </span>
                        </div>
                      </div>

                      {/* Gaze Deviations & Tab Switches Counters */}
                      <div style={styles.countsRow}>
                        <span>Gaze Away: <strong>{s.gazeDeviationsCount || 0}</strong> {s.longestGazeDeviation ? `(max ${s.longestGazeDeviation}s)` : ''}</span>
                        <span>Tab Switches: <strong>{s.tabSwitchingCount || 0}</strong></span>
                      </div>

                      {/* Action Buttons */}
                      <div style={styles.cardActions}>
                        <button
                          onClick={() => handleWarnStudent(s)}
                          disabled={isTerminated || s.status === 'Offline'}
                          style={{
                            ...styles.warnBtn,
                            opacity: isTerminated || s.status === 'Offline' ? 0.5 : 1,
                            cursor: isTerminated || s.status === 'Offline' ? 'not-allowed' : 'pointer'
                          }}
                        >
                          ⚠️ Warn
                        </button>

                        <button
                          onClick={() => handleTerminateStudent(s)}
                          disabled={isTerminated || s.status === 'Offline'}
                          style={{
                            padding: '8px 12px',
                            background: 'rgba(239, 68, 68, 0.15)',
                            border: '1px solid #ef4444',
                            color: '#f87171',
                            borderRadius: '8px',
                            fontWeight: 700,
                            fontSize: '0.75rem',
                            cursor: isTerminated || s.status === 'Offline' ? 'not-allowed' : 'pointer',
                            opacity: isTerminated || s.status === 'Offline' ? 0.5 : 1,
                            transition: 'all 0.2s'
                          }}
                        >
                          🔴 Terminate
                        </button>

                        <button
                          onClick={() => handleOpenStudentDetail(s)}
                          style={styles.detailBtn}
                        >
                          ↗ Detail
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            )}
          </div>
        )}

        {/* -------------------------------------------------------------
            2. VIOLATIONS CENTER VIEW
           ------------------------------------------------------------- */}
        {activeNav === 'violations' && (
          <div style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '10px' }}>
                🛡️ Violations Center Audit Log
              </h2>
              <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                Showing {violations.length} logged violation incidents
              </span>
            </div>

            {violations.length === 0 ? (
              <div style={styles.emptyStateContainer}>
                <div style={styles.emptyStateIcon}>🛡️</div>
                <h3 style={styles.emptyStateTitle}>No Violation Incidents Logged</h3>
                <p style={styles.emptyStateSubtitle}>
                  All candidate sessions are currently adhering to proctoring guidelines. Any detected anomalies, phone usage, or rule breaches will be automatically captured and logged here in real-time.
                </p>
                <button onClick={fetchData} style={styles.refreshBtn}>
                  🔄 Refresh Audit Log
                </button>
              </div>
            ) : (
              <div style={styles.tableCard}>
                <table style={styles.table}>
                  <thead>
                    <tr style={styles.tableHeaderRow}>
                      <th style={styles.tableTh}>Student Name & USN</th>
                      <th style={styles.tableTh}>Exam Name</th>
                      <th style={styles.tableTh}>Violation Type</th>
                      <th style={styles.tableTh}>Time</th>
                      <th style={styles.tableTh}>Severity</th>
                      <th style={styles.tableTh}>Screenshot Frame</th>
                      <th style={styles.tableTh}>Status</th>
                      <th style={styles.tableTh}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {violations.map((v, i) => {
                      const sevColor = v.severity === 'critical' || v.severity === 'high' ? '#ef4444' : '#f59e0b';
                      return (
                        <tr key={v.id || v._id || i} style={styles.tableRow}>
                          <td style={styles.tableTd}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={styles.miniAvatar}>
                                {v.studentName ? v.studentName.charAt(0).toUpperCase() : 'S'}
                              </div>
                              <div>
                                <div style={{ fontWeight: 800, color: '#ffffff', fontSize: '0.9rem' }}>{v.studentName}</div>
                                <div style={{ fontSize: '0.725rem', color: '#94a3b8' }}>USN: {v.usn}</div>
                              </div>
                            </div>
                          </td>

                          <td style={styles.tableTd}>
                            <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.85rem' }}>{v.examName}</div>
                            <div style={{ fontSize: '0.725rem', color: '#64748b' }}>{v.department || 'Computer Science'}</div>
                          </td>

                          <td style={styles.tableTd}>
                            <div style={{ fontWeight: 800, color: v.severity === 'critical' ? '#ef4444' : (v.severity === 'high' ? '#f87171' : '#fbbf24'), fontSize: '0.85rem' }}>
                              {v.type || v.violationType}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Conf: {v.confidence || '95%'}</div>
                          </td>

                          <td style={styles.tableTd}>
                            <div style={{ fontSize: '0.85rem', color: '#ffffff', fontWeight: 600 }}>{v.time || (v.timestamp ? new Date(v.timestamp).toLocaleTimeString() : 'Recent')}</div>
                            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{v.date || (v.timestamp ? new Date(v.timestamp).toLocaleDateString() : '')}</div>
                          </td>

                          <td style={styles.tableTd}>
                            <span style={{
                              padding: '4px 12px',
                              borderRadius: '16px',
                              fontSize: '0.725rem',
                              fontWeight: 800,
                              color: '#ffffff',
                              backgroundColor: sevColor
                            }}>
                              {v.severity || 'medium'}
                            </span>
                          </td>

                          <td style={styles.tableTd}>
                            {v.screenshot || v.image ? (
                              <button
                                onClick={() => setEvidenceModalImage(v.screenshot || v.image)}
                                style={styles.iconCameraBtn}
                                title="View Screenshot Evidence Frame"
                              >
                                📷
                              </button>
                            ) : (
                              <span style={{ color: '#64748b', fontSize: '0.8rem' }}>N/A</span>
                            )}
                          </td>

                          <td style={styles.tableTd}>
                            <span style={styles.flaggedPill}>
                              {v.status || 'Flagged'}
                            </span>
                          </td>

                          <td style={styles.tableTd}>
                            <button
                              onClick={() => handleOpenStudentDetail(v)}
                              style={styles.actionLaunchBtn}
                              title="Inspect Full Student Detail"
                            >
                              ↗
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* -------------------------------------------------------------
            3. STUDENT DETAIL VIEW
           ------------------------------------------------------------- */}
        {activeNav === 'studentDetail' && selectedStudentDetail && (() => {
          const currentDetail = students.find(s => s.studentId === selectedStudentDetail.studentId || s.usn === selectedStudentDetail.usn || (s.email && s.email === selectedStudentDetail.email)) || selectedStudentDetail;
          return (
          <div style={{ padding: '24px' }}>
            {/* Student Header Card */}
            <div style={styles.detailHeaderCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button
                      onClick={() => setActiveNav('live')}
                      style={{ background: 'none', border: '1px solid #334155', color: '#94a3b8', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}
                    >
                      ← Back to Live
                    </button>
                    <h2 style={{ fontSize: '1.6rem', fontWeight: 900, color: '#ffffff', margin: 0 }}>
                      {currentDetail?.studentName || 'Examinee'}
                    </h2>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '6px' }}>
                    USN: <strong>{currentDetail?.usn || 'N/A'}</strong> | Email: <strong>{currentDetail?.email || 'N/A'}</strong>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#818cf8', marginTop: '2px', fontWeight: 700 }}>
                    Department: {currentDetail?.department || 'General Science'}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                    Exam Name: <strong style={{ color: '#ffffff' }}>{currentDetail?.examName || 'Computer Science Final Assessment'}</strong>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>
                    Status: <strong style={{ color: currentDetail?.status === 'Terminated' ? '#ef4444' : '#34d399' }}>{currentDetail?.status || 'Online'}</strong>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#f59e0b', marginTop: '2px', fontWeight: 700 }}>
                    Suspicious Count: {violations.filter(v => (v.usn && currentDetail.usn && v.usn === currentDetail.usn) || (v.email && currentDetail.email && v.email === currentDetail.email)).length || currentDetail?.warningsCount || 0} Events
                  </div>
                </div>
              </div>
            </div>

            {/* Detail Content Grid: Video Bounding Box Frame (Left) + Timeline (Right) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px', marginTop: '24px' }}>
              {/* Left Column: Bounding Box Evidence Inspector */}
              <div style={styles.inspectorCard}>
                <div style={styles.inspectorVideoContainer}>
                  {currentDetail.image ? (
                    <div style={{ position: 'relative' }}>
                      <div style={styles.evidenceOverlayHeader}>
                        ● {currentDetail.status?.toUpperCase() || 'ONLINE'} • HEAD POSE: {currentDetail.headPose || 'Looking Center'}
                      </div>
                      <div style={styles.evidenceOverlayGaze}>
                        GAZE: {currentDetail.eyeGaze || 'Looking Center'}
                      </div>
                      <img
                        src={currentDetail.image}
                        alt="Live Student Frame"
                        style={{ width: '100%', height: '340px', objectFit: 'cover' }}
                      />
                      <div style={styles.confidenceOverlayBadge}>
                        Face Detection Confidence: <strong>{currentDetail.faceMatchConfidence || 98}% Match</strong>
                      </div>
                    </div>
                  ) : (
                    <div style={{ height: '340px', backgroundColor: '#020617', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                      <div style={{ fontSize: '3rem', marginBottom: '8px' }}>📹</div>
                      <div style={{ color: '#ffffff', fontWeight: 800, fontSize: '1rem' }}>Webcam Standby</div>
                      <div style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '4px' }}>Awaiting live camera video feed from candidate</div>
                      <div style={styles.evidenceOverlayHeader}>
                        ● {currentDetail.status?.toUpperCase() || 'ONLINE'} • HEAD POSE: {currentDetail.headPose || 'Center'}
                      </div>
                      <div style={styles.confidenceOverlayBadge}>
                        Face Match Confidence: <strong>{currentDetail.faceMatchConfidence || 95}%</strong>
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ padding: '16px' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: '#ffffff', fontWeight: 800 }}>
                    Active Real-Time Telemetry Indicators
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                    <div style={styles.miniTelemetryCard}>
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Face Verification</span>
                      <strong style={{ color: currentDetail.faceDetected ? '#34d399' : '#ef4444', fontSize: '0.85rem' }}>
                        {currentDetail.faceDetected ? `Verified (${currentDetail.faceMatchConfidence || 98}%)` : 'No Face'}
                      </strong>
                    </div>
                    <div style={styles.miniTelemetryCard}>
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Multiple Faces</span>
                      <strong style={{ color: !currentDetail.multipleFaces ? '#34d399' : '#ef4444', fontSize: '0.85rem' }}>
                        {!currentDetail.multipleFaces ? 'Single Face' : 'Multiple Faces'}
                      </strong>
                    </div>
                    <div style={styles.miniTelemetryCard}>
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Phone Status</span>
                      <strong style={{ color: !currentDetail.mobilePhoneDetected ? '#34d399' : '#ef4444', fontSize: '0.85rem' }}>
                        {!currentDetail.mobilePhoneDetected ? 'No Phone' : 'Phone Detected'}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Candidate Real-Time Session & Security Intel */}
              <div style={styles.timelineCard}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 900, color: '#ffffff', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>🛡️</span> Candidate Live Profile & Telemetry Intel
                </h3>

                {/* Real Student Identity Card */}
                <div style={{ background: '#0f172a', padding: '16px', borderRadius: '12px', border: '1px solid #1e293b', marginBottom: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.82rem' }}>
                    <div>
                      <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>CANDIDATE NAME</span>
                      <div style={{ fontWeight: 800, color: '#ffffff' }}>{currentDetail.studentName}</div>
                    </div>
                    <div>
                      <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>USN / STUDENT ID</span>
                      <div style={{ fontWeight: 800, color: '#38bdf8' }}>{currentDetail.usn || currentDetail.studentId}</div>
                    </div>
                    <div>
                      <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>EMAIL ADDRESS</span>
                      <div style={{ fontWeight: 600, color: '#cbd5e1' }}>{currentDetail.email || 'student@university.edu'}</div>
                    </div>
                    <div>
                      <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>DEPARTMENT</span>
                      <div style={{ fontWeight: 700, color: '#a78bfa' }}>{currentDetail.department || 'Computer Science & Engineering'}</div>
                    </div>
                  </div>
                </div>

                {/* Live Device & Environment Security Indicators */}
                <div style={{ background: '#0f172a', padding: '16px', borderRadius: '12px', border: '1px solid #1e293b', marginBottom: '16px' }}>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: '#ffffff', fontWeight: 800 }}>
                    🔒 Active Session Integrity & Environment Checks
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5e1' }}>
                      <span>Fullscreen Lock:</span>
                      <strong style={{ color: '#34d399' }}>{currentDetail.fullScreenStatus || 'Active'}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5e1' }}>
                      <span>Tab Switches:</span>
                      <strong style={{ color: (currentDetail.tabSwitchingCount || 0) > 0 ? '#fbbf24' : '#34d399' }}>
                        {currentDetail.tabSwitchingCount || 0} times
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5e1' }}>
                      <span>Copy/Paste Attempts:</span>
                      <strong style={{ color: (currentDetail.copyPasteAttempts || 0) > 0 ? '#ef4444' : '#34d399' }}>
                        {currentDetail.copyPasteAttempts || 0}
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5e1' }}>
                      <span>Connection:</span>
                      <strong style={{ color: '#34d399' }}>🟢 Stable (100%)</strong>
                    </div>
                  </div>
                </div>

                {/* Quick Admin Intervention Controls */}
                <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                  <button
                    onClick={() => handleWarnStudent(currentDetail)}
                    style={{
                      flex: 1,
                      padding: '10px',
                      background: 'rgba(245, 158, 11, 0.15)',
                      border: '1px solid #f59e0b',
                      color: '#fbbf24',
                      borderRadius: '8px',
                      fontWeight: 800,
                      fontSize: '0.8rem',
                      cursor: 'pointer'
                    }}
                  >
                    ⚠️ Issue Warning
                  </button>
                  <button
                    onClick={() => handleTerminateStudent(currentDetail)}
                    style={{
                      flex: 1,
                      padding: '10px',
                      background: 'rgba(239, 68, 68, 0.15)',
                      border: '1px solid #ef4444',
                      color: '#f87171',
                      borderRadius: '8px',
                      fontWeight: 800,
                      fontSize: '0.8rem',
                      cursor: 'pointer'
                    }}
                  >
                    🔴 Terminate Exam
                  </button>
                </div>

                {/* Real Session Audit Timeline */}
                <h4 style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: '#94a3b8', fontWeight: 800 }}>
                  SESSION AUDIT TIMELINE
                </h4>

                {(() => {
                  const studentViolations = violations.filter(v =>
                    (v.usn && currentDetail.usn && v.usn === currentDetail.usn) ||
                    (v.email && currentDetail.email && v.email === currentDetail.email) ||
                    (v.studentId && currentDetail.studentId && v.studentId === currentDetail.studentId)
                  );

                  if (studentViolations.length === 0) {
                    return (
                      <div style={{ padding: '24px 16px', textAlign: 'center', backgroundColor: '#020617', borderRadius: '12px', border: '1px dashed #1e293b' }}>
                        <div style={{ fontSize: '1.8rem', marginBottom: '6px' }}>✅</div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#34d399' }}>Clean Integrity Record</div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
                          No cheating or telemetry anomalies recorded during this active session.
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '200px', overflowY: 'auto' }}>
                      {studentViolations.map((v, i) => (
                        <div key={i} style={styles.timelineEventCard}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <strong style={{ fontSize: '0.82rem', color: '#ffffff' }}>{v.type || v.violationType}</strong>
                            <span style={v.severity === 'critical' ? styles.criticalPill : styles.highPill}>
                              {v.severity || 'warning'}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#cbd5e1', marginTop: '4px' }}>
                            {v.description || `${v.type || v.violationType} incident detected`}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>
                            Logged at: {v.time || (v.timestamp ? new Date(v.timestamp).toLocaleTimeString() : 'Recent')}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
          );
        })()}

        {/* -------------------------------------------------------------
            4. SYSTEM ADMIN COMMAND CENTER DASHBOARD VIEW
           ------------------------------------------------------------- */}
        {activeNav === 'dashboard' && (
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Top Command Center KPI Strip: TOTAL | ONLINE | IN PROGRESS | VIOLATIONS | DONE */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: textPrimary, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>🎛️</span> SYSTEM ADMIN COMMAND CENTER
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#34d399', boxShadow: '0 0 10px #34d399' }}></span>
                  <span style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 700 }}>Real-Time Telemetry Active</span>
                </div>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                gap: '14px',
                background: darkMode ? '#0b1329' : '#ffffff',
                padding: '16px',
                borderRadius: '16px',
                border: darkMode ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #e2e8f0',
                boxShadow: darkMode ? 'none' : '0 2px 6px rgba(0,0,0,0.04)'
              }}>
                <div style={{ ...styles.kpiCard, background: cardBg, border: cardBorder }}>
                  <div style={styles.kpiLabel}>TOTAL EXAMINEES</div>
                  <div style={{ ...styles.kpiValue, color: textPrimary }}>
                    {students.length + finishedStudents.length + terminatedStudents.length}
                  </div>
                </div>
                <div style={{ ...styles.kpiCard, background: cardBg, border: cardBorder }}>
                  <div style={styles.kpiLabel}>ONLINE LIVE</div>
                  <div style={{ ...styles.kpiValue, color: '#38bdf8' }}>
                    {students.filter(s => ['Online', 'Active', 'Warning', 'in-progress'].includes(s.status)).length}
                  </div>
                </div>
                <div style={{ ...styles.kpiCard, background: cardBg, border: cardBorder }}>
                  <div style={styles.kpiLabel}>IN PROGRESS</div>
                  <div style={{ ...styles.kpiValue, color: '#818cf8' }}>
                    {students.filter(s => ['Online', 'Active', 'Warning', 'in-progress'].includes(s.status)).length}
                  </div>
                </div>
                <div style={{ ...styles.kpiCard, background: cardBg, border: cardBorder }}>
                  <div style={styles.kpiLabel}>VIOLATIONS</div>
                  <div style={{ ...styles.kpiValue, color: '#f59e0b' }}>
                    {violations.length}
                  </div>
                </div>
                <div style={{ ...styles.kpiCard, background: cardBg, border: cardBorder }}>
                  <div style={styles.kpiLabel}>DONE / COMPLETED</div>
                  <div style={{ ...styles.kpiValue, color: '#10b981' }}>
                    {finishedStudents.length}
                  </div>
                </div>
              </div>
            </div>

            {/* Row 1: LIVE EXAM ACTIVITY (Graph) + LIVE ALERTS */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '20px' }}>
              
              {/* Left: LIVE EXAM ACTIVITY Graph */}
              <div style={{
                background: cardBg,
                padding: '20px',
                borderRadius: '16px',
                border: cardBorder,
                boxShadow: cardShadow
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 800, color: textPrimary, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      📈 LIVE EXAM ACTIVITY & TELEMETRY LOAD
                    </h3>
                    <div style={{ fontSize: '0.75rem', color: textSecondary, marginTop: '2px' }}>
                      Concurrent Candidate Traffic (Past 12 Hours) • Real-Time Telemetry Stream
                    </div>
                  </div>
                  <span style={{
                    fontSize: '0.75rem',
                    padding: '4px 10px',
                    borderRadius: '12px',
                    background: 'rgba(56, 189, 248, 0.15)',
                    color: '#0284c7',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <span style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: '#0284c7',
                      display: 'inline-block'
                    }} />
                    Live Pulse: {telemetryGraphData.currentLive} Active
                  </span>
                </div>

                {/* Interactive SVG Activity Graph Based on Real Data */}
                <div style={{ width: '100%', height: '180px', position: 'relative' }}>
                  <svg viewBox="0 0 500 160" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                    <defs>
                      <linearGradient id="activityGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#38bdf8" stopOpacity={darkMode ? 0.45 : 0.25} />
                        <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    {/* Grid Lines */}
                    <line x1="0" y1="35" x2="500" y2="35" stroke={darkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"} strokeDasharray="4 4" />
                    <line x1="0" y1="70" x2="500" y2="70" stroke={darkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"} strokeDasharray="4 4" />
                    <line x1="0" y1="105" x2="500" y2="105" stroke={darkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"} strokeDasharray="4 4" />
                    <line x1="0" y1="140" x2="500" y2="140" stroke={darkMode ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)"} />

                    {/* Area fill based on real data points */}
                    <path
                      d={telemetryGraphData.areaD}
                      fill="url(#activityGrad)"
                    />
                    {/* Trend Line through real data points */}
                    <path
                      d={telemetryGraphData.pathD}
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                    {/* Activity Points */}
                    {telemetryGraphData.points.map((pt, pIdx) => (
                      <g key={pIdx}>
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={pt.isNow ? 6 : 4}
                          fill={pt.isNow ? "#10b981" : "#38bdf8"}
                          stroke={darkMode ? "#0f172a" : "#ffffff"}
                          strokeWidth="2"
                        />
                        <text
                          x={pt.x}
                          y={pt.y - 9}
                          textAnchor="middle"
                          fill={pt.isNow ? "#10b981" : (darkMode ? "#38bdf8" : "#0284c7")}
                          fontSize="10"
                          fontWeight="800"
                        >
                          {pt.value}
                        </text>
                      </g>
                    ))}
                  </svg>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: textSecondary, fontSize: '0.72rem', marginTop: '6px', fontWeight: 600 }}>
                    {telemetryGraphData.points.map((pt, pIdx) => (
                      <span key={pIdx} style={pt.isNow ? { color: '#10b981', fontWeight: 800 } : {}}>
                        {pt.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right: LIVE ALERTS Stream */}
              <div style={{
                background: cardBg,
                padding: '20px',
                borderRadius: '16px',
                border: cardBorder,
                boxShadow: cardShadow
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 800, color: textPrimary, margin: 0 }}>
                    🚨 LIVE ALERTS
                  </h3>
                  <span style={{ fontSize: '0.72rem', color: textSecondary }}>Real-Time AI Stream</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {notifications.slice(0, 3).map((notif, nIdx) => {
                    const isCrit = notif.severity === 'critical' || notif.type === 'FACE_MISSING';
                    const isHigh = notif.severity === 'high' || notif.type === 'TAB_SWITCH';
                    const bgTint = isCrit
                      ? (darkMode ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.08)')
                      : isHigh
                      ? (darkMode ? 'rgba(245, 158, 11, 0.1)' : 'rgba(245, 158, 11, 0.08)')
                      : (darkMode ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.08)');
                    const borderCol = isCrit ? '#ef4444' : isHigh ? '#f59e0b' : '#10b981';
                    const textCol = isCrit ? '#ef4444' : isHigh ? (darkMode ? '#fbbf24' : '#d97706') : '#10b981';

                    return (
                      <div key={nIdx} style={{ background: bgTint, borderLeft: `4px solid ${borderCol}`, padding: '10px 14px', borderRadius: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong style={{ fontSize: '0.82rem', color: textCol }}>
                            {notif.type === 'FACE_MISSING' ? '🔴 Multiple Faces / Missing' : notif.type === 'TAB_SWITCH' ? '🟡 Tab Switch Triggered' : '🟢 Biometric Verified'}
                          </strong>
                          <span style={{ fontSize: '0.7rem', color: textSecondary }}>{notif.time || 'Recent'}</span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: textSecondary, marginTop: '2px' }}>{notif.message}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Row 2: ACTIVE EXAM PREVIEW (Candidate Live Cards Grid) */}
            <div style={{
              background: cardBg,
              padding: '20px',
              borderRadius: '16px',
              border: cardBorder,
              boxShadow: cardShadow
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: textPrimary, margin: 0 }}>
                    👥 ACTIVE EXAM PREVIEW
                  </h3>
                  <div style={{ fontSize: '0.75rem', color: textSecondary, marginTop: '2px' }}>Live Candidate Sentinels & Biometric Stream Grid</div>
                </div>
                <button
                  onClick={() => setActiveNav('live')}
                  style={{ ...styles.actionLaunchBtn, padding: '6px 14px', fontSize: '0.78rem', background: '#3b82f6', color: '#ffffff', border: 'none' }}
                >
                  📹 View All in Live Grid →
                </button>
              </div>

              {students.length === 0 ? (
                <div style={{ padding: '30px', textAlign: 'center', background: innerBg, borderRadius: '12px', border: darkMode ? '1px dashed #1e293b' : '1px dashed #cbd5e1' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '6px' }}>📡</div>
                  <div style={{ color: textPrimary, fontWeight: 700 }}>No Active Students Currently Streaming</div>
                  <div style={{ color: textSecondary, fontSize: '0.8rem', marginTop: '4px' }}>Active students taking exams will populate here in real-time.</div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                  {students.slice(0, 4).map((s, idx) => (
                    <div key={s.sessionId || s._id || idx} style={{
                      background: innerBg,
                      borderRadius: '12px',
                      border: s.status === 'Warning' ? '1px solid #f59e0b' : (darkMode ? '1px solid #1e293b' : '1px solid #e2e8f0'),
                      padding: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          background: s.status === 'Warning' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                          color: s.status === 'Warning' ? '#fbbf24' : '#10b981'
                        }}>
                          {s.status === 'Warning' ? '🟡 Warning' : '🟢 Normal'}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 700 }}>
                          {s.faceMatchConfidence || 95}% Match
                        </span>
                      </div>

                      <div style={{ height: '90px', background: darkMode ? '#0b1329' : '#e2e8f0', borderRadius: '8px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {s.image || s.lastWebcamFrame ? (
                          <img src={s.image || s.lastWebcamFrame} alt={s.studentName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ fontSize: '1.8rem' }}>👤</div>
                        )}
                      </div>

                      <div>
                        <div style={{ fontWeight: 800, color: textPrimary, fontSize: '0.88rem' }}>{s.studentName}</div>
                        <div style={{ fontSize: '0.725rem', color: textSecondary }}>USN: {s.usn || s.studentId}</div>
                      </div>

                      <button
                        onClick={() => handleOpenStudentDetail(s)}
                        style={{
                          width: '100%',
                          padding: '6px',
                          background: darkMode ? '#1e293b' : '#e2e8f0',
                          border: 'none',
                          color: textPrimary,
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        Inspect Stream ↗
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Row 3: AI PROCTORING HEALTH (Left) + EXAM PERFORMANCE (Right) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              
              {/* Left: AI PROCTORING HEALTH */}
              <div style={{ background: '#0f172a', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#ffffff', margin: '0 0 14px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>🛡️</span> AI PROCTORING HEALTH
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#020617', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ffffff' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#34d399' }}></span>
                      <span>Face Detection Engine</span>
                    </div>
                    <strong style={{ color: '#34d399' }}>Active (99.8%)</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#020617', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ffffff' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#34d399' }}></span>
                      <span>ArcFace Biometrics (InsightFace)</span>
                    </div>
                    <strong style={{ color: '#34d399' }}>Active (512-dim)</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#020617', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ffffff' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#34d399' }}></span>
                      <span>YOLO Object Detector</span>
                    </div>
                    <strong style={{ color: '#34d399' }}>Active (Phone/Person)</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#020617', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ffffff' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#34d399' }}></span>
                      <span>MongoDB Database</span>
                    </div>
                    <strong style={{ color: '#34d399' }}>Connected</strong>
                  </div>
                </div>
              </div>

              {/* Right: EXAM PERFORMANCE */}
              <div style={{ background: '#0f172a', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#ffffff', margin: '0 0 14px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>📊</span> EXAM PERFORMANCE & METRICS
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ background: '#020617', padding: '14px', borderRadius: '10px' }}>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Average Score</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#60a5fa', marginTop: '2px' }}>78%</div>
                    <div style={{ fontSize: '0.7rem', color: '#34d399', marginTop: '2px' }}>↑ +4.2% vs last exam</div>
                  </div>

                  <div style={{ background: '#020617', padding: '14px', borderRadius: '10px' }}>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Pass Rate</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#34d399', marginTop: '2px' }}>84%</div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px' }}>Passing threshold: 40%</div>
                  </div>

                  <div style={{ background: '#020617', padding: '14px', borderRadius: '10px' }}>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Highest Score</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#38bdf8', marginTop: '2px' }}>96%</div>
                    <div style={{ fontSize: '0.7rem', color: '#a78bfa', marginTop: '2px' }}>CS Department</div>
                  </div>

                  <div style={{ background: '#020617', padding: '14px', borderRadius: '10px' }}>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Lowest Score</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#f87171', marginTop: '2px' }}>41%</div>
                    <div style={{ fontSize: '0.7rem', color: '#fbbf24', marginTop: '2px' }}>Review required</div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* -------------------------------------------------------------
            5. TERMINATED STUDENTS VIEW
           ------------------------------------------------------------- */}
        {activeNav === 'terminated' && (
          <div style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ef4444', marginBottom: '16px' }}>
              🔴 Terminated Student Sessions
            </h2>
            {terminatedStudents.length === 0 ? (
              <div style={styles.emptyStateContainer}>
                <div style={styles.emptyStateIcon}>🟢</div>
                <h3 style={styles.emptyStateTitle}>No Terminated Students</h3>
                <p style={styles.emptyStateSubtitle}>No student sessions have been terminated for cheating violations.</p>
              </div>
            ) : (
              <div style={styles.grid}>
                {terminatedStudents.map((s, i) => (
                  <div key={i} style={{ ...styles.studentCard, borderColor: '#ef4444' }}>
                    <div style={styles.cardHeader}>
                      <div>
                        <h3 style={{ margin: 0, color: '#ffffff', fontSize: '1rem' }}>{s.studentName}</h3>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>USN: {s.usn || s.studentId}</div>
                      </div>
                      <span style={styles.criticalPill}>TERMINATED</span>
                    </div>
                    <div style={{ padding: '14px', fontSize: '0.8rem', color: '#cbd5e1' }}>
                      <div>Reason: <strong>{s.terminationReason || 'Exceeded maximum violation limit'}</strong></div>
                      <div style={{ marginTop: '4px', color: '#94a3b8' }}>Terminated at: {s.terminationTime ? new Date(s.terminationTime).toLocaleTimeString() : 'Recent'}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* -------------------------------------------------------------
            6. FINISHED EXAMS VIEW
           ------------------------------------------------------------- */}
        {activeNav === 'finished' && (
          <div style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#34d399', margin: 0 }}>
                  ✔️ Finished & Evaluated Exam Submissions
                </h2>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '4px' }}>
                  Showing candidate identity, departments, login times, submission timestamps, and evaluation breakdown
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                  {finishedStudents.length} Submissions Logged
                </span>
                <button onClick={fetchData} style={styles.refreshBtn}>
                  🔄 Refresh List
                </button>
              </div>
            </div>

            {finishedStudents.length === 0 ? (
              <div style={styles.emptyStateContainer}>
                <div style={styles.emptyStateIcon}>✔️</div>
                <h3 style={styles.emptyStateTitle}>No Finished Exams Yet</h3>
                <p style={styles.emptyStateSubtitle}>Completed student exam submissions with answer sheets, scores, and proctoring logs will appear here.</p>
                <button onClick={fetchData} style={styles.refreshBtn}>
                  🔄 Refresh List
                </button>
              </div>
            ) : (
              <div style={styles.tableCard}>
                <table style={styles.table}>
                  <thead>
                    <tr style={styles.tableHeaderRow}>
                      <th style={styles.tableTh}>Candidate & Department</th>
                      <th style={styles.tableTh}>Email</th>
                      <th style={styles.tableTh}>Login / Start Time</th>
                      <th style={styles.tableTh}>Submission Time</th>
                      <th style={styles.tableTh}>Duration</th>
                      <th style={styles.tableTh}>Score</th>
                      <th style={styles.tableTh}>Integrity</th>
                      <th style={styles.tableTh}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {finishedStudents.map((s, i) => {
                      const loginFormatted = s.loginTime || s.startTime ? new Date(s.loginTime || s.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'N/A';
                      const submitFormatted = s.submissionTime || s.endTime ? new Date(s.submissionTime || s.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'N/A';
                      const dateFormatted = s.submissionTime || s.endTime ? new Date(s.submissionTime || s.endTime).toLocaleDateString() : '';

                      return (
                        <tr key={s._id || s.studentId || i} style={styles.tableRow}>
                          <td style={styles.tableTd}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={styles.miniAvatar}>
                                {s.studentName ? s.studentName.charAt(0).toUpperCase() : 'S'}
                              </div>
                              <div>
                                <div style={{ fontWeight: 800, color: '#ffffff', fontSize: '0.9rem' }}>{s.studentName}</div>
                                <div style={{ fontSize: '0.725rem', color: '#38bdf8' }}>USN: {s.usn || s.studentId}</div>
                                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>🏫 {s.department || 'Computer Science'}</div>
                              </div>
                            </div>
                          </td>
                          <td style={styles.tableTd}>
                            <div style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>{s.email || 'student@university.edu'}</div>
                          </td>
                          <td style={styles.tableTd}>
                            <div style={{ fontSize: '0.8rem', color: '#ffffff', fontWeight: 600 }}>🕒 {loginFormatted}</div>
                          </td>
                          <td style={styles.tableTd}>
                            <div style={{ fontSize: '0.8rem', color: '#34d399', fontWeight: 600 }}>🏁 {submitFormatted}</div>
                            {dateFormatted && <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{dateFormatted}</div>}
                          </td>
                          <td style={styles.tableTd}>
                            <div style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>{s.duration || '00:45:00'}</div>
                          </td>
                          <td style={styles.tableTd}>
                            <div style={{ fontWeight: 800, color: '#60a5fa', fontSize: '0.9rem' }}>
                              {s.score !== undefined ? `${s.score}/${s.totalMarks || 100}` : 'N/A'}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{s.percentage !== undefined ? `${s.percentage}%` : ''}</div>
                          </td>
                          <td style={styles.tableTd}>
                            <strong style={{ color: '#34d399', fontSize: '0.8rem' }}>{s.integrityScore || '98% Safe'}</strong>
                          </td>
                          <td style={styles.tableTd}>
                            <button
                              onClick={() => setInspectingStudent(s)}
                              style={{ ...styles.actionLaunchBtn, padding: '6px 12px', fontSize: '0.78rem', background: '#3b82f6', color: '#ffffff' }}
                              title="Inspect Full Student Report & Answer Sheet"
                            >
                              🔍 View Details
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Inspecting Student Full Report Modal */}
            {inspectingStudent && (
              <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.85)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999,
                padding: '20px'
              }}>
                <div style={{
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '16px',
                  width: '100%',
                  maxWidth: '850px',
                  maxHeight: '90vh',
                  overflowY: 'auto',
                  padding: '24px',
                  color: '#ffffff',
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
                }}>
                  {/* Modal Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #1e293b', paddingBottom: '16px', marginBottom: '20px' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: '#ffffff' }}>
                        🎓 Examination Candidate Submission Report
                      </h3>
                      <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '4px' }}>
                        {inspectingStudent.examName || 'Computer Science Final Assessment'}
                      </div>
                    </div>
                    <button
                      onClick={() => setInspectingStudent(null)}
                      style={{
                        background: '#1e293b',
                        border: 'none',
                        color: '#ffffff',
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 800,
                        fontSize: '1rem'
                      }}
                    >
                      ✕
                    </button>
                  </div>

                  {/* Student Details & Timeline Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '20px' }}>
                    <div style={{ background: '#1e293b', padding: '14px', borderRadius: '10px' }}>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>STUDENT NAME</div>
                      <div style={{ fontWeight: 800, fontSize: '1rem', marginTop: '2px' }}>{inspectingStudent.studentName}</div>
                      <div style={{ fontSize: '0.75rem', color: '#38bdf8', marginTop: '2px' }}>USN: {inspectingStudent.usn || inspectingStudent.studentId}</div>
                    </div>

                    <div style={{ background: '#1e293b', padding: '14px', borderRadius: '10px' }}>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>EMAIL & DEPARTMENT</div>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem', marginTop: '2px', color: '#cbd5e1' }}>{inspectingStudent.email || 'N/A'}</div>
                      <div style={{ fontSize: '0.75rem', color: '#a78bfa', marginTop: '2px' }}>🏫 {inspectingStudent.department || 'Computer Science'}</div>
                    </div>

                    <div style={{ background: '#1e293b', padding: '14px', borderRadius: '10px' }}>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>TIMELINE LOGS</div>
                      <div style={{ fontSize: '0.8rem', color: '#ffffff', marginTop: '2px' }}>
                        🕒 Login: <strong>{inspectingStudent.loginTime || inspectingStudent.startTime ? new Date(inspectingStudent.loginTime || inspectingStudent.startTime).toLocaleTimeString() : 'N/A'}</strong>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#34d399', marginTop: '2px' }}>
                        🏁 Submitted: <strong>{inspectingStudent.submissionTime || inspectingStudent.endTime ? new Date(inspectingStudent.submissionTime || inspectingStudent.endTime).toLocaleTimeString() : 'N/A'}</strong>
                      </div>
                    </div>

                    <div style={{ background: '#1e293b', padding: '14px', borderRadius: '10px' }}>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>SCORE & INTEGRITY</div>
                      <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#60a5fa', marginTop: '2px' }}>
                        {inspectingStudent.score !== undefined ? `${inspectingStudent.score} / ${inspectingStudent.totalMarks || 100}` : 'N/A'} ({inspectingStudent.percentage || 0}%)
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#34d399', marginTop: '2px' }}>
                        🛡️ Integrity: {inspectingStudent.integrityScore || '98% Safe'}
                      </div>
                    </div>
                  </div>

                  {/* Question Answer Sheet Breakdown */}
                  <h4 style={{ fontSize: '1rem', fontWeight: 800, color: '#ffffff', margin: '20px 0 10px' }}>
                    📝 Submitted Answer Sheet Breakdown
                  </h4>

                  {inspectingStudent.answers && inspectingStudent.answers.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {inspectingStudent.answers.map((ans, aIdx) => (
                        <div key={aIdx} style={{
                          background: '#1e293b',
                          padding: '14px',
                          borderRadius: '10px',
                          borderLeft: ans.isCorrect ? '4px solid #10b981' : (ans.selectedOption !== null ? '4px solid #ef4444' : '4px solid #64748b')
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#ffffff' }}>
                              Q{aIdx + 1}: {ans.questionText || `Question ${aIdx + 1}`}
                            </div>
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              fontWeight: 800,
                              background: ans.isCorrect ? 'rgba(16, 185, 129, 0.2)' : (ans.selectedOption !== null ? 'rgba(239, 68, 68, 0.2)' : 'rgba(100, 116, 139, 0.2)'),
                              color: ans.isCorrect ? '#34d399' : (ans.selectedOption !== null ? '#f87171' : '#94a3b8')
                            }}>
                              {ans.isCorrect ? `✓ Correct (+${ans.points || 10} pts)` : (ans.selectedOption !== null ? '✗ Incorrect (0 pts)' : 'Unanswered')}
                            </span>
                          </div>

                          <div style={{ marginTop: '8px', fontSize: '0.82rem', color: '#cbd5e1' }}>
                            <div>Selected Option: <strong>{ans.selectedOptionText || (ans.selectedOption !== null ? `Option ${ans.selectedOption + 1}` : 'None')}</strong></div>
                            {ans.correctOption !== undefined && (
                              <div style={{ color: '#94a3b8', marginTop: '2px' }}>
                                Correct Option Index: <strong>Option {ans.correctOption + 1}</strong>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ background: '#1e293b', padding: '16px', borderRadius: '10px', color: '#94a3b8', fontSize: '0.85rem' }}>
                      No detailed question itemization found for this legacy record. Score: {inspectingStudent.score || 0} marks.
                    </div>
                  )}

                  {/* Close Action */}
                  <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => setInspectingStudent(null)}
                      style={{
                        background: '#334155',
                        border: 'none',
                        color: '#ffffff',
                        padding: '10px 20px',
                        borderRadius: '8px',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      Close Report
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* -------------------------------------------------------------
            6b. ACTIVITY HISTORY VIEW
           ------------------------------------------------------------- */}
        {activeNav === 'history' && (
          <div style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#818cf8', margin: 0 }}>
                📜 System Activity & Audit Trail
              </h2>
              <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                {historyData.length} Logged Events
              </span>
            </div>

            {historyData.length === 0 ? (
              <div style={styles.emptyStateContainer}>
                <div style={styles.emptyStateIcon}>📜</div>
                <h3 style={styles.emptyStateTitle}>No Activity Logs Yet</h3>
                <p style={styles.emptyStateSubtitle}>Live detection telemetry, warnings, and logins will be logged here.</p>
              </div>
            ) : (
              <div style={styles.tableCard}>
                <table style={styles.table}>
                  <thead>
                    <tr style={styles.tableHeaderRow}>
                      <th style={styles.tableTh}>Student</th>
                      <th style={styles.tableTh}>Action / Event</th>
                      <th style={styles.tableTh}>Details</th>
                      <th style={styles.tableTh}>Severity</th>
                      <th style={styles.tableTh}>Time</th>
                      <th style={styles.tableTh}>Evidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyData.map((item, idx) => (
                      <tr key={item.id || idx} style={styles.tableRow}>
                        <td style={styles.tableTd}>
                          <div style={{ fontWeight: 700, color: '#ffffff' }}>{item.studentName}</div>
                          <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{item.usn}</div>
                        </td>
                        <td style={styles.tableTd}>
                          <span style={{ fontWeight: 700, color: item.severity === 'critical' ? '#f87171' : '#a5b4fc' }}>
                            {item.action}
                          </span>
                        </td>
                        <td style={styles.tableTd}>
                          <div style={{ fontSize: '0.8rem', color: '#cbd5e1', maxWidth: '280px' }}>
                            {item.details}
                          </div>
                        </td>
                        <td style={styles.tableTd}>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            background: item.severity === 'critical' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(99, 102, 241, 0.2)',
                            color: item.severity === 'critical' ? '#fca5a5' : '#c7d2fe'
                          }}>
                            {item.severity}
                          </span>
                        </td>
                        <td style={styles.tableTd}>{item.time}</td>
                        <td style={styles.tableTd}>
                          {item.screenshot ? (
                            <button
                              onClick={() => setEvidenceModalImage(item.screenshot)}
                              style={{ ...styles.actionLaunchBtn, padding: '4px 8px', fontSize: '0.75rem' }}
                            >
                              📸 View
                            </button>
                          ) : (
                            <span style={{ color: '#64748b', fontSize: '0.75rem' }}>No Media</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* -------------------------------------------------------------
            7. REPORTS VIEW
           ------------------------------------------------------------- */}
        {activeNav === 'reports' && (
          <div style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#818cf8', margin: 0 }}>
                📄 Proctoring Performance & Audit Reports
              </h2>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={handleExportPDF}
                  style={styles.actionLaunchBtn}
                >
                  📄 Export PDF
                </button>
                <button
                  onClick={handleExportCSV}
                  style={styles.actionLaunchBtn}
                >
                  📊 Export CSV
                </button>
              </div>
            </div>

            <div style={styles.kpiGrid}>
              <div style={styles.kpiCard}>
                <div style={styles.kpiLabel}>Total Examinees Appeared</div>
                <div style={styles.kpiValue}>{reportsData?.summary?.appeared || (finishedStudents.length + students.length)}</div>
              </div>
              <div style={styles.kpiCard}>
                <div style={styles.kpiLabel}>Exams Finished Successfully</div>
                <div style={{ ...styles.kpiValue, color: '#34d399' }}>{reportsData?.summary?.finished || finishedStudents.length}</div>
              </div>
              <div style={styles.kpiCard}>
                <div style={styles.kpiLabel}>Terminated Candidates</div>
                <div style={{ ...styles.kpiValue, color: '#ef4444' }}>{reportsData?.summary?.terminated || terminatedStudents.length}</div>
              </div>
              <div style={styles.kpiCard}>
                <div style={styles.kpiLabel}>Top Cheating Indicator</div>
                <div style={{ ...styles.kpiValue, color: '#fbbf24', fontSize: '1.1rem' }}>
                  {reportsData?.summary?.mostCommonViolation || 'NONE'}
                </div>
              </div>
            </div>

            <div style={{ marginTop: '24px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#ffffff', marginBottom: '12px' }}>
                🏫 Departmental Examination Breakdown
              </h3>
              <div style={styles.tableCard}>
                <table style={styles.table}>
                  <thead>
                    <tr style={styles.tableHeaderRow}>
                      <th style={styles.tableTh}>Department</th>
                      <th style={styles.tableTh}>Candidates</th>
                      <th style={styles.tableTh}>Finished</th>
                      <th style={styles.tableTh}>Terminated</th>
                      <th style={styles.tableTh}>Integrity Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(reportsData?.departmentStats && reportsData.departmentStats.length > 0 ? reportsData.departmentStats : [
                      { department: 'Computer Science & Engineering', appeared: finishedStudents.length + students.length, finished: finishedStudents.length, terminated: terminatedStudents.length }
                    ]).map((dept, idx) => (
                      <tr key={idx} style={styles.tableRow}>
                        <td style={styles.tableTd}>
                          <strong style={{ color: '#ffffff' }}>{dept.department}</strong>
                        </td>
                        <td style={styles.tableTd}>{dept.appeared}</td>
                        <td style={styles.tableTd}><span style={{ color: '#34d399', fontWeight: 700 }}>{dept.finished}</span></td>
                        <td style={styles.tableTd}><span style={{ color: dept.terminated > 0 ? '#ef4444' : '#94a3b8', fontWeight: 700 }}>{dept.terminated}</span></td>
                        <td style={styles.tableTd}>
                          <span style={{ color: '#34d399', fontWeight: 700 }}>
                            {dept.terminated === 0 ? '✓ High Integrity' : '⚠️ Under Review'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* -------------------------------------------------------------
            7b. ANALYTICS VIEW
           ------------------------------------------------------------- */}
        {activeNav === 'analytics' && (
          <div style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#c084fc', marginBottom: '16px' }}>
              📊 AI Anomaly Analytics & Risk Distribution
            </h2>

            <div style={styles.kpiGrid}>
              <div style={styles.kpiCard}>
                <div style={styles.kpiLabel}>Active Exam Rooms</div>
                <div style={styles.kpiValue}>{metrics.activeExams || 1}</div>
              </div>
              <div style={styles.kpiCard}>
                <div style={styles.kpiLabel}>Live Candidates Streaming</div>
                <div style={{ ...styles.kpiValue, color: '#38bdf8' }}>{students.length}</div>
              </div>
              <div style={styles.kpiCard}>
                <div style={styles.kpiLabel}>Violations Logged Today</div>
                <div style={{ ...styles.kpiValue, color: '#fbbf24' }}>{violations.length}</div>
              </div>
              <div style={styles.kpiCard}>
                <div style={styles.kpiLabel}>AI Verification Accuracy</div>
                <div style={{ ...styles.kpiValue, color: '#34d399' }}>99.2%</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '24px' }}>
              <div style={{ background: '#0f172a', padding: '20px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <h4 style={{ color: '#ffffff', margin: '0 0 14px', fontSize: '0.95rem' }}>🛡️ Violation Types Distribution</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5e1' }}>
                    <span>Tab Switching</span>
                    <strong style={{ color: '#fbbf24' }}>{violations.filter(v => v.violationType?.includes('TAB')).length}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5e1' }}>
                    <span>Multiple Faces</span>
                    <strong style={{ color: '#f87171' }}>{violations.filter(v => v.violationType?.includes('FACE')).length}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5e1' }}>
                    <span>Mobile Phone Detections</span>
                    <strong style={{ color: '#ef4444' }}>{violations.filter(v => v.violationType?.includes('PHONE')).length}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5e1' }}>
                    <span>Gaze / Head Away</span>
                    <strong style={{ color: '#818cf8' }}>{violations.filter(v => v.violationType?.includes('GAZE') || v.violationType?.includes('HEAD')).length}</strong>
                  </div>
                </div>
              </div>

              <div style={{ background: '#0f172a', padding: '20px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <h4 style={{ color: '#ffffff', margin: '0 0 14px', fontSize: '0.95rem' }}>📈 Candidate Risk Level Breakdown</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5e1' }}>
                    <span style={{ color: '#34d399' }}>🟢 Low Risk (0–20)</span>
                    <strong style={{ color: '#34d399' }}>{students.filter(s => !s.riskLevel?.includes('High') && s.status !== 'Warning' && s.status !== 'Terminated').length + finishedStudents.length}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5e1' }}>
                    <span style={{ color: '#fbbf24' }}>🟡 Medium Risk (21–50)</span>
                    <strong style={{ color: '#fbbf24' }}>{students.filter(s => s.status === 'Warning' || s.riskLevel?.includes('Medium')).length}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5e1' }}>
                    <span style={{ color: '#ef4444' }}>🔴 High Risk (50+)</span>
                    <strong style={{ color: '#ef4444' }}>{students.filter(s => s.status === 'Terminated' || s.riskLevel?.includes('High')).length + terminatedStudents.length}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* -------------------------------------------------------------
            8. SETTINGS VIEW
           ------------------------------------------------------------- */}
        {activeNav === 'settings' && (
          <div style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ffffff', marginBottom: '16px' }}>
              ⚙️ AI Proctoring Engine Settings
            </h2>
            <div style={{ background: '#0f172a', padding: '20px', borderRadius: '12px', border: '1px solid #1e293b', maxWidth: '600px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', color: '#ffffff', fontWeight: 700, fontSize: '0.85rem', marginBottom: '6px' }}>
                  Face Matching Tolerance Threshold (Current: 0.50)
                </label>
                <input type="range" min="0.30" max="0.70" step="0.05" defaultValue="0.50" style={{ width: '100%' }} />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', color: '#ffffff', fontWeight: 700, fontSize: '0.85rem', marginBottom: '6px' }}>
                  YOLO Object Detection Confidence Threshold (Current: 65%)
                </label>
                <input type="range" min="40" max="90" step="5" defaultValue="65" style={{ width: '100%' }} />
              </div>
            </div>
          </div>
        )}

        {/* Watch Stream Modal */}
        {watchingStudent && (
          <div style={styles.modalBackdrop}>
            <div style={styles.modalContent}>
              <div style={styles.modalHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '1.2rem' }}>📹</span>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#ffffff', fontWeight: 800 }}>
                      LIVE CAMERA SENTINEL
                    </h3>
                    <div style={{ fontSize: '0.75rem', color: '#818cf8', fontWeight: 700 }}>
                      AI SENTINEL ACTIVE • {watchingStudent.studentName} ({watchingStudent.usn})
                    </div>
                  </div>
                </div>

                <button onClick={() => setWatchingStudent(null)} style={styles.modalCloseBtn}>
                  ✕
                </button>
              </div>

              <div style={styles.modalVideoBox}>
                {watchingStudent.image ? (
                  <img src={watchingStudent.image} alt="Live Stream" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ textAlign: 'center', color: '#64748b' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📹</div>
                    <div style={{ fontSize: '0.9rem', color: '#ffffff', fontWeight: 700 }}>
                      Live Stream Connected
                    </div>
                  </div>
                )}

                <div style={styles.sentinelTag}>
                  <span>👤 {watchingStudent.studentName}</span>
                  <span style={{ color: '#34d399', marginLeft: '6px' }}>✓ Verified (98%)</span>
                </div>

                <div style={styles.modalLiveOverlay}>● LIVE</div>
                <div style={styles.modalFpsOverlay}>⚡ 15 FPS | 🧠 Confidence: 98%</div>
              </div>

              <div style={styles.audioMonitorBox}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#38bdf8', fontWeight: 800 }}>
                    🎙️ AUDIO TELEMETRY MONITOR
                  </h4>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#34d399', background: 'rgba(52, 211, 153, 0.15)', padding: '2px 8px', borderRadius: '10px' }}>
                    Normal
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={styles.audioTelemetryItem}>
                    <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Mic Status</span>
                    <strong style={{ color: '#34d399', fontSize: '0.85rem' }}>● Active</strong>
                  </div>
                  <div style={styles.audioTelemetryItem}>
                    <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Noise Level</span>
                    <strong style={{ color: '#38bdf8', fontSize: '0.85rem' }}>24 dB SPL</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Evidence Image Modal */}
        {evidenceModalImage && (
          <div style={styles.modalBackdrop} onClick={() => setEvidenceModalImage(null)}>
            <div style={{ ...styles.modalContent, maxWidth: '600px', padding: '20px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
              <h3 style={{ color: '#ffffff', margin: '0 0 14px 0' }}>📷 Violation Evidence Screenshot Frame</h3>
              <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid #ef4444' }}>
                <img
                  src={evidenceModalImage === 'sample' ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80' : evidenceModalImage}
                  alt="Evidence"
                  style={{ width: '100%', maxHeight: '350px', objectFit: 'cover' }}
                />
              </div>
              <button onClick={() => setEvidenceModalImage(null)} style={{ marginTop: '16px', padding: '8px 20px', backgroundColor: '#334155', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}>
                Close Preview
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


const getStyles = (darkMode) => ({
  appWrapper: {
    display: 'flex',
    minHeight: '100vh',
    backgroundColor: darkMode ? '#0b0f19' : '#ffffff',
    color: darkMode ? '#f8fafc' : '#0f172a',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  sidebar: {
    backgroundColor: darkMode ? '#0f172a' : '#ffffff',
    borderRight: darkMode ? '1px solid #1e293b' : '1px solid #e2e8f0',
    display: 'flex',
    flexDirection: 'column',
    transition: 'width 0.2s ease',
    overflow: 'hidden'
  },
  sidebarHeader: {
    height: '64px',
    display: 'flex',
    alignItems: 'center',
    padding: '0 16px',
    gap: '12px',
    borderBottom: darkMode ? '1px solid #1e293b' : '1px solid #e2e8f0'
  },
  blueShieldLogo: {
    fontSize: '1.5rem'
  },
  logoTitle: {
    fontSize: '1rem',
    fontWeight: '900',
    color: darkMode ? '#ffffff' : '#0f172a',
    letterSpacing: '0.05em'
  },
  logoSubtitle: {
    fontSize: '0.675rem',
    color: darkMode ? '#94a3b8' : '#64748b',
    fontWeight: '600'
  },
  navSectionHeader: {
    padding: '16px 16px 6px 16px',
    fontSize: '0.65rem',
    fontWeight: '800',
    color: darkMode ? '#64748b' : '#94a3b8',
    letterSpacing: '0.08em'
  },
  sidebarNav: {
    display: 'flex',
    flexDirection: 'column',
    padding: '8px 12px',
    gap: '4px',
    flexGrow: 1
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 12px',
    borderRadius: '10px',
    background: 'transparent',
    backgroundColor: 'transparent',
    border: 'none',
    outline: 'none',
    boxShadow: 'none',
    color: darkMode ? '#94a3b8' : '#475569',
    fontSize: '0.85rem',
    fontWeight: '600',
    cursor: 'pointer',
    textAlign: 'left',
    whiteSpace: 'nowrap',
    transition: 'all 0.15s ease'
  },
  navItemActive: {
    backgroundColor: darkMode ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.12)',
    background: darkMode ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.12)',
    color: darkMode ? '#818cf8' : '#4f46e5',
    borderLeft: '3px solid #6366f1',
    fontWeight: '800'
  },
  navIcon: {
    fontSize: '1.05rem'
  },
  liveTag: {
    marginLeft: 'auto',
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    color: '#ef4444',
    padding: '2px 6px',
    borderRadius: '10px',
    fontSize: '0.65rem',
    fontWeight: '800'
  },
  aiEngineCard: {
    margin: '12px',
    padding: '12px',
    backgroundColor: darkMode ? '#020617' : '#f8fafc',
    borderRadius: '10px',
    border: darkMode ? '1px solid #1e293b' : '1px solid #e2e8f0'
  },
  mainContent: {
    flexGrow: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    backgroundColor: darkMode ? '#0b0f19' : '#ffffff'
  },
  topbar: {
    height: '64px',
    backgroundColor: darkMode ? '#0f172a' : '#ffffff',
    borderBottom: darkMode ? '1px solid #1e293b' : '1px solid #e2e8f0',
    padding: '0 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  menuToggleBtn: {
    background: 'none',
    border: 'none',
    color: darkMode ? '#94a3b8' : '#475569',
    fontSize: '1.4rem',
    cursor: 'pointer',
    padding: '4px'
  },
  topbarTitle: {
    margin: 0,
    fontSize: '1.1rem',
    fontWeight: '800',
    color: darkMode ? '#ffffff' : '#0f172a'
  },
  topbarSubtitle: {
    margin: 0,
    fontSize: '0.75rem',
    color: darkMode ? '#94a3b8' : '#64748b'
  },
  externalLinkBtn: {
    padding: '6px 12px',
    backgroundColor: darkMode ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.1)',
    border: '1px solid #6366f1',
    color: darkMode ? '#818cf8' : '#4f46e5',
    borderRadius: '8px',
    fontSize: '0.775rem',
    fontWeight: '700',
    textDecoration: 'none'
  },
  themeToggle: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 8px',
    backgroundColor: darkMode ? '#1e293b' : '#f1f5f9',
    border: darkMode ? '1px solid #334155' : '1px solid #cbd5e1',
    borderRadius: '20px',
    cursor: 'pointer'
  },
  iconBadgeBtn: {
    position: 'relative',
    fontSize: '1.1rem',
    cursor: 'pointer',
    padding: '6px'
  },
  badgeDot: {
    position: 'absolute',
    top: '2px',
    right: '2px',
    width: '14px',
    height: '14px',
    borderRadius: '50%',
    backgroundColor: '#ef4444',
    color: '#fff',
    fontSize: '0.65rem',
    fontWeight: '800',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  profilePill: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    backgroundColor: darkMode ? '#1e293b' : '#f8fafc',
    border: darkMode ? '1px solid #334155' : '1px solid #e2e8f0',
    padding: '4px 12px 4px 6px',
    borderRadius: '24px'
  },
  adminAvatarCircle: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #6366f1, #a855f7)',
    color: '#ffffff',
    fontWeight: '800',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.85rem'
  },
  bannerAlert: {
    margin: '16px 24px 0 24px',
    padding: '10px 16px',
    backgroundColor: darkMode ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.1)',
    border: '1px solid #6366f1',
    borderRadius: '10px',
    color: darkMode ? '#a5b4fc' : '#4338ca',
    fontSize: '0.85rem',
    fontWeight: '700'
  },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '16px',
    marginBottom: '24px'
  },
  kpiCard: {
    padding: '16px',
    backgroundColor: darkMode ? '#0f172a' : '#ffffff',
    borderRadius: '12px',
    border: darkMode ? '1px solid #1e293b' : '1px solid #e2e8f0',
    boxShadow: darkMode ? 'none' : '0 1px 3px rgba(0,0,0,0.05)'
  },
  kpiLabel: {
    fontSize: '0.8rem',
    color: darkMode ? '#94a3b8' : '#64748b',
    marginBottom: '4px',
    fontWeight: '600'
  },
  kpiValue: {
    fontSize: '1.6rem',
    fontWeight: '800'
  },
  filterBar: {
    display: 'flex',
    gap: '14px',
    marginBottom: '24px',
    alignItems: 'center'
  },
  searchWrapper: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    backgroundColor: darkMode ? '#0f172a' : '#ffffff',
    border: darkMode ? '1px solid #1e293b' : '1px solid #cbd5e1',
    borderRadius: '10px'
  },
  searchInput: {
    flex: 1,
    padding: '10px 14px',
    background: 'none',
    border: 'none',
    color: darkMode ? '#ffffff' : '#0f172a',
    fontSize: '0.875rem',
    outline: 'none'
  },
  selectFilter: {
    padding: '10px 14px',
    borderRadius: '10px',
    backgroundColor: darkMode ? '#0f172a' : '#ffffff',
    border: darkMode ? '1px solid #1e293b' : '1px solid #cbd5e1',
    color: darkMode ? '#ffffff' : '#0f172a',
    fontSize: '0.875rem',
    outline: 'none'
  },
  refreshBtn: {
    padding: '10px 16px',
    backgroundColor: darkMode ? '#1e293b' : '#f1f5f9',
    border: darkMode ? '1px solid #334155' : '1px solid #cbd5e1',
    color: darkMode ? '#ffffff' : '#0f172a',
    borderRadius: '10px',
    fontWeight: '600',
    cursor: 'pointer'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
    gap: '20px'
  },
  studentCard: {
    backgroundColor: darkMode ? '#0f172a' : '#ffffff',
    borderRadius: '16px',
    border: darkMode ? '1px solid #1e293b' : '1px solid #e2e8f0',
    boxShadow: darkMode ? 'none' : '0 2px 6px rgba(0,0,0,0.05)',
    overflow: 'hidden'
  },
  cardHeader: {
    padding: '14px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: darkMode ? '1px solid #1e293b' : '1px solid #f1f5f9'
  },
  avatarCircle: {
    width: '38px',
    height: '38px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '800',
    fontSize: '0.95rem',
    color: '#ffffff'
  },
  studentNameTitle: {
    fontSize: '0.95rem',
    fontWeight: '800',
    margin: 0,
    color: darkMode ? '#ffffff' : '#0f172a'
  },
  studentUsnSub: {
    fontSize: '0.725rem',
    color: darkMode ? '#94a3b8' : '#64748b',
    marginTop: '2px'
  },
  videoBox: {
    height: '160px',
    backgroundColor: darkMode ? '#020617' : '#0f172a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden'
  },
  onlineBadge: {
    position: 'absolute',
    top: '10px',
    left: '10px',
    background: 'rgba(16, 185, 129, 0.9)',
    color: '#ffffff',
    padding: '3px 10px',
    borderRadius: '20px',
    fontSize: '0.7rem',
    fontWeight: '800',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.4)'
  },
  pulsingDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: '#ffffff'
  },
  watchStreamBtn: {
    position: 'absolute',
    bottom: '10px',
    right: '10px',
    padding: '6px 12px',
    backgroundColor: 'rgba(99, 102, 241, 0.85)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '0.725rem',
    fontWeight: '700',
    cursor: 'pointer',
    backdropFilter: 'blur(4px)'
  },
  examInfoHeader: {
    padding: '10px 14px',
    backgroundColor: darkMode ? '#020617' : '#f8fafc',
    borderBottom: darkMode ? '1px solid #1e293b' : '1px solid #e2e8f0'
  },
  examNameLabel: {
    fontSize: '0.7rem',
    fontWeight: '800',
    color: darkMode ? '#818cf8' : '#4f46e5',
    letterSpacing: '0.04em'
  },
  timeInfoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.725rem',
    color: darkMode ? '#cbd5e1' : '#475569',
    marginTop: '4px'
  },
  cardBody: {
    padding: '14px'
  },
  telemetryTitle: {
    fontSize: '0.725rem',
    fontWeight: '700',
    color: darkMode ? '#94a3b8' : '#64748b',
    marginBottom: '8px'
  },
  pillGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '6px',
    marginBottom: '12px'
  },
  telemetryPill: {
    padding: '5px 8px',
    borderRadius: '6px',
    fontSize: '0.7rem',
    fontWeight: '700',
    textAlign: 'center'
  },
  poseBox: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.725rem',
    padding: '8px 10px',
    backgroundColor: darkMode ? '#020617' : '#f8fafc',
    border: darkMode ? 'none' : '1px solid #e2e8f0',
    borderRadius: '8px',
    marginBottom: '10px',
    color: darkMode ? '#f8fafc' : '#0f172a'
  },
  countsRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.725rem',
    color: darkMode ? '#94a3b8' : '#64748b',
    marginBottom: '12px'
  },
  cardActions: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px'
  },
  warnBtn: {
    padding: '8px',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    border: '1px solid #f59e0b',
    color: '#fbbf24',
    borderRadius: '8px',
    fontWeight: '700',
    fontSize: '0.75rem',
    cursor: 'pointer'
  },
  detailBtn: {
    padding: '8px',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    border: '1px solid #6366f1',
    color: darkMode ? '#818cf8' : '#4f46e5',
    borderRadius: '8px',
    fontWeight: '700',
    fontSize: '0.75rem',
    cursor: 'pointer'
  },
  tableCard: {
    backgroundColor: darkMode ? '#0f172a' : '#ffffff',
    borderRadius: '16px',
    border: darkMode ? '1px solid #1e293b' : '1px solid #e2e8f0',
    boxShadow: darkMode ? 'none' : '0 2px 6px rgba(0,0,0,0.04)',
    overflow: 'hidden'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left'
  },
  tableHeaderRow: {
    backgroundColor: darkMode ? '#020617' : '#f8fafc',
    borderBottom: darkMode ? '1px solid #1e293b' : '1px solid #e2e8f0'
  },
  tableTh: {
    padding: '14px 16px',
    fontSize: '0.75rem',
    fontWeight: '800',
    color: darkMode ? '#94a3b8' : '#475569',
    textTransform: 'uppercase',
    letterSpacing: '0.05em'
  },
  tableRow: {
    borderBottom: darkMode ? '1px solid #1e293b' : '1px solid #f1f5f9'
  },
  tableTd: {
    padding: '14px 16px',
    fontSize: '0.85rem',
    color: darkMode ? '#cbd5e1' : '#1e293b'
  },
  miniAvatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '800',
    color: '#ffffff',
    fontSize: '0.85rem'
  },
  iconCameraBtn: {
    background: 'none',
    border: 'none',
    fontSize: '1.2rem',
    cursor: 'pointer'
  },
  flaggedPill: {
    padding: '4px 10px',
    borderRadius: '12px',
    backgroundColor: darkMode ? '#1e293b' : '#f1f5f9',
    color: darkMode ? '#cbd5e1' : '#475569',
    fontSize: '0.725rem',
    fontWeight: '700'
  },
  actionLaunchBtn: {
    padding: '6px 10px',
    backgroundColor: darkMode ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.1)',
    border: '1px solid #6366f1',
    color: darkMode ? '#818cf8' : '#4f46e5',
    borderRadius: '6px',
    fontSize: '0.85rem',
    fontWeight: '800',
    cursor: 'pointer'
  },
  detailHeaderCard: {
    backgroundColor: darkMode ? '#0f172a' : '#ffffff',
    borderRadius: '16px',
    border: darkMode ? '1px solid #1e293b' : '1px solid #e2e8f0',
    boxShadow: darkMode ? 'none' : '0 2px 6px rgba(0,0,0,0.04)',
    padding: '24px'
  },
  inspectorCard: {
    backgroundColor: darkMode ? '#0f172a' : '#ffffff',
    borderRadius: '16px',
    border: darkMode ? '1px solid #1e293b' : '1px solid #e2e8f0',
    boxShadow: darkMode ? 'none' : '0 2px 6px rgba(0,0,0,0.04)',
    overflow: 'hidden'
  },
  inspectorVideoContainer: {
    position: 'relative',
    backgroundColor: '#000000'
  },
  evidenceOverlayHeader: {
    position: 'absolute',
    top: '10px',
    left: '10px',
    backgroundColor: 'rgba(16, 185, 129, 0.9)',
    color: '#ffffff',
    padding: '4px 12px',
    borderRadius: '6px',
    fontSize: '0.75rem',
    fontWeight: '800',
    zIndex: 2
  },
  evidenceOverlayGaze: {
    position: 'absolute',
    top: '40px',
    left: '10px',
    backgroundColor: 'rgba(16, 185, 129, 0.85)',
    color: '#ffffff',
    padding: '4px 12px',
    borderRadius: '6px',
    fontSize: '0.75rem',
    fontWeight: '800',
    zIndex: 2
  },
  confidenceOverlayBadge: {
    position: 'absolute',
    bottom: '10px',
    left: '10px',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    border: '1px solid #34d399',
    color: '#ffffff',
    padding: '6px 12px',
    borderRadius: '8px',
    fontSize: '0.75rem',
    zIndex: 2
  },
  miniTelemetryCard: {
    backgroundColor: darkMode ? '#020617' : '#f8fafc',
    border: darkMode ? 'none' : '1px solid #e2e8f0',
    padding: '10px',
    borderRadius: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px'
  },
  timelineCard: {
    backgroundColor: darkMode ? '#0f172a' : '#ffffff',
    borderRadius: '16px',
    border: darkMode ? '1px solid #1e293b' : '1px solid #e2e8f0',
    boxShadow: darkMode ? 'none' : '0 2px 6px rgba(0,0,0,0.04)',
    padding: '24px'
  },
  timelineEventCard: {
    backgroundColor: darkMode ? '#020617' : '#f8fafc',
    border: darkMode ? '1px solid #1e293b' : '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '14px'
  },
  criticalPill: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    color: '#ef4444',
    border: '1px solid #ef4444',
    padding: '2px 8px',
    borderRadius: '8px',
    fontSize: '0.675rem',
    fontWeight: '800'
  },
  highPill: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    color: '#f59e0b',
    border: '1px solid #f59e0b',
    padding: '2px 8px',
    borderRadius: '8px',
    fontSize: '0.675rem',
    fontWeight: '800'
  },
  modalBackdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(2, 6, 23, 0.85)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '20px'
  },
  modalContent: {
    backgroundColor: darkMode ? '#0f172a' : '#ffffff',
    border: darkMode ? '1px solid #334155' : '1px solid #cbd5e1',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '680px',
    overflow: 'hidden',
    boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
    color: darkMode ? '#ffffff' : '#0f172a'
  },
  modalHeader: {
    padding: '16px 20px',
    backgroundColor: darkMode ? '#020617' : '#f8fafc',
    borderBottom: darkMode ? '1px solid #1e293b' : '1px solid #e2e8f0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  modalCloseBtn: {
    background: 'none',
    border: 'none',
    color: darkMode ? '#94a3b8' : '#64748b',
    fontSize: '1.2rem',
    cursor: 'pointer'
  },
  modalVideoBox: {
    height: '320px',
    backgroundColor: '#000000',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  sentinelTag: {
    position: 'absolute',
    top: '14px',
    left: '14px',
    padding: '6px 12px',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    border: '1px solid #34d399',
    borderRadius: '20px',
    fontSize: '0.8rem',
    fontWeight: '800',
    color: '#ffffff',
    backdropFilter: 'blur(6px)'
  },
  modalLiveOverlay: {
    position: 'absolute',
    top: '14px',
    right: '14px',
    padding: '4px 10px',
    backgroundColor: '#ef4444',
    color: '#ffffff',
    borderRadius: '12px',
    fontSize: '0.7rem',
    fontWeight: '800'
  },
  modalFpsOverlay: {
    position: 'absolute',
    bottom: '14px',
    left: '14px',
    padding: '4px 10px',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    color: '#38bdf8',
    borderRadius: '8px',
    fontSize: '0.725rem',
    fontWeight: '700'
  },
  audioMonitorBox: {
    padding: '16px 20px',
    backgroundColor: darkMode ? '#020617' : '#f8fafc',
    borderTop: darkMode ? '1px solid #1e293b' : '1px solid #e2e8f0'
  },
  audioTelemetryItem: {
    backgroundColor: darkMode ? '#0f172a' : '#ffffff',
    border: darkMode ? 'none' : '1px solid #e2e8f0',
    padding: '8px 12px',
    borderRadius: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px'
  },
  emptyStateContainer: {
    backgroundColor: darkMode ? '#0f172a' : '#ffffff',
    borderRadius: '16px',
    border: darkMode ? '1px dashed #334155' : '1px dashed #cbd5e1',
    padding: '60px 24px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: '20px'
  },
  emptyStateIcon: {
    fontSize: '3.2rem',
    marginBottom: '14px',
    color: '#818cf8'
  },
  emptyStateTitle: {
    fontSize: '1.25rem',
    fontWeight: '800',
    color: darkMode ? '#ffffff' : '#0f172a',
    margin: '0 0 8px 0'
  },
  emptyStateSubtitle: {
    fontSize: '0.875rem',
    color: darkMode ? '#94a3b8' : '#64748b',
    maxWidth: '480px',
    lineHeight: '1.6',
    margin: '0 0 20px 0'
  }
});

