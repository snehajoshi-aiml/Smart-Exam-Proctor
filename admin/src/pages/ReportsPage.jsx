import React, { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Tabs,
  Tab,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress
} from '@mui/material';
import { FileSpreadsheet, FileText, Download, BarChart2 } from 'lucide-react';
import { adminApi } from '../services/api';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';

export const ReportsPage = () => {
  const [timeframe, setTimeframe] = useState('daily');
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminApi.getReports({ timeframe });
      if (res.data && res.data.success) {
        setReportData(res.data);
      }
    } catch (err) {
      console.warn('Error fetching reports:', err);
    } finally {
      setLoading(false);
    }
  }, [timeframe]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const summary = reportData?.summary || {
    appeared: 0,
    finished: 0,
    terminated: 0,
    avgViolations: 0,
    mostCommonViolation: 'None',
    avgExamTime: '0h 0m'
  };

  const deptStats = reportData?.departmentStats || [];

  // Export to Excel / CSV
  const exportToExcel = (format = 'xlsx') => {
    const exportData = deptStats.map(d => ({
      'Department': d.department,
      'Students Appeared': d.appeared,
      'Students Finished': d.finished,
      'Students Terminated': d.terminated,
      'Average Violations per Student': d.avgViolations
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `${timeframe.toUpperCase()}_Report`);
    
    if (format === 'csv') {
      XLSX.writeFile(workbook, `Proctoring_${timeframe}_Report_${new Date().toISOString().split('T')[0]}.csv`, { bookType: 'csv' });
    } else {
      XLSX.writeFile(workbook, `Proctoring_${timeframe}_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
    }
  };

  // Export to PDF
  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(`Athena Smart Proctoring - ${timeframe.toUpperCase()} Summary Report`, 14, 20);

    doc.setFontSize(10);
    doc.text(`Generated Date: ${new Date().toLocaleString()}`, 14, 28);
    doc.text(`Students Appeared: ${summary.appeared} | Finished: ${summary.finished} | Terminated: ${summary.terminated}`, 14, 34);
    doc.text(`Avg Violations: ${summary.avgViolations} | Most Common: ${summary.mostCommonViolation} | Avg Exam Time: ${summary.avgExamTime}`, 14, 40);

    let startY = 52;
    doc.setFontSize(12);
    doc.text('Department-wise Statistics:', 14, startY);
    startY += 8;

    deptStats.forEach((d, i) => {
      doc.setFontSize(10);
      doc.text(`${i + 1}. ${d.department} — Appeared: ${d.appeared}, Finished: ${d.finished}, Terminated: ${d.terminated}, Avg Violations: ${d.avgViolations}`, 14, startY);
      startY += 8;
    });

    doc.save(`Proctoring_${timeframe}_Report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 900, display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <BarChart2 color="#6366f1" size={28} /> Automated Executive Proctoring Reports {loading && <CircularProgress size={20} color="primary" />}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, mt: 0.5 }}>
            Generate & Export Daily, Weekly, and Monthly Examination Audit Intelligence
          </Typography>
        </Box>

        {/* Export Buttons */}
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button variant="outlined" color="primary" startIcon={<Download size={16} />} onClick={() => exportToExcel('csv')} sx={{ fontWeight: 700, borderRadius: 3, textTransform: 'none' }}>
            Export CSV
          </Button>
          <Button variant="outlined" color="success" startIcon={<FileSpreadsheet size={16} />} onClick={() => exportToExcel('xlsx')} sx={{ fontWeight: 700, borderRadius: 3, textTransform: 'none' }}>
            Export Excel
          </Button>
          <Button variant="contained" color="error" startIcon={<FileText size={16} />} onClick={exportToPDF} sx={{ fontWeight: 700, borderRadius: 3, textTransform: 'none' }}>
            Export PDF
          </Button>
        </Box>
      </Box>

      {/* Timeframe Selection Tabs */}
      <Paper sx={{ mb: 3, borderRadius: 4 }}>
        <Tabs
          value={timeframe}
          onChange={(e, val) => setTimeframe(val)}
          indicatorColor="primary"
          textColor="primary"
          sx={{ px: 2 }}
        >
          <Tab label="📅 Daily Report" value="daily" sx={{ fontWeight: 800, textTransform: 'none' }} />
          <Tab label="📆 Weekly Report" value="weekly" sx={{ fontWeight: 800, textTransform: 'none' }} />
          <Tab label="📊 Monthly Report" value="monthly" sx={{ fontWeight: 800, textTransform: 'none' }} />
        </Tabs>
      </Paper>

      {/* Key Summary Cards */}
      <Grid container spacing={2.5} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={4} lg={2}>
          <Card sx={{ borderRadius: 4, bgcolor: 'background.paper', borderLeft: '4px solid #6366f1' }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>STUDENTS APPEARED</Typography>
              <Typography variant="h4" sx={{ fontWeight: 900, mt: 0.5 }}>{summary.appeared}</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={4} lg={2}>
          <Card sx={{ borderRadius: 4, bgcolor: 'background.paper', borderLeft: '4px solid #10b981' }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>STUDENTS FINISHED</Typography>
              <Typography variant="h4" sx={{ fontWeight: 900, color: '#10b981', mt: 0.5 }}>{summary.finished}</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={4} lg={2}>
          <Card sx={{ borderRadius: 4, bgcolor: 'background.paper', borderLeft: '4px solid #ef4444' }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>STUDENTS TERMINATED</Typography>
              <Typography variant="h4" sx={{ fontWeight: 900, color: '#ef4444', mt: 0.5 }}>{summary.terminated}</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={4} lg={2}>
          <Card sx={{ borderRadius: 4, bgcolor: 'background.paper', borderLeft: '4px solid #f59e0b' }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>AVG VIOLATIONS / STUDENT</Typography>
              <Typography variant="h4" sx={{ fontWeight: 900, color: '#f59e0b', mt: 0.5 }}>{summary.avgViolations}</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={4} lg={2}>
          <Card sx={{ borderRadius: 4, bgcolor: 'background.paper', borderLeft: '4px solid #ec4899' }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>MOST COMMON VIOLATION</Typography>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#ec4899', mt: 0.5 }}>{summary.mostCommonViolation}</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={4} lg={2}>
          <Card sx={{ borderRadius: 4, bgcolor: 'background.paper', borderLeft: '4px solid #3b82f6' }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>AVG EXAM TIME</Typography>
              <Typography variant="h4" sx={{ fontWeight: 900, mt: 0.5 }}>{summary.avgExamTime}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Department-wise Statistics Table */}
      <Paper sx={{ p: 3, borderRadius: 4 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>
          Department-wise Examination Breakdown ({timeframe.toUpperCase()})
        </Typography>

        <TableContainer>
          <Table>
            <TableHead sx={{ bgcolor: 'rgba(15, 23, 42, 0.6)' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 800 }}>Department Name</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Students Appeared</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Students Finished</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Students Terminated</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Avg Violations Rate</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {deptStats.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                    <Typography variant="h6" color="text.secondary">
                      No Reports
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                deptStats.map((d, idx) => (
                  <TableRow key={idx} hover>
                    <TableCell sx={{ fontWeight: 800 }}>{d.department}</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>{d.appeared}</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#10b981' }}>{d.finished}</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#ef4444' }}>{d.terminated}</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>{d.avgViolations} / student</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
};

export default ReportsPage;
