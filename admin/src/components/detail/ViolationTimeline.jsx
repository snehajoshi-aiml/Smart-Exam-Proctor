import React from 'react';
import { Box, Typography, Card, CardContent, Chip, useTheme } from '@mui/material';
import { CheckCircle2 } from 'lucide-react';

export const ViolationTimeline = ({ violations = [] }) => {
  const theme = useTheme();

  return (
    <Card sx={{ height: '100%', borderRadius: 4 }}>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>
          Complete Violation Timeline
        </Typography>

        {violations.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center', backgroundColor: theme.palette.surface.main, borderRadius: 3 }}>
            <CheckCircle2 size={36} color="#10b981" style={{ marginBottom: 8 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#10b981' }}>
              Clean Proctoring Record
            </Typography>
            <Typography variant="caption" color="text.secondary">
              No violation anomalies flagged during this exam session.
            </Typography>
          </Box>
        ) : (
          <Box sx={{ position: 'relative', pl: 3, '&::before': { content: '""', position: 'absolute', top: 8, bottom: 8, left: 10, width: 2, backgroundColor: theme.palette.divider } }}>
            {violations.map((v, idx) => {
              const isHigh = v.severity === 'High' || v.severity === 'Critical';

              return (
                <Box key={idx} sx={{ position: 'relative', mb: 3 }}>
                  {/* Timeline Bullet */}
                  <Box
                    sx={{
                      position: 'absolute',
                      left: -28,
                      top: 4,
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      backgroundColor: isHigh ? '#ef4444' : '#f59e0b',
                      border: `3px solid ${theme.palette.background.paper}`,
                      boxShadow: `0 0 0 2px ${isHigh ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`
                    }}
                  />

                  <Box sx={{ p: 2, borderRadius: 3, backgroundColor: theme.palette.surface.main }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800, color: isHigh ? '#ef4444' : theme.palette.text.primary }}>
                        {v.type ? v.type.replace(/_/g, ' ') : v.event ? v.event.replace(/_/g, ' ') : 'Proctor Violation'}
                      </Typography>
                      <Chip
                        label={v.severity || 'Medium'}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: '0.675rem',
                          fontWeight: 800,
                          bgcolor: isHigh ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                          color: isHigh ? '#ef4444' : '#f59e0b'
                        }}
                      />
                    </Box>
                    <Typography variant="body2" color="text.primary" sx={{ mb: 0.5 }}>
                      {v.description || v.details || ''}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                      Logged at: {v.timestamp ? new Date(v.timestamp).toLocaleTimeString() : 'N/A'}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default ViolationTimeline;
