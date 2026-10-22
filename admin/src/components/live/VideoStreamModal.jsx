import React, { useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Typography,
  Box,
  Button,
  Grid,
  useTheme
} from '@mui/material';
import { X, Video } from 'lucide-react';
import useSocket from '../../hooks/useSocket';
import socketService from '../../services/socketService';
import RiskChip from '../common/RiskChip';
import StatusBadge from '../common/StatusBadge';
import { useNavigate } from 'react-router-dom';

export const VideoStreamModal = ({ open, onClose, student }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { liveStreamFrame } = useSocket();

  const studentId = student?.studentId || student?._id || student?.sessionId;
  const currentFrame = studentId ? liveStreamFrame[studentId] || liveStreamFrame[student?.sessionId] : null;

  useEffect(() => {
    if (open && studentId) {
      socketService.subscribeStudentVideo(studentId);
    }
  }, [open, studentId]);

  if (!student) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 4,
          backgroundColor: theme.palette.background.paper,
          backgroundImage: 'none'
        }
      }}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ p: 1, borderRadius: 2, bgcolor: 'rgba(99, 102, 241, 0.15)', color: theme.palette.primary.main }}>
            <Video size={24} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              Live Webcam Stream - {student.studentName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              USN: {student.usn} | Session: {student.sessionId}
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={onClose}>
          <X size={20} />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 3 }}>
        {/* Large Stream Canvas Box */}
        <Box
          sx={{
            width: '100%',
            height: 380,
            backgroundColor: '#000000',
            borderRadius: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: 'inset 0 0 20px rgba(0,0,0,0.8)'
          }}
        >
          {currentFrame ? (
            <img
              src={currentFrame.startsWith('data:') ? currentFrame : `data:image/jpeg;base64,${currentFrame}`}
              alt="Live WebCam"
              style={{ width: '100%', height: '100%', objectFit: 'contain', imageRendering: 'high-quality' }}
            />
          ) : (
            <Box sx={{ textAlign: 'center', color: '#94a3b8' }}>
              <Video size={48} style={{ opacity: 0.4, marginBottom: 12 }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Streaming Live Feed...
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.7 }}>
                Socket.IO / WebRTC video frame pipeline active
              </Typography>
            </Box>
          )}

          {/* Live Indicator Overlay */}
          <Box sx={{ position: 'absolute', top: 16, left: 16, display: 'flex', gap: 1 }}>
            <StatusBadge isTrue={true} trueText="LIVE WEBCAM STREAM" falseText="" trueColor="#10b981" />
            <RiskChip level={student.riskLevel} />
          </Box>
        </Box>

        {/* Real-Time Telemetry Summary */}
        <Box sx={{ mt: 3, p: 2.5, borderRadius: 3, backgroundColor: theme.palette.surface.main }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.5 }}>
            Real-Time AI Telemetry Metrics:
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6} sm={3}>
              <Typography variant="caption" color="text.secondary" display="block">Head Pose</Typography>
              <Typography variant="body2" sx={{ fontWeight: 800, color: student.headPose !== 'Normal' ? '#f59e0b' : '#10b981' }}>
                {student.headPose || 'Normal'}
              </Typography>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="caption" color="text.secondary" display="block">Eye Gaze</Typography>
              <Typography variant="body2" sx={{ fontWeight: 800, color: student.eyeGaze !== 'Center' ? '#f59e0b' : '#10b981' }}>
                {student.eyeGaze || 'Center'}
              </Typography>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="caption" color="text.secondary" display="block">Mobile Phone</Typography>
              <Typography variant="body2" sx={{ fontWeight: 800, color: student.mobilePhoneDetected ? '#ef4444' : '#10b981' }}>
                {student.mobilePhoneDetected ? 'DETECTED!' : 'None'}
              </Typography>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="caption" color="text.secondary" display="block">Multiple Faces</Typography>
              <Typography variant="body2" sx={{ fontWeight: 800, color: student.multipleFaces ? '#ef4444' : '#10b981' }}>
                {student.multipleFaces ? 'DETECTED!' : 'Single Face'}
              </Typography>
            </Grid>
          </Grid>
        </Box>

        {/* Action Button */}
        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
          <Button variant="outlined" onClick={onClose} sx={{ borderRadius: 2 }}>
            Close Stream
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => {
              onClose();
              navigate(`/student/${studentId}`);
            }}
            sx={{ fontWeight: 700, borderRadius: 2 }}
          >
            Open Student Detail Dashboard
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default VideoStreamModal;
