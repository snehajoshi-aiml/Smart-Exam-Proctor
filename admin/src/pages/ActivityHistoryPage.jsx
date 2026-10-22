import React, { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Avatar,
  Chip,
  Grid,
  Divider
} from '@mui/material';
import { History, ShieldAlert, CheckCircle, Clock, AlertTriangle, UserCheck, Play, LogOut, Camera } from 'lucide-react';
import { adminApi } from '../services/api';
import FilterPanel from '../components/common/FilterPanel';

export const ActivityHistoryPage = () => {
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchStudentTimeline = useCallback(async (id) => {
    try {
      const res = await adminApi.getStudentDetail(id);
      if (res.data && res.data.success) {
        setSelectedStudent(res.data.student);
      }
    } catch (err) {
      console.warn('Error fetching student timeline:', err);
    }
  }, []);

  const fetchLiveStudents = useCallback(async () => {
    try {
      const res = await adminApi.getLiveStudents({ search: searchQuery });
      if (res.data && res.data.success) {
        setStudents(res.data.students || []);
        if (res.data.students && res.data.students.length > 0 && !selectedStudent) {
          fetchStudentTimeline(res.data.students[0].studentId || res.data.students[0].usn);
        }
      }
    } catch (err) {
      console.warn('Error fetching students:', err);
    }
  }, [searchQuery, selectedStudent, fetchStudentTimeline]);

  useEffect(() => {
    fetchLiveStudents();
  }, [fetchLiveStudents]);

  const getStepIcon = (step) => {
    switch (step) {
      case 'Login':
        return <UserCheck size={18} color="#6366f1" />;
      case 'Face Verification':
        return <Camera size={18} color="#06b6d4" />;
      case 'Exam Started':
        return <Play size={18} color="#10b981" />;
      case 'Violation':
        return <ShieldAlert size={18} color="#ef4444" />;
      case 'Warning':
        return <AlertTriangle size={18} color="#f59e0b" />;
      case 'Termination':
        return <ShieldAlert size={18} color="#ef4444" />;
      case 'Exam Submitted':
        return <CheckCircle size={18} color="#10b981" />;
      case 'Logout':
        return <LogOut size={18} color="#64748b" />;
      default:
        return <Clock size={18} color="#3b82f6" />;
    }
  };

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 900, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <History size={30} color="#6366f1" /> Complete Student Activity Timeline
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, mt: 0.5 }}>
          Chronological Audit Trail: Login → Face Verification → Exam Started → Violations → Screenshots → Submission/Logout
        </Typography>
      </Box>

      {/* Filter Panel */}
      <FilterPanel
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onResetFilters={() => setSearchQuery('')}
      />

      <Grid container spacing={3}>
        {/* Left Column: Student List */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, borderRadius: 4, maxHeight: 600, overflowY: 'auto' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.5, px: 1 }}>
              SELECT STUDENT SESSION ({students.length})
            </Typography>

            {students.map((s) => {
              const isSelected = selectedStudent && (selectedStudent.studentId === s.studentId || selectedStudent.usn === s.usn);
              return (
                <Box
                  key={s._id || s.studentId}
                  onClick={() => fetchStudentTimeline(s.studentId || s.usn)}
                  sx={{
                    p: 1.5,
                    mb: 1,
                    borderRadius: 3,
                    cursor: 'pointer',
                    bgcolor: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                    border: isSelected ? '1px solid #6366f1' : '1px solid transparent',
                    transition: 'all 0.2s'
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Avatar sx={{ bgcolor: isSelected ? '#6366f1' : '#334155', width: 34, height: 34, fontSize: '0.85rem', fontWeight: 800 }}>
                      {s.studentName ? s.studentName.charAt(0) : 'S'}
                    </Avatar>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
                        {s.studentName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        USN: {s.usn || s.studentId}
                      </Typography>
                    </Box>
                    <Chip label={s.status || 'Online'} size="small" color={s.status === 'Terminated' ? 'error' : 'success'} sx={{ fontWeight: 800, fontSize: '0.65rem' }} />
                  </Box>
                </Box>
              );
            })}
          </Paper>
        </Grid>

        {/* Right Column: Timeline Detail */}
        <Grid item xs={12} md={8}>
          {selectedStudent ? (
            <Paper sx={{ p: 3, borderRadius: 4 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 900 }}>
                    {selectedStudent.studentName}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                    USN: {selectedStudent.usn} | Email: {selectedStudent.email} | Dept: {selectedStudent.department}
                  </Typography>
                </Box>

                <Chip label={`Risk Score: ${selectedStudent.riskScore || 10}/100`} color={selectedStudent.riskScore > 50 ? 'error' : 'success'} sx={{ fontWeight: 900 }} />
              </Box>

              <Divider sx={{ mb: 3 }} />

              {/* Vertical Timeline */}
              <Box sx={{ position: 'relative', pl: 3, '&::before': { content: '""', position: 'absolute', left: 12, top: 10, bottom: 10, width: 2, bgcolor: '#334155' } }}>
                {(selectedStudent.activityHistory || []).map((event, idx) => (
                  <Box key={idx} sx={{ position: 'relative', mb: 3 }}>
                    {/* Circle Node */}
                    <Box
                      sx={{
                        position: 'absolute',
                        left: -28,
                        top: 2,
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        bgcolor: '#0f172a',
                        border: '2px solid #6366f1',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 2
                      }}
                    >
                      {getStepIcon(event.step)}
                    </Box>

                    {/* Card Content */}
                    <Paper sx={{ p: 2, borderRadius: 3, bgcolor: 'rgba(30, 41, 59, 0.4)', border: '1px solid #1e293b' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 800, color: event.step === 'Violation' ? '#ef4444' : '#38bdf8' }}>
                          {event.step.toUpperCase()}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                          🕒 {new Date(event.timestamp).toLocaleTimeString()}
                        </Typography>
                      </Box>

                      <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.5 }}>
                        {event.label}
                      </Typography>

                      {event.screenshot && (
                        <Box sx={{ mt: 1.5, width: 120, height: 75, borderRadius: 2, overflow: 'hidden', border: '1px solid #334155' }}>
                          <img src={event.screenshot} alt="Captured Frame" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </Box>
                      )}
                    </Paper>
                  </Box>
                ))}
              </Box>
            </Paper>
          ) : (
            <Paper sx={{ p: 5, textAlign: 'center', borderRadius: 4 }}>
              <Typography variant="body1" color="text.secondary">Select a student session from the left to view complete activity history timeline.</Typography>
            </Paper>
          )}
        </Grid>
      </Grid>
    </Box>
  );
};

export default ActivityHistoryPage;
