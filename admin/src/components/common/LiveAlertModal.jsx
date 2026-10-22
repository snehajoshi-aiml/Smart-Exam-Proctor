import React, { useEffect } from 'react';
import { Snackbar, Alert as MuiAlert, AlertTitle, Button, Box, Typography, Slide } from '@mui/material';
import { ShieldAlert, AlertTriangle, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * Web Audio API helper to synthesize a crisp alert chime sound for Critical / High Severity violations
 */
function playAlertSound(severity) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = severity === 'Critical' ? 'sawtooth' : 'sine';
    osc.frequency.setValueAtTime(severity === 'Critical' ? 880 : 587.33, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(severity === 'Critical' ? 440 : 440, ctx.currentTime + 0.35);

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch (err) {
    console.warn('Audio alert notice:', err);
  }
}

function TransitionUp(props) {
  return <Slide {...props} direction="up" />;
}

export const LiveAlertModal = ({ alert, onClose }) => {
  const navigate = useNavigate();

  useEffect(() => {
    if (alert && (alert.severity === 'High' || alert.severity === 'Critical' || alert.isCritical)) {
      playAlertSound(alert.severity || 'Critical');
    }
  }, [alert]);

  if (!alert) return null;

  const severityColor = alert.severity === 'Critical' ? 'error' : alert.severity === 'High' ? 'warning' : 'info';

  const handleViewStudent = () => {
    const studentId = alert.studentId || alert.usn || alert.id;
    if (studentId) {
      navigate(`/student/${studentId}`);
    }
    if (onClose) onClose();
  };

  return (
    <Snackbar
      open={Boolean(alert)}
      autoHideDuration={8000}
      onClose={onClose}
      TransitionComponent={TransitionUp}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      sx={{ maxWidth: 450 }}
    >
      <MuiAlert
        severity={severityColor}
        variant="filled"
        icon={alert.severity === 'Critical' ? <ShieldAlert size={26} /> : <AlertTriangle size={26} />}
        sx={{
          width: '100%',
          borderRadius: 3,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
          bgcolor: alert.severity === 'Critical' ? '#991b1b' : alert.severity === 'High' ? '#c2410c' : '#1e1b4b',
          color: '#ffffff',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          p: 2
        }}
      >
        <AlertTitle sx={{ fontWeight: 800, fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>🚨 Live Proctoring Violation Flagged</span>
          <Typography variant="caption" sx={{ opacity: 0.8, fontWeight: 700 }}>
            {alert.timestamp ? new Date(alert.timestamp).toLocaleTimeString() : 'Just Now'}
          </Typography>
        </AlertTitle>

        <Box sx={{ my: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
            {alert.type ? alert.type.replace(/_/g, ' ').toUpperCase() : 'Suspicious Activity'}
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.5 }}>
            Student: <strong>{alert.studentName || alert.studentId}</strong>
          </Typography>

          {alert.examName && (
            <Typography variant="caption" sx={{ display: 'block', opacity: 0.8, mt: 0.25 }}>
              Exam: {alert.examName}
            </Typography>
          )}

          {alert.description && (
            <Typography variant="caption" sx={{ display: 'block', opacity: 0.85, fontStyle: 'italic', mt: 0.5 }}>
              "{alert.description}"
            </Typography>
          )}
        </Box>

        <Box sx={{ display: 'flex', gap: 1, mt: 1.5, justifyContent: 'flex-end' }}>
          <Button
            size="small"
            variant="outlined"
            onClick={onClose}
            sx={{
              color: '#ffffff',
              borderColor: 'rgba(255, 255, 255, 0.4)',
              fontWeight: 700,
              textTransform: 'none',
              '&:hover': { borderColor: '#ffffff', bgcolor: 'rgba(255, 255, 255, 0.1)' }
            }}
          >
            Dismiss
          </Button>

          <Button
            size="small"
            variant="contained"
            onClick={handleViewStudent}
            startIcon={<ExternalLink size={14} />}
            sx={{
              bgcolor: '#ffffff',
              color: '#0f172a',
              fontWeight: 800,
              textTransform: 'none',
              '&:hover': { bgcolor: '#f1f5f9' }
            }}
          >
            View Student
          </Button>
        </Box>
      </MuiAlert>
    </Snackbar>
  );
};

export default LiveAlertModal;
