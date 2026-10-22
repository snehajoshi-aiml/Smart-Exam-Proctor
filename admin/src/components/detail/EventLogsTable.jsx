import React from 'react';
import { Card, CardContent, Typography, Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Grid, useTheme } from '@mui/material';
import { FileText, Globe } from 'lucide-react';

export const EventLogsTable = ({ eventLogs = [], browserActivity = [] }) => {
  const theme = useTheme();

  return (
    <Grid container spacing={3} component={Box}>
      {/* Event Logs Table */}
      <Grid item xs={12} md={6}>
        <Card sx={{ borderRadius: 4, height: '100%' }}>
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <FileText size={20} color={theme.palette.primary.main} />
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                System Event Logs
              </Typography>
            </Box>

            <TableContainer sx={{ borderRadius: 2, border: `1px solid ${theme.palette.divider}` }}>
              <Table size="small">
                <TableHead sx={{ backgroundColor: theme.palette.surface.main }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 800 }}>Event</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Details</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Time</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {eventLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                        No system events logged.
                      </TableCell>
                    </TableRow>
                  ) : (
                    eventLogs.map((log, idx) => (
                      <TableRow key={idx} hover>
                        <TableCell sx={{ fontWeight: 700 }}>{log.event || 'System Event'}</TableCell>
                        <TableCell sx={{ fontSize: '0.85rem' }}>{log.details}</TableCell>
                        <TableCell sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                          {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : 'N/A'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Grid>

      {/* Browser Activity Table */}
      <Grid item xs={12} md={6}>
        <Card sx={{ borderRadius: 4, height: '100%' }}>
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <Globe size={20} color={theme.palette.primary.main} />
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                Browser Activity & Focus Monitor
              </Typography>
            </Box>

            <TableContainer sx={{ borderRadius: 2, border: `1px solid ${theme.palette.divider}` }}>
              <Table size="small">
                <TableHead sx={{ backgroundColor: theme.palette.surface.main }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 800 }}>Action</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Browser Status</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Time</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {browserActivity.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                        Browser focus maintained continuously.
                      </TableCell>
                    </TableRow>
                  ) : (
                    browserActivity.map((b, idx) => (
                      <TableRow key={idx} hover>
                        <TableCell sx={{ fontWeight: 700 }}>{b.action || 'Tab Action'}</TableCell>
                        <TableCell sx={{ fontSize: '0.85rem' }}>{b.details}</TableCell>
                        <TableCell sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                          {b.timestamp ? new Date(b.timestamp).toLocaleTimeString() : 'N/A'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};

export default EventLogsTable;
