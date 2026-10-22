import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  Grid,
  Divider,
  Avatar,
  Tooltip,
  useTheme
} from '@mui/material';
import {
  Video,
  Clock,
  Maximize2,
  Copy
} from 'lucide-react';
import RiskChip from '../common/RiskChip';
import StatusBadge from '../common/StatusBadge';
import useSocket from '../../hooks/useSocket';
import { useNavigate } from 'react-router-dom';

export const StudentCard = ({ student, onWatchLive }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { liveStreamFrame } = useSocket();

  const id = student.studentId || student._id || student.sessionId;
  const currentFrame = liveStreamFrame[id] || liveStreamFrame[student.sessionId];

  const formatRemainingTime = (seconds) => {
    if (typeof seconds !== 'number') return '01:45:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        transition: 'all 0.2s ease-in-out',
        border: student.riskLevel === 'High'
          ? '2px solid rgba(239, 68, 68, 0.6)'
          : student.riskLevel === 'Medium'
            ? '1px solid rgba(245, 158, 11, 0.5)'
            : undefined,
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: theme.palette.mode === 'dark'
            ? '0 16px 32px rgba(0,0,0,0.5)'
            : '0 16px 32px rgba(0,0,0,0.08)'
        }
      }}
    >
      {/* Top Header */}
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${theme.palette.divider}` }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar
            sx={{
              width: 40,
              height: 40,
              bgcolor: theme.palette.primary.main,
              fontWeight: 700
            }}
          >
            {student.studentName ? student.studentName.charAt(0) : 'S'}
          </Avatar>
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
              {student.studentName}
            </Typography>
            <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontWeight: 600 }}>
              USN: {student.usn} | {student.department}
            </Typography>
          </Box>
        </Box>
        <RiskChip level={student.riskLevel} />
      </Box>

      {/* Video Streaming Preview Box */}
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          height: 170,
          backgroundColor: '#000000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden'
        }}
      >
        {currentFrame ? (
          <img
            src={currentFrame.startsWith('data:') ? currentFrame : `data:image/jpeg;base64,${currentFrame}`}
            alt="Live Stream"
            style={{ width: '100%', height: '100%', objectFit: 'cover', imageRendering: 'high-quality' }}
          />
        ) : (
          <Box sx={{ textAlign: 'center', color: '#64748b' }}>
            <Video size={36} style={{ opacity: 0.5, marginBottom: 4 }} />
            <Typography variant="caption" sx={{ display: 'block', fontWeight: 600 }}>
              Live Camera Standby
            </Typography>
          </Box>
        )}

        {/* Live Badge Overlay */}
        <Box sx={{ position: 'absolute', top: 10, left: 10, zIndex: 2 }}>
          <StatusBadge
            isTrue={
              student.status === 'Online' ||
              student.status === 'Active' ||
              student.isOnline ||
              (student.updatedAt && (new Date() - new Date(student.updatedAt)) < 90000) ||
              (student.lastActive && (new Date() - new Date(student.lastActive)) < 90000)
            }
            trueText="ONLINE LIVE"
            falseText="OFFLINE"
            trueColor="#10b981"
            falseColor="#ef4444"
          />
        </Box>

        {/* Quick Watch Stream Button Overlay */}
        <Button
          size="small"
          variant="contained"
          startIcon={<Video size={14} />}
          onClick={() => onWatchLive(student)}
          sx={{
            position: 'absolute',
            bottom: 10,
            right: 10,
            zIndex: 2,
            backdropFilter: 'blur(8px)',
            backgroundColor: 'rgba(99, 102, 241, 0.85)',
            fontSize: '0.7rem',
            fontWeight: 700,
            '&:hover': { backgroundColor: '#4f46e5' }
          }}
        >
          Watch Stream
        </Button>
      </Box>

      {/* Main Telemetry Specs */}
      <CardContent sx={{ p: 2, flexGrow: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: 'block', mb: 1, textTransform: 'uppercase' }}>
          Exam: <strong>{student.examName}</strong>
        </Typography>

        <Grid container spacing={1} sx={{ mb: 2 }}>
          <Grid item xs={6}>
            <Tooltip title="Exam Start Time">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                <Clock size={14} color={theme.palette.text.secondary} />
                <Typography variant="caption" color="text.secondary">
                  Start: <strong>{new Date(student.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>
                </Typography>
              </Box>
            </Tooltip>
          </Grid>
          <Grid item xs={6}>
            <Tooltip title="Remaining Time">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                <Clock size={14} color="#f59e0b" />
                <Typography variant="caption" sx={{ fontWeight: 700, color: '#f59e0b' }}>
                  Rem: {formatRemainingTime(student.remainingTime)}
                </Typography>
              </Box>
            </Tooltip>
          </Grid>
        </Grid>

        <Divider sx={{ my: 1, opacity: 0.5 }} />

        {/* Requirement 3 Specific Indicator Chips */}
        <Typography variant="caption" sx={{ fontWeight: 700, color: theme.palette.text.secondary, mb: 1, display: 'block' }}>
          AI Proctor Telemetry Indicators:
        </Typography>

        <Grid container spacing={1}>
          <Grid item xs={6}>
            <StatusBadge
              isTrue={student.faceDetected}
              trueText="Face Detected"
              falseText="No Face"
              trueColor="#10b981"
              falseColor="#ef4444"
            />
          </Grid>

          <Grid item xs={6}>
            <StatusBadge
              isTrue={!student.multipleFaces}
              trueText="Single Face"
              falseText="Multiple Faces!"
              trueColor="#10b981"
              falseColor="#ef4444"
            />
          </Grid>

          <Grid item xs={6}>
            <StatusBadge
              isTrue={!student.mobilePhoneDetected}
              trueText="No Phone"
              falseText="Phone Detected!"
              trueColor="#10b981"
              falseColor="#ef4444"
            />
          </Grid>

          <Grid item xs={6}>
            <StatusBadge
              isTrue={student.fullScreenStatus === 'Active'}
              trueText="Fullscreen Active"
              falseText="Fullscreen Exited"
              trueColor="#10b981"
              falseColor="#f59e0b"
            />
          </Grid>
        </Grid>

        {/* Head Pose & Eye Gaze */}
        <Box sx={{ mt: 1.5, p: 1.2, borderRadius: 2, backgroundColor: theme.palette.surface.main }}>
          <Grid container spacing={1}>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary" display="block">Head Pose:</Typography>
              <Typography variant="caption" sx={{ fontWeight: 700, color: student.headPose !== 'Normal' ? '#f59e0b' : '#10b981' }}>
                {student.headPose || 'Normal'}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary" display="block">Eye Gaze:</Typography>
              <Typography variant="caption" sx={{ fontWeight: 700, color: student.eyeGaze !== 'Center' ? '#f59e0b' : '#10b981' }}>
                {student.eyeGaze || 'Center'}
              </Typography>
            </Grid>
          </Grid>
        </Box>

        {/* Counts summary */}
        <Box sx={{ mt: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Tooltip title="Tab Switches">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Maximize2 size={13} color={student.tabSwitchingCount > 2 ? '#ef4444' : '#64748b'} />
              <Typography variant="caption" sx={{ fontWeight: 700 }}>
                Tab Switches: {student.tabSwitchingCount}
              </Typography>
            </Box>
          </Tooltip>

          <Tooltip title="Copy/Paste Attempts">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Copy size={13} color={student.copyPasteAttempts > 0 ? '#f59e0b' : '#64748b'} />
              <Typography variant="caption" sx={{ fontWeight: 700 }}>
                Copy/Paste: {student.copyPasteAttempts}
              </Typography>
            </Box>
          </Tooltip>
        </Box>
      </CardContent>

      {/* Card Footer Actions */}
      <Box sx={{ p: 2, pt: 0 }}>
        <Button
          fullWidth
          variant="outlined"
          color="primary"
          onClick={() => navigate(`/student/${id}`)}
          sx={{ fontWeight: 700, borderRadius: 2 }}
        >
          View Full Student Detail
        </Button>
      </Box>
    </Card>
  );
};

export default StudentCard;
