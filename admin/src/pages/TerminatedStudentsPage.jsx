import React, { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  Avatar,
  IconButton,
  Tooltip
} from '@mui/material';
import { XCircle, FileSpreadsheet, FileText, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../services/api';
import FilterPanel from '../components/common/FilterPanel';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';

export const TerminatedStudentsPage = () => {
  const navigate = useNavigate();

  const [terminatedStudents, setTerminatedStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');

  const fetchTerminatedStudents = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminApi.getTerminatedStudents({
        search: searchQuery,
        department: departmentFilter !== 'all' ? departmentFilter : undefined
      });

      if (res.data && res.data.success) {
        setTerminatedStudents(res.data.terminatedStudents || []);
      }
    } catch (err) {
      console.warn('Error fetching terminated students:', err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, departmentFilter]);

  useEffect(() => {
    fetchTerminatedStudents();
  }, [fetchTerminatedStudents]);

  // Export to CSV / Excel
  const exportToExcel = () => {
    const exportData = terminatedStudents.map(s => ({
      'Student Name': s.studentName,
      'USN / Reg No': s.usn || s.studentId,
      'Email': s.email,
      'Department': s.department,
      'Exam Name': s.examName,
      'Termination Time': new Date(s.terminationTime || s.updatedAt).toLocaleString(),
      'Termination Reason': s.terminationReason || 'Exceeded violation threshold',
      'Total Violations': s.totalViolations || 0,
      'Risk Score': s.riskScore || 100
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Terminated Students');
    XLSX.writeFile(workbook, `Terminated_Students_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Export to PDF
  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Athena Smart Proctoring - Terminated Students Report', 14, 20);

    doc.setFontSize(10);
    doc.text(`Generated Date: ${new Date().toLocaleString()}`, 14, 28);
    doc.text(`Total Terminated Students: ${terminatedStudents.length}`, 14, 34);

    let startY = 46;
    terminatedStudents.forEach((s, i) => {
      if (startY > 270) {
        doc.addPage();
        startY = 20;
      }
      doc.setFontSize(11);
      doc.text(`${i + 1}. ${s.studentName} (${s.usn || s.studentId}) - Exam: ${s.examName}`, 14, startY);
      doc.setFontSize(9);
      doc.text(`Reason: ${s.terminationReason || 'Exceeded threshold'} | Violations: ${s.totalViolations || 0} | Time: ${new Date(s.terminationTime || s.updatedAt).toLocaleTimeString()}`, 14, startY + 5);
      startY += 14;
    });

    doc.save(`Terminated_Students_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 900, display: 'flex', alignItems: 'center', gap: 1.5, color: '#ef4444' }}>
            <XCircle size={30} color="#ef4444" /> Terminated Students Oversight
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, mt: 0.5 }}>
            Students Whose Exam Sessions Were Auto-Terminated Due to Severe Malpractice
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button
            variant="outlined"
            color="success"
            startIcon={<FileSpreadsheet size={16} />}
            onClick={exportToExcel}
            sx={{ fontWeight: 700, borderRadius: 3, textTransform: 'none' }}
          >
            Export Excel (XLSX)
          </Button>

          <Button
            variant="contained"
            color="error"
            startIcon={<FileText size={16} />}
            onClick={exportToPDF}
            sx={{ fontWeight: 700, borderRadius: 3, textTransform: 'none' }}
          >
            Export PDF Report
          </Button>
        </Box>
      </Box>

      {/* Filter Panel */}
      <FilterPanel
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        departmentFilter={departmentFilter}
        onDepartmentChange={setDepartmentFilter}
        onResetFilters={() => {
          setSearchQuery('');
          setDepartmentFilter('all');
        }}
      />

      {/* Terminated Students Table */}
      <TableContainer component={Paper} sx={{ borderRadius: 4, boxShadow: 3 }}>
        <Table sx={{ minWidth: 800 }}>
          <TableHead sx={{ bgcolor: 'rgba(239, 68, 68, 0.08)' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 800 }}>Student Name & USN</TableCell>
              <TableCell sx={{ fontWeight: 800 }}>Exam Name</TableCell>
              <TableCell sx={{ fontWeight: 800 }}>Termination Time</TableCell>
              <TableCell sx={{ fontWeight: 800 }}>Termination Reason</TableCell>
              <TableCell sx={{ fontWeight: 800 }}>Total Violations</TableCell>
              <TableCell sx={{ fontWeight: 800 }}>Status</TableCell>
              <TableCell align="right" sx={{ fontWeight: 800 }}>Actions</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 5 }}>
                  <Typography variant="body2" color="text.secondary">
                    Loading Terminated Student Records...
                  </Typography>
                </TableCell>
              </TableRow>
            ) : terminatedStudents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 5 }}>
                  <Typography variant="h6" color="text.secondary">
                    No Terminated Exams
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              terminatedStudents.map((s, idx) => (
                <TableRow key={s._id || idx} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Avatar sx={{ bgcolor: '#ef4444', width: 34, height: 34, fontSize: '0.85rem', fontWeight: 800 }}>
                        {s.studentName ? s.studentName.charAt(0) : 'T'}
                      </Avatar>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                          {s.studentName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          USN: {s.usn || s.studentId} | {s.email}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>

                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {s.examName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {s.department}
                    </Typography>
                  </TableCell>

                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {new Date(s.terminationTime || s.updatedAt).toLocaleTimeString()}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(s.terminationTime || s.updatedAt).toLocaleDateString()}
                    </Typography>
                  </TableCell>

                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#ef4444' }}>
                      {s.terminationReason || 'Exceeded violation threshold (10 violations)'}
                    </Typography>
                  </TableCell>

                  <TableCell>
                    <Chip
                      label={`${s.totalViolations || 10} Violations`}
                      color="error"
                      size="small"
                      sx={{ fontWeight: 800 }}
                    />
                  </TableCell>

                  <TableCell>
                    <Chip label="🔴 Terminated" color="error" size="small" variant="filled" sx={{ fontWeight: 800 }} />
                  </TableCell>

                  <TableCell align="right">
                    <Tooltip title="View Full Evidence & Timeline">
                      <IconButton
                        color="primary"
                        onClick={() => navigate(`/student/${s.studentId || s.usn}`)}
                      >
                        <ExternalLink size={18} />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default TerminatedStudentsPage;
