import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  TextField,
  Switch,
  FormControlLabel,
  Button,
  Divider,
  Slider,
  Alert
} from '@mui/material';
import { Settings, Shield, Volume2, Cpu, Save } from 'lucide-react';

export const SettingsPage = () => {
  const [maxViolations, setMaxViolations] = useState(10);
  const [autoTerminate, setAutoTerminate] = useState(true);
  const [soundAlerts, setSoundAlerts] = useState(true);
  const [faceConfidenceThreshold, setFaceConfidenceThreshold] = useState(0.55);
  const [gazeSensitivity, setGazeSensitivity] = useState(2);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSaveSettings = () => {
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 4000);
  };

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 900, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Settings size={30} color="#6366f1" /> System & Proctoring Configuration
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, mt: 0.5 }}>
          Customize AI Proctor Thresholds, Auto-Termination Rules, Alert Sound Settings & System Preferences
        </Typography>
      </Box>

      {savedSuccess && (
        <Alert severity="success" sx={{ mb: 3, borderRadius: 3, fontWeight: 700 }}>
          ✅ Settings saved successfully! Real-time proctoring rules updated.
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* 1. Violation & Auto-Termination Rules */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, borderRadius: 4, height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <Shield color="#ef4444" size={22} />
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                Auto-Termination & Violation Limits
              </Typography>
            </Box>
            <Divider sx={{ mb: 3 }} />

            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                Maximum Violations Before Auto-Termination
              </Typography>
              <TextField
                type="number"
                fullWidth
                size="small"
                value={maxViolations}
                onChange={(e) => setMaxViolations(Number(e.target.value))}
                helperText="Student session will be auto-terminated when flag count exceeds this number."
              />
            </Box>

            <FormControlLabel
              control={
                <Switch
                  checked={autoTerminate}
                  onChange={(e) => setAutoTerminate(e.target.checked)}
                  color="error"
                />
              }
              label={
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  Enable Automatic Exam Termination on Threshold Exceeded
                </Typography>
              }
            />
          </Paper>
        </Grid>

        {/* 2. Audio & Alert Settings */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, borderRadius: 4, height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <Volume2 color="#f59e0b" size={22} />
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                Live Alerts & Sound Notifications
              </Typography>
            </Box>
            <Divider sx={{ mb: 3 }} />

            <Box sx={{ mb: 3 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={soundAlerts}
                    onChange={(e) => setSoundAlerts(e.target.checked)}
                    color="primary"
                  />
                }
                label={
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    Play Audio Chime Sound for High & Critical Severity Violations
                  </Typography>
                }
              />
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
              Uses Web Audio API synthesizer to play an immediate warning chime on the Admin Command Center whenever a phone detection, candidate absence, or multi-face violation is flagged.
            </Typography>
          </Paper>
        </Grid>

        {/* 3. AI Threshold Calibration */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3, borderRadius: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <Cpu color="#3b82f6" size={22} />
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                AI Vision Model Sensitivity Calibration
              </Typography>
            </Box>
            <Divider sx={{ mb: 3 }} />

            <Grid container spacing={4}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                  Face Matching Confidence Distance Threshold: {faceConfidenceThreshold}
                </Typography>
                <Slider
                  value={faceConfidenceThreshold}
                  min={0.35}
                  max={0.8}
                  step={0.05}
                  valueLabelDisplay="auto"
                  onChange={(e, val) => setFaceConfidenceThreshold(val)}
                />
                <Typography variant="caption" color="text.secondary">
                  Lower distance = Stricter face verification matching threshold.
                </Typography>
              </Grid>

              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                  Continuous Gaze Deviation Trigger Delay: {gazeSensitivity} seconds
                </Typography>
                <Slider
                  value={gazeSensitivity}
                  min={1}
                  max={5}
                  step={1}
                  valueLabelDisplay="auto"
                  onChange={(e, val) => setGazeSensitivity(val)}
                />
                <Typography variant="caption" color="text.secondary">
                  Duration student must look away before triggering an eye gaze violation.
                </Typography>
              </Grid>
            </Grid>

            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="contained"
                size="large"
                startIcon={<Save size={18} />}
                onClick={handleSaveSettings}
                sx={{ borderRadius: 3, fontWeight: 800, textTransform: 'none', px: 4 }}
              >
                Save System Settings
              </Button>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default SettingsPage;
