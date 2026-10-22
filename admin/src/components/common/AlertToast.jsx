import React from 'react';
import { Snackbar, Alert, AlertTitle, Box, Typography, Button } from '@mui/material';
import { PhoneOff, Users, EyeOff, ShieldAlert, MonitorOff, WifiOff } from 'lucide-react';
import useSocket from '../../hooks/useSocket';
import { useNavigate } from 'react-router-dom';

const getAlertIcon = (type) => {
  switch (type) {
    case 'MOBILE_PHONE_DETECTED':
      return <PhoneOff size={22} />;
    case 'MULTIPLE_FACES':
      return <Users size={22} />;
    case 'STUDENT_LEFT_CAMERA':
      return <EyeOff size={22} />;
    case 'TAB_SWITCHING':
      return <MonitorOff size={22} />;
    case 'BROWSER_MINIMIZED':
      return <MonitorOff size={22} />;
    case 'LOOKING_AWAY_CONTINUOUSLY':
      return <EyeOff size={22} />;
    case 'INTERNET_DISCONNECTED':
      return <WifiOff size={22} />;
    default:
      return <ShieldAlert size={22} />;
  }
};

export const AlertToast = () => {
  const { activeAlert, dismissAlert } = useSocket();
  const navigate = useNavigate();

  if (!activeAlert) return null;

  const handleInspect = () => {
    if (activeAlert.studentId) {
      navigate(`/student/${activeAlert.studentId}`);
    }
    dismissAlert();
  };

  return (
    <Snackbar
      open={Boolean(activeAlert)}
      autoHideDuration={8000}
      onClose={dismissAlert}
      anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      sx={{ mt: 7 }}
    >
      <Alert
        onClose={dismissAlert}
        severity="error"
        variant="filled"
        icon={getAlertIcon(activeAlert.type)}
        sx={{
          width: '100%',
          maxWidth: 420,
          borderRadius: 3,
          boxShadow: '0 12px 28px rgba(239, 68, 68, 0.4)',
          backgroundColor: '#dc2626',
          color: '#ffffff',
          '& .MuiAlert-icon': {
            alignItems: 'center'
          }
        }}
      >
        <AlertTitle sx={{ fontWeight: 800, fontSize: '0.95rem' }}>
          PROCTOR ALERT: {activeAlert.type.replace(/_/g, ' ')}
        </AlertTitle>
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
          {activeAlert.message}
        </Typography>
        <Typography variant="caption" sx={{ opacity: 0.9, display: 'block', mb: 1 }}>
          Student: <strong>{activeAlert.studentName}</strong> ({activeAlert.studentId}) • {activeAlert.timestamp}
        </Typography>
        {activeAlert.studentId && (
          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
            <Button
              size="small"
              variant="contained"
              onClick={handleInspect}
              sx={{
                bgcolor: '#ffffff',
                color: '#dc2626',
                fontWeight: 700,
                fontSize: '0.75rem',
                '&:hover': { bgcolor: '#f1f5f9' }
              }}
            >
              Inspect Student Stream
            </Button>
          </Box>
        )}
      </Alert>
    </Snackbar>
  );
};

export default AlertToast;
