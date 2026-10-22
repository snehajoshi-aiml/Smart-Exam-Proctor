import React, { useEffect, useState } from 'react';
import { Grid, Card, CardContent, Typography, Box, Skeleton, Button } from '@mui/material';
import { Users, UserCheck, PlayCircle, CheckCircle, XCircle, UserX, BookOpen, AlertTriangle, RefreshCw } from 'lucide-react';
import { adminApi } from '../services/api';
import { useSocket } from '../context/SocketContext';
import ChartSection from '../components/dashboard/ChartSection';
import LiveAlertModal from '../components/common/LiveAlertModal';

export const DashboardPage = () => {
  const { lastAlert, clearLastAlert } = useSocket();

  const [stats, setStats] = useState({
    registeredStudents: 0,
    attendedToday: 0,
    currentlyWriting: 0,
    finishedExam: 0,
    terminated: 0,
    absent: 0,
    activeExams: 0,
    violationsToday: 0
  });

  const [charts, setCharts] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const res = await adminApi.getDashboard();
      if (res.data && res.data.success) {
        if (res.data.stats) setStats(res.data.stats);
        if (res.data.charts) setCharts(res.data.charts);
      }
    } catch (err) {
      console.warn('Dashboard fetch notice, using real-time fallback stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 10000);
    return () => clearInterval(interval);
  }, []);

  const statCards = [
    {
      title: 'Total Students Registered',
      value: stats.registeredStudents,
      icon: <Users size={24} color="#6366f1" />,
      bgcolor: 'rgba(99, 102, 241, 0.12)',
      border: '#6366f1'
    },
    {
      title: 'Attended Exam Today',
      value: stats.attendedToday,
      icon: <UserCheck size={24} color="#06b6d4" />,
      bgcolor: 'rgba(6, 182, 212, 0.12)',
      border: '#06b6d4'
    },
    {
      title: 'Currently Writing Exam',
      value: stats.currentlyWriting,
      badge: '🟢 Active Live',
      icon: <PlayCircle size={24} color="#10b981" />,
      bgcolor: 'rgba(16, 185, 129, 0.15)',
      border: '#10b981'
    },
    {
      title: 'Finished Exam',
      value: stats.finishedExam,
      badge: '⚪ Completed',
      icon: <CheckCircle size={24} color="#3b82f6" />,
      bgcolor: 'rgba(59, 130, 246, 0.12)',
      border: '#3b82f6'
    },
    {
      title: 'Students Terminated',
      value: stats.terminated,
      badge: '🔴 Terminated',
      icon: <XCircle size={24} color="#ef4444" />,
      bgcolor: 'rgba(239, 68, 68, 0.15)',
      border: '#ef4444'
    },
    {
      title: 'Students Absent',
      value: stats.absent,
      icon: <UserX size={24} color="#64748b" />,
      bgcolor: 'rgba(100, 116, 139, 0.12)',
      border: '#64748b'
    },
    {
      title: 'Total Active Exams',
      value: stats.activeExams,
      icon: <BookOpen size={24} color="#8b5cf6" />,
      bgcolor: 'rgba(139, 92, 246, 0.12)',
      border: '#8b5cf6'
    },
    {
      title: 'Total Violations Today',
      value: stats.violationsToday,
      badge: '🚨 Flagged',
      icon: <AlertTriangle size={24} color="#f59e0b" />,
      bgcolor: 'rgba(245, 158, 11, 0.15)',
      border: '#f59e0b'
    }
  ];

  return (
    <Box>
      {/* Real-time Alert Toast Notification */}
      <LiveAlertModal alert={lastAlert} onClose={clearLastAlert} />

      {/* Header Banner */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 900 }}>
            Proctoring Command Center Overview
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, mt: 0.5 }}>
            Real-Time AI Examination Oversight, Violation Detection & Analytics
          </Typography>
        </Box>

        <Button
          variant="outlined"
          onClick={fetchDashboardData}
          startIcon={<RefreshCw size={16} />}
          sx={{ borderRadius: 3, fontWeight: 700, textTransform: 'none' }}
        >
          Refresh Live Stats
        </Button>
      </Box>

      {/* 8 Real-time Summary Cards Grid */}
      <Grid container spacing={2.5} sx={{ mb: 4 }}>
        {statCards.map((card, idx) => (
          <Grid item xs={12} sm={6} md={3} key={idx}>
            <Card
              sx={{
                borderRadius: 4,
                bgcolor: 'background.paper',
                borderLeft: `4px solid ${card.border}`,
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                transition: 'all 0.2s',
                '&:hover': { transform: 'translateY(-2px)' }
              }}
            >
              <CardContent sx={{ p: 2.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {card.title}
                  </Typography>
                  <Box sx={{ p: 1, borderRadius: 2.5, bgcolor: card.bgcolor, display: 'flex' }}>
                    {card.icon}
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mt: 1.5 }}>
                  {loading ? (
                    <Skeleton width={60} height={40} />
                  ) : (
                    <Typography variant="h3" sx={{ fontWeight: 900, color: 'text.primary' }}>
                      {card.value}
                    </Typography>
                  )}

                  {card.badge && (
                    <Typography variant="caption" sx={{ fontWeight: 800, px: 1, py: 0.4, borderRadius: 1.5, bgcolor: card.bgcolor, color: card.border }}>
                      {card.badge}
                    </Typography>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Real-time Chart.js Analytics Section */}
      <ChartSection chartsData={charts} />
    </Box>
  );
};

export default DashboardPage;
