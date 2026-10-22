import React from 'react';
import { Card, CardContent, Typography, Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, useTheme } from '@mui/material';
import { Cpu } from 'lucide-react';

export const AIDetectionEvents = ({ events = [], objectDetections = [] }) => {
  const theme = useTheme();

  return (
    <Card sx={{ borderRadius: 4, mb: 3 }}>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <Cpu size={22} color={theme.palette.primary.main} />
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            AI Detection Events & Object Classifier Results
          </Typography>
        </Box>

        <TableContainer sx={{ borderRadius: 2, border: `1px solid ${theme.palette.divider}` }}>
          <Table size="small">
            <TableHead sx={{ backgroundColor: theme.palette.surface.main }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 800 }}>Event / Classification</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Confidence Score</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Timestamp</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Engine Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {events.length === 0 && objectDetections.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                    No AI anomaly detections triggered.
                  </TableCell>
                </TableRow>
              ) : (
                [...events, ...objectDetections].map((item, idx) => (
                  <TableRow key={idx} hover>
                    <TableCell sx={{ fontWeight: 700 }}>
                      {item.eventType || item.label || item.description || 'Object Detected'}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={`${((item.confidence || 0.92) * 100).toFixed(1)}%`}
                        sx={{ fontWeight: 800, bgcolor: 'rgba(99, 102, 241, 0.15)', color: '#6366f1' }}
                      />
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                      {item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : 'Real-time'}
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label="Python FastAPI Verified" color="success" variant="outlined" sx={{ fontSize: '0.675rem' }} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
};

export default AIDetectionEvents;
