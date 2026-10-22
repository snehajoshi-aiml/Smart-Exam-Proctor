import React, { useEffect, useState } from 'react';
import { Box, Typography, Button, Chip } from '@mui/material';
import { RefreshCw, Video } from 'lucide-react';
import { adminApi } from '../services/api';
import StudentGrid from '../components/live/StudentGrid';
import FilterPanel from '../components/common/FilterPanel';
import { useSocket } from '../context/SocketContext';

export const LiveMonitoringPage = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const { socket } = useSocket();

  // Filter & Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');

  const fetchLiveStudents = async () => {
    try {
      const response = await adminApi.getLiveStudents();
      if (response.data && response.data.success) {
        setStudents(response.data.students);
      }
    } catch (error) {
      console.error('Error fetching live students:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveStudents();
    const interval = setInterval(fetchLiveStudents, 4000);

    const handleUpdate = (updatedStudent) => {
      if (!updatedStudent) return;
      setStudents((prev) => {
        const id = updatedStudent.studentId || updatedStudent.email || updatedStudent.sessionId;
        const idx = prev.findIndex((s) => (s.studentId || s.email || s.sessionId) === id);
        if (idx !== -1) {
          const next = [...prev];
          next[idx] = { ...next[idx], ...updatedStudent };
          return next;
        }
        return [updatedStudent, ...prev];
      });
    };

    if (socket) {
      socket.on('student-updated', handleUpdate);
      socket.on('student-connected', handleUpdate);
    }

    return () => {
      clearInterval(interval);
      if (socket) {
        socket.off('student-updated', handleUpdate);
        socket.off('student-connected', handleUpdate);
      }
    };
  }, [socket]);

  // Filter students based on state
  const filteredStudents = students.filter(s => {
    if (statusFilter !== 'all' && s.status !== statusFilter) return false;
    if (riskFilter !== 'all' && (s.riskCategory || s.riskLevel) !== riskFilter) return false;
    if (departmentFilter !== 'all' && s.department !== departmentFilter) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = s.studentName && s.studentName.toLowerCase().includes(q);
      const matchUsn = s.usn && s.usn.toLowerCase().includes(q);
      const matchEmail = s.email && s.email.toLowerCase().includes(q);
      const matchExam = s.examName && s.examName.toLowerCase().includes(q);
      const matchDept = s.department && s.department.toLowerCase().includes(q);
      return matchName || matchUsn || matchEmail || matchExam || matchDept;
    }
    return true;
  });

  const activeCount = students.filter(s => s.status === 'Online' || s.status === 'Active').length;
  const warningCount = students.filter(s => s.status === 'Warning').length;
  const terminatedCount = students.filter(s => s.status === 'Terminated').length;
  const finishedCount = students.filter(s => s.status === 'Finished' || s.status === 'Completed').length;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Video color="#6366f1" size={28} /> Live Student Exam Monitoring Grid
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, mt: 0.5 }}>
            Real-Time Webcams, Face Verification, Head Pose, Eye Gaze & Object Detection Signals
          </Typography>
        </Box>

        <Button
          variant="outlined"
          startIcon={<RefreshCw size={16} />}
          onClick={fetchLiveStudents}
          sx={{ fontWeight: 700, borderRadius: 3, textTransform: 'none' }}
        >
          Refresh Feed
        </Button>
      </Box>

      {/* Summary Status Badges */}
      <Box sx={{ display: 'flex', gap: 1.5, mb: 3, flexWrap: 'wrap' }}>
        <Chip label={`🟢 Active (${activeCount})`} sx={{ fontWeight: 800, bgcolor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid #10b981' }} />
        <Chip label={`🟡 Warning (${warningCount})`} sx={{ fontWeight: 800, bgcolor: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid #f59e0b' }} />
        <Chip label={`🔴 Terminated (${terminatedCount})`} sx={{ fontWeight: 800, bgcolor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid #ef4444' }} />
        <Chip label={`⚪ Finished (${finishedCount})`} sx={{ fontWeight: 800, bgcolor: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', border: '1px solid #3b82f6' }} />
      </Box>

      {/* Search & Filter Panel */}
      <FilterPanel
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        riskFilter={riskFilter}
        onRiskChange={setRiskFilter}
        departmentFilter={departmentFilter}
        onDepartmentChange={setDepartmentFilter}
        onResetFilters={() => {
          setSearchQuery('');
          setStatusFilter('all');
          setRiskFilter('all');
          setDepartmentFilter('all');
        }}
      />

      {/* Main Student Grid */}
      <StudentGrid students={filteredStudents} loading={loading} />
    </Box>
  );
};

export default LiveMonitoringPage;
