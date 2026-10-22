import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Typography, Button, Grid, Paper, Chip } from '@mui/material';
import { ArrowLeft } from 'lucide-react';
import { adminApi } from '../services/api';

import LiveVideoPlayer from '../components/detail/LiveVideoPlayer';
import ViolationTimeline from '../components/detail/ViolationTimeline';
import AIDetectionEvents from '../components/detail/AIDetectionEvents';
import ScreenshotsGallery from '../components/detail/ScreenshotsGallery';
import HeadEyeCharts from '../components/detail/HeadEyeCharts';
import EventLogsTable from '../components/detail/EventLogsTable';
import RiskChip from '../components/common/RiskChip';

export const StudentDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [student, setStudent] = useState(null);
  const [violations, setViolations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStudentData = async () => {
      try {
        setLoading(true);
        const response = await adminApi.getStudentDetail(id);
        if (response.data && response.data.success) {
          setStudent(response.data.student);
          setViolations(response.data.violations || []);
        }
      } catch (error) {
        console.error('Error fetching student detail:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStudentData();
    const interval = setInterval(fetchStudentData, 5000);
    return () => clearInterval(interval);
  }, [id]);

  if (loading && !student) {
    return (
      <Box sx={{ p: 5, textAlign: 'center' }}>
        <Typography variant="h6">Loading Student Proctoring Telemetries...</Typography>
      </Box>
    );
  }

  if (!student) {
    return (
      <Box sx={{ p: 5, textAlign: 'center' }}>
        <Typography variant="h6" color="error">
          Student Session Not Found
        </Typography>
        <Button variant="outlined" onClick={() => navigate('/live')} sx={{ mt: 2 }}>
          Back to Live Monitoring
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      {/* Top Header Navigation */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Button
          variant="outlined"
          startIcon={<ArrowLeft size={18} />}
          onClick={() => navigate(-1)}
          sx={{ fontWeight: 700, borderRadius: 2 }}
        >
          Back
        </Button>

        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          <RiskChip level={student.riskLevel} />
          <Chip label={`Status: ${student.status || 'Online'}`} color="primary" variant="filled" sx={{ fontWeight: 700 }} />
        </Box>
      </Box>

      {/* Student Profile Card */}
      <Paper sx={{ p: 3, borderRadius: 4, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>
              {student.studentName}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 600 }}>
              USN: <strong>{student.usn}</strong> | Email: {student.email}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Department: {student.department}
            </Typography>
          </Grid>

          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, justifyContent: { md: 'flex-end' } }}>
              <Box>
                <Typography variant="caption" color="text.secondary" display="block">Exam Name</Typography>
                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{student.examName}</Typography>
              </Box>

              <Box>
                <Typography variant="caption" color="text.secondary" display="block">Start Time</Typography>
                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                  {student?.startTime && !isNaN(new Date(student.startTime).getTime())
                    ? new Date(student.startTime).toLocaleTimeString()
                    : 'N/A'}
                </Typography>
              </Box>

              <Box>
                <Typography variant="caption" color="text.secondary" display="block">Attention Risk</Typography>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: student.attentionRiskLevel === 'HIGH RISK' ? '#ef4444' : (student.attentionRiskLevel === 'SUSPICIOUS' ? '#f59e0b' : '#10b981') }}>
                  {student.attentionRiskLevel || 'NORMAL'}
                </Typography>
              </Box>

              <Box>
                <Typography variant="caption" color="text.secondary" display="block">Gaze Deviations</Typography>
                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                  {student.gazeDeviationsCount || 0} {student.longestGazeDeviation ? `(max ${student.longestGazeDeviation}s)` : ''}
                </Typography>
              </Box>

              <Box>
                <Typography variant="caption" color="text.secondary" display="block">Suspicious Count</Typography>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: student.suspiciousActivityCount > 2 ? '#ef4444' : '#10b981' }}>
                  {student.suspiciousActivityCount || 0} Events
                </Typography>
              </Box>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Main Top Section: Large Live Video & Violation Timeline */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} lg={7}>
          <LiveVideoPlayer student={student} />
        </Grid>

        <Grid item xs={12} lg={5}>
          <ViolationTimeline violations={violations.length > 0 ? violations : student.eventLogs || []} />
        </Grid>
      </Grid>

      {/* AI Detection Events & Object Detection Results */}
      <AIDetectionEvents
        events={student.aiDetectionEvents || []}
        objectDetections={student.objectDetectionResults || []}
      />

      {/* Screenshots Captured */}
      <ScreenshotsGallery screenshots={student.screenshotsCaptured || []} />

      {/* Head Movement & Eye Tracking Trajectory Charts */}
      <HeadEyeCharts
        headHistory={student.headMovementHistory || []}
        eyeHistory={student.eyeTrackingHistory || []}
      />

      {/* Event Logs & Browser Activity */}
      <EventLogsTable
        eventLogs={student.eventLogs || []}
        browserActivity={student.browserActivity || []}
      />
    </Box>
  );
};

export default StudentDetailPage;
