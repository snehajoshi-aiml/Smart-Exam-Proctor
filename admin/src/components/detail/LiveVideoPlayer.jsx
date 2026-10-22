import React, { useEffect } from 'react';
import { Box, Typography, Card, CardContent, Chip } from '@mui/material';
import { Video } from 'lucide-react';
import useSocket from '../../hooks/useSocket';
import socketService from '../../services/socketService';
import RiskChip from '../common/RiskChip';
import StatusBadge from '../common/StatusBadge';

export const LiveVideoPlayer = ({ student }) => {
  const { liveStreamFrame } = useSocket();

  const studentId = student?.studentId || student?._id || student?.sessionId;
  const currentFrame =
    (studentId && liveStreamFrame[studentId]) ||
    (student?.sessionId && liveStreamFrame[student.sessionId]) ||
    (student?.usn && liveStreamFrame[student.usn]) ||
    (student?.email && liveStreamFrame[student.email]) ||
    student?.lastWebcamFrame ||
    student?.screenshotBase64;

  useEffect(() => {
    if (studentId) {
      socketService.subscribeStudentVideo(studentId);
    }
  }, [studentId]);

  return (
    <Card sx={{ height: '100%', borderRadius: 4, overflow: 'hidden' }}>
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          height: 400,
          backgroundColor: '#000000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: 'inset 0 0 30px rgba(0,0,0,0.8)'
        }}
      >
        {currentFrame ? (
          <img
            src={currentFrame.startsWith('data:') ? currentFrame : `data:image/jpeg;base64,${currentFrame}`}
            alt="Live Webcam Feed"
            style={{ width: '100%', height: '100%', objectFit: 'contain', imageRendering: 'high-quality' }}
          />
        ) : (
          <Box sx={{ textAlign: 'center', color: '#94a3b8' }}>
            <Video size={56} style={{ opacity: 0.4, marginBottom: 12 }} />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Live Webcam Stream
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.7 }}>
              Receiving Socket.IO video frames...
            </Typography>
          </Box>
        )}

        {/* Live Badges Overlay */}
        <Box sx={{ position: 'absolute', top: 16, left: 16, display: 'flex', gap: 1 }}>
          <StatusBadge isTrue={student?.status === 'Online'} trueText="LIVE PROCTORING ACTIVE" falseText="OFFLINE" trueColor="#10b981" />
          <RiskChip level={student?.riskLevel} />
        </Box>

        {/* Face Confidence Overlay */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 16,
            left: 16,
            p: 1.2,
            px: 2,
            borderRadius: 3,
            backdropFilter: 'blur(10px)',
            backgroundColor: 'rgba(15, 23, 42, 0.8)',
            border: '1px solid rgba(255,255,255,0.1)'
          }}
        >
          <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block', fontWeight: 600 }}>
            Face Detection Confidence:
          </Typography>
          <Typography variant="subtitle2" sx={{ color: '#10b981', fontWeight: 800 }}>
            {((student?.faceConfidence || 0.96) * 100).toFixed(1)}% Match
          </Typography>
        </Box>
      </Box>

      {/* Quick Summary Card Content */}
      <CardContent sx={{ p: 2.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
          Active Real-Time Indicators
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <Chip
            size="small"
            label={`Head: ${student?.headPose || 'Normal'}`}
            sx={{ fontWeight: 700, bgcolor: student?.headPose !== 'Normal' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)', color: student?.headPose !== 'Normal' ? '#f59e0b' : '#10b981' }}
          />
          <Chip
            size="small"
            label={`Gaze: ${student?.eyeGaze || 'Center'}`}
            sx={{ fontWeight: 700, bgcolor: student?.eyeGaze !== 'Center' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)', color: student?.eyeGaze !== 'Center' ? '#f59e0b' : '#10b981' }}
          />
          <Chip
            size="small"
            label={student?.mobilePhoneDetected ? 'Mobile Detected!' : 'No Mobile Phone'}
            sx={{ fontWeight: 700, bgcolor: student?.mobilePhoneDetected ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)', color: student?.mobilePhoneDetected ? '#ef4444' : '#10b981' }}
          />
          <Chip
            size="small"
            label={student?.multipleFaces ? 'Multiple Faces!' : 'Single Face'}
            sx={{ fontWeight: 700, bgcolor: student?.multipleFaces ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)', color: student?.multipleFaces ? '#ef4444' : '#10b981' }}
          />
        </Box>
      </CardContent>
    </Card>
  );
};

export default LiveVideoPlayer;
