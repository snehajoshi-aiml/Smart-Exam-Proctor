import React, { useEffect, useState } from 'react';
import { Box, Typography, Grid, Card, CardContent, useTheme } from '@mui/material';
import { ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import { adminApi } from '../services/api';
import MetricCard from '../components/common/MetricCard';
import { BookOpen, Users, AlertTriangle, ShieldAlert, CheckCircle2 } from 'lucide-react';

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#6366f1', '#3b82f6'];

export const AnalyticsPage = () => {
  const theme = useTheme();

  const [metrics, setMetrics] = useState({
    activeExams: 0,
    activeStudents: 0,
    violationsToday: 0,
    highRiskStudents: 0,
    examsCompleted: 0
  });

  const [riskData, setRiskData] = useState([
    { name: 'Low Risk', value: 0 },
    { name: 'Medium Risk', value: 0 },
    { name: 'High Risk', value: 0 }
  ]);

  const [violationsBreakdown, setViolationsBreakdown] = useState([
    { name: 'Mobile Phone', count: 0 },
    { name: 'Multiple Faces', count: 0 },
    { name: 'Tab Switches', count: 0 },
    { name: 'Copy/Paste', count: 0 },
    { name: 'Looking Away', count: 0 }
  ]);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const response = await adminApi.getAnalytics();
        if (response.data && response.data.success) {
          setMetrics(response.data.metrics || {
            activeExams: 0,
            activeStudents: 0,
            violationsToday: 0,
            highRiskStudents: 0,
            examsCompleted: 0
          });
          if (response.data.charts?.riskDistribution) {
            const rd = response.data.charts.riskDistribution;
            setRiskData([
              { name: 'Low Risk', value: rd.Low || 0 },
              { name: 'Medium Risk', value: rd.Medium || 0 },
              { name: 'High Risk', value: rd.High || 0 }
            ]);
          }
          if (response.data.charts?.violationsBreakdown) {
            setViolationsBreakdown(response.data.charts.violationsBreakdown);
          }
        }
      } catch (error) {
        console.error('Error fetching analytics:', error);
      }
    };

    fetchAnalytics();
  }, []);

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
          Proctoring System Analytics
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Aggregate risk distributions, anomaly frequencies, and performance metrics
        </Typography>
      </Box>

      {/* KPI Cards Row */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={2.4}>
          <MetricCard title="Active Exams" value={metrics.activeExams} subtitle="In session" icon={BookOpen} color="#6366f1" />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <MetricCard title="Active Students" value={metrics.activeStudents} subtitle="Online telemetry" icon={Users} color="#3b82f6" />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <MetricCard title="Violations Today" value={metrics.violationsToday} subtitle="Flagged anomalies" icon={AlertTriangle} color="#f59e0b" />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <MetricCard title="High Risk Students" value={metrics.highRiskStudents} subtitle="Action required" icon={ShieldAlert} color="#ef4444" />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
          <MetricCard title="Exams Completed" value={metrics.examsCompleted} subtitle="Archived reports" icon={CheckCircle2} color="#10b981" />
        </Grid>
      </Grid>

      {/* Analytical Charts Row */}
      <Grid container spacing={3}>
        {/* Risk Level Distribution Pie Chart */}
        <Grid item xs={12} md={6}>
          <Card sx={{ borderRadius: 4, height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>
                Student Risk Level Breakdown
              </Typography>
              <Box sx={{ width: '100%', height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={riskData}
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      label
                    >
                      {riskData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: theme.palette.background.paper, borderRadius: 8 }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Violations Frequency Bar Chart */}
        <Grid item xs={12} md={6}>
          <Card sx={{ borderRadius: 4, height: '100%' }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>
                Violations Frequency by Category
              </Typography>
              <Box sx={{ width: '100%', height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={violationsBreakdown}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                    <XAxis dataKey="name" stroke={theme.palette.text.secondary} fontSize={12} />
                    <YAxis stroke={theme.palette.text.secondary} fontSize={12} />
                    <Tooltip contentStyle={{ backgroundColor: theme.palette.background.paper, borderRadius: 8 }} />
                    <Bar dataKey="count" fill="#6366f1" radius={[8, 8, 0, 0]} name="Violation Count" />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default AnalyticsPage;
