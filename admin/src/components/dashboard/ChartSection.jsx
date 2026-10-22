import React from 'react';
import { Grid, Card, CardContent, Typography, Box, useTheme } from '@mui/material';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Bar, Doughnut, Pie } from 'react-chartjs-2';
import { TrendingUp, AlertOctagon, PieChart as PieIcon, Users, Layers, ShieldAlert } from 'lucide-react';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export const ChartSection = ({ chartsData }) => {
  const theme = useTheme();

  const isDark = theme.palette.mode === 'dark';
  const textColor = isDark ? '#cbd5e1' : '#475569';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';

  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: textColor,
          font: { family: 'Segoe UI, sans-serif', weight: '700', size: 11 }
        }
      },
      tooltip: {
        backgroundColor: '#0f172a',
        titleColor: '#38bdf8',
        bodyColor: '#f8fafc',
        borderColor: '#334155',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8
      }
    },
    scales: {
      x: {
        grid: { color: gridColor },
        ticks: { color: textColor, font: { weight: '600', size: 10 } }
      },
      y: {
        grid: { color: gridColor },
        ticks: { color: textColor, font: { weight: '600', size: 10 } }
      }
    }
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          color: textColor,
          font: { family: 'Segoe UI, sans-serif', weight: '700', size: 11 }
        }
      }
    }
  };

  // Fallback / default Chart.js datasets if props loading
  const activeStudentsData = chartsData?.activeStudentsChart || {
    labels: ['09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '01:00 PM', '02:00 PM', '03:00 PM'],
    datasets: [
      {
        label: 'Active Students Writing Exam',
        data: [12, 35, 78, 110, 95, 84, 92],
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99, 102, 241, 0.15)',
        fill: true,
        tension: 0.4
      }
    ]
  };

  const violationsPerHourData = chartsData?.violationsPerHour || {
    labels: ['09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '01:00 PM', '02:00 PM', '03:00 PM'],
    datasets: [
      {
        label: 'Violations Flagged',
        data: [2, 6, 14, 21, 10, 16, 8],
        backgroundColor: '#ef4444',
        borderRadius: 6
      }
    ]
  };

  const violationTypesData = chartsData?.violationTypes || {
    labels: ['Phone Detected', 'Gaze Away', 'Multiple Faces', 'Candidate Absent', 'Tab Switched', 'Voice Detected'],
    datasets: [
      {
        data: [8, 22, 5, 4, 31, 12],
        backgroundColor: ['#ef4444', '#f59e0b', '#ec4899', '#8b5cf6', '#3b82f6', '#10b981']
      }
    ]
  };

  const finishedVsTerminatedData = chartsData?.finishedVsTerminated || {
    labels: ['Finished (Clean)', 'Terminated (Violations)'],
    datasets: [
      {
        data: [115, 3],
        backgroundColor: ['#10b981', '#ef4444']
      }
    ]
  };

  const departmentStatsData = chartsData?.departmentStats || {
    labels: ['Computer Science', 'Information Tech', 'Electronics', 'Mechanical', 'Civil'],
    datasets: [
      {
        label: 'Active Students',
        data: [45, 32, 22, 14, 8],
        backgroundColor: '#6366f1',
        borderRadius: 6
      },
      {
        label: 'Violations Flagged',
        data: [12, 6, 8, 3, 1],
        backgroundColor: '#ef4444',
        borderRadius: 6
      }
    ]
  };

  const riskScoreDistributionData = chartsData?.riskScoreDistribution || {
    labels: ['Safe (0-20)', 'Warning (21-50)', 'High Risk (51-75)', 'Terminate (76-100)'],
    datasets: [
      {
        data: [88, 22, 8, 2],
        backgroundColor: ['#10b981', '#f59e0b', '#f97316', '#ef4444']
      }
    ]
  };

  return (
    <Grid container spacing={3}>
      {/* 1. Active Students Over Time (Line Chart) */}
      <Grid item xs={12} lg={8}>
        <Card sx={{ borderRadius: 4, height: 360 }}>
          <CardContent sx={{ p: 3, height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <TrendingUp size={20} color={theme.palette.primary.main} />
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                Active Students Writing Exam (Real-Time Trend)
              </Typography>
            </Box>
            <Box sx={{ height: 270 }}>
              <Line data={activeStudentsData} options={commonOptions} />
            </Box>
          </CardContent>
        </Card>
      </Grid>

      {/* 2. Finished vs Terminated (Doughnut Chart) */}
      <Grid item xs={12} lg={4}>
        <Card sx={{ borderRadius: 4, height: 360 }}>
          <CardContent sx={{ p: 3, height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <PieIcon size={20} color="#10b981" />
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                Finished vs Terminated Status
              </Typography>
            </Box>
            <Box sx={{ height: 270 }}>
              <Doughnut data={finishedVsTerminatedData} options={doughnutOptions} />
            </Box>
          </CardContent>
        </Card>
      </Grid>

      {/* 3. Violations per Hour (Bar Chart) */}
      <Grid item xs={12} lg={6}>
        <Card sx={{ borderRadius: 4, height: 360 }}>
          <CardContent sx={{ p: 3, height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <AlertOctagon size={20} color="#ef4444" />
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                Violations Flagged per Hour
              </Typography>
            </Box>
            <Box sx={{ height: 270 }}>
              <Bar data={violationsPerHourData} options={commonOptions} />
            </Box>
          </CardContent>
        </Card>
      </Grid>

      {/* 4. Violation Types Distribution (Pie Chart) */}
      <Grid item xs={12} lg={6}>
        <Card sx={{ borderRadius: 4, height: 360 }}>
          <CardContent sx={{ p: 3, height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <Layers size={20} color="#f59e0b" />
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                Violation Types Breakdown
              </Typography>
            </Box>
            <Box sx={{ height: 270 }}>
              <Pie data={violationTypesData} options={doughnutOptions} />
            </Box>
          </CardContent>
        </Card>
      </Grid>

      {/* 5. Department Statistics (Grouped Bar Chart) */}
      <Grid item xs={12} lg={7}>
        <Card sx={{ borderRadius: 4, height: 360 }}>
          <CardContent sx={{ p: 3, height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <Users size={20} color="#3b82f6" />
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                Department-wise Examination & Violation Stats
              </Typography>
            </Box>
            <Box sx={{ height: 270 }}>
              <Bar data={departmentStatsData} options={commonOptions} />
            </Box>
          </CardContent>
        </Card>
      </Grid>

      {/* 6. Risk Score Distribution (Doughnut Chart) */}
      <Grid item xs={12} lg={5}>
        <Card sx={{ borderRadius: 4, height: 360 }}>
          <CardContent sx={{ p: 3, height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <ShieldAlert size={20} color="#ec4899" />
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                AI Student Risk Score Distribution
              </Typography>
            </Box>
            <Box sx={{ height: 270 }}>
              <Doughnut data={riskScoreDistributionData} options={doughnutOptions} />
            </Box>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};

export default ChartSection;
