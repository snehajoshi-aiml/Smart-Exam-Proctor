import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography, Chip, Grid, Divider, Paper } from '@mui/material';
import { ShieldAlert, Camera } from 'lucide-react';

export const ViolationDetailModal = ({ violation, open, onClose }) => {
  if (!violation) return null;

  const severityColor = violation.severity === 'Critical' ? '#ef4444' : violation.severity === 'High' ? '#f97316' : violation.severity === 'Medium' ? '#f59e0b' : '#3b82f6';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 4, bgcolor: '#0f172a', color: '#f8fafc', border: '1px solid #1e293b' } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1e293b', pb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <ShieldAlert size={24} color={severityColor} />
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            Proctoring Violation Detail
          </Typography>
        </Box>
        <Chip
          label={`Severity: ${violation.severity || 'Medium'}`}
          sx={{ fontWeight: 800, bgcolor: severityColor, color: '#ffffff' }}
        />
      </DialogTitle>

      <DialogContent sx={{ py: 3 }}>
        <Grid container spacing={3}>
          {/* Left Column: Violation Info & Metadata */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2.5, borderRadius: 3, bgcolor: 'rgba(30, 41, 59, 0.5)', border: '1px solid #1e293b' }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 700, mb: 1 }}>
                VIOLATION SUMMARY
              </Typography>

              <Box sx={{ mb: 2 }}>
                <Typography variant="h5" sx={{ fontWeight: 800, color: '#38bdf8' }}>
                  {violation.type ? violation.type.replace(/_/g, ' ').toUpperCase() : 'SUSPICIOUS EVENT'}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.5 }}>
                  {violation.description || 'AI Proctoring anomaly detected during active exam session.'}
                </Typography>
              </Box>

              <Divider sx={{ my: 2, borderColor: '#1e293b' }} />

              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Student Name</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {violation.studentName || violation.studentId}
                  </Typography>
                </Grid>

                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">USN / Email</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {violation.usn || violation.email || 'N/A'}
                  </Typography>
                </Grid>

                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Exam Name</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {violation.examName || 'Computer Science Final Assessment'}
                  </Typography>
                </Grid>

                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Timestamp</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {violation.timestamp ? new Date(violation.timestamp).toLocaleString() : 'Just Now'}
                  </Typography>
                </Grid>

                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">AI Confidence Score</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 800, color: '#34d399' }}>
                    {violation.confidence ? `${(violation.confidence * 100).toFixed(1)}%` : '98.5%'}
                  </Typography>
                </Grid>

                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">Status</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: '#f59e0b' }}>
                    {violation.status || 'Flagged for Review'}
                  </Typography>
                </Grid>
              </Grid>
            </Paper>
          </Grid>

          {/* Right Column: Screenshot Evidence Frame */}
          <Grid item xs={12} md={6}>
            <Box sx={{ borderRadius: 3, overflow: 'hidden', border: '1px solid #1e293b', bgcolor: '#000', minHeight: 240, position: 'relative' }}>
              {violation.screenshotBase64 || violation.screenshot ? (
                <img
                  src={violation.screenshotBase64 || violation.screenshot}
                  alt="Captured Evidence Frame"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              ) : (
                <Box sx={{ p: 4, textAlign: 'center', color: '#94a3b8' }}>
                  <Camera size={48} style={{ opacity: 0.5, marginBottom: 8 }} />
                  <Typography variant="body2">No frame screenshot available for this violation event.</Typography>
                </Box>
              )}
              <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, p: 1, bgcolor: 'rgba(0,0,0,0.75)', color: '#fff', fontSize: '0.75rem', textAlign: 'center' }}>
                📸 Automated Evidence Snapshot Captured at {violation.timestamp ? new Date(violation.timestamp).toLocaleTimeString() : 'Session Time'}
              </Box>
            </Box>
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions sx={{ borderTop: '1px solid #1e293b', px: 3, py: 2 }}>
        <Button onClick={onClose} variant="contained" sx={{ bgcolor: '#334155', color: '#fff', fontWeight: 700, '&:hover': { bgcolor: '#475569' } }}>
          Close Details
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ViolationDetailModal;
