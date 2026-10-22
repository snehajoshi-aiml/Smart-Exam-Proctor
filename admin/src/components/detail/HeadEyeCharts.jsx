import React from 'react';
import { Card, CardContent, Typography, Box, Grid, useTheme } from '@mui/material';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { Activity } from 'lucide-react';

export const HeadEyeCharts = ({ headHistory = [], eyeHistory = [] }) => {
  const theme = useTheme();

  // Format Head Data for Recharts
  const chartData = headHistory.length > 0
    ? headHistory.map((h, i) => ({
        time: h.timestamp ? new Date(h.timestamp).toLocaleTimeString([], { minute: '2-digit', second: '2-digit' }) : `t-${i}`,
        pitch: h.pitch || 0,
        yaw: h.yaw || 0,
        roll: h.roll || 0
      }))
    : [
        { time: '10:00', pitch: 2, yaw: 1, roll: 0 },
        { time: '10:05', pitch: 5, yaw: -3, roll: 1 },
        { time: '10:10', pitch: -14, yaw: 18, roll: 4 },
        { time: '10:15', pitch: 3, yaw: 2, roll: 0 },
        { time: '10:20', pitch: 1, yaw: -1, roll: 0 }
      ];

  return (
    <Card sx={{ borderRadius: 4, mb: 3 }}>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <Activity size={22} color={theme.palette.primary.main} />
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            Head Movement & Eye Tracking Trajectory
          </Typography>
        </Box>

        <Grid container spacing={3}>
          {/* Head Pitch/Yaw/Roll Chart */}
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              Head Rotation (Pitch, Yaw, Roll in Degrees)
            </Typography>
            <Box sx={{ width: '100%', height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                  <XAxis dataKey="time" stroke={theme.palette.text.secondary} fontSize={12} />
                  <YAxis stroke={theme.palette.text.secondary} fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: theme.palette.background.paper,
                      borderColor: theme.palette.divider,
                      borderRadius: 8
                    }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="pitch" stroke="#6366f1" strokeWidth={2} name="Pitch" />
                  <Line type="monotone" dataKey="yaw" stroke="#f59e0b" strokeWidth={2} name="Yaw" />
                  <Line type="monotone" dataKey="roll" stroke="#10b981" strokeWidth={2} name="Roll" />
                </LineChart>
              </ResponsiveContainer>
            </Box>
          </Grid>

          {/* Eye Tracking Frequency */}
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              Gaze Off-Center Variations
            </Typography>
            <Box sx={{ width: '100%', height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={[
                    { time: '10:00', gazeDeviation: 5 },
                    { time: '10:05', gazeDeviation: 12 },
                    { time: '10:10', gazeDeviation: 85 },
                    { time: '10:15', gazeDeviation: 10 },
                    { time: '10:20', gazeDeviation: 8 }
                  ]}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                  <XAxis dataKey="time" stroke={theme.palette.text.secondary} fontSize={12} />
                  <YAxis stroke={theme.palette.text.secondary} fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: theme.palette.background.paper,
                      borderColor: theme.palette.divider,
                      borderRadius: 8
                    }}
                  />
                  <Line type="monotone" dataKey="gazeDeviation" stroke="#ef4444" strokeWidth={2} name="Gaze Deviation %" />
                </LineChart>
              </ResponsiveContainer>
            </Box>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};

export default HeadEyeCharts;
