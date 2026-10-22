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
import { CheckCircle, FileSpreadsheet, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../services/api';
import FilterPanel from '../components/common/FilterPanel';
import RiskChip from '../components/common/RiskChip';
import * as XLSX from 'xlsx';

export const FinishedStudentsPage = () => {
  const navigate = useNavigate();

  const [finishedStudents, setFinishedStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchFinishedStudents = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminApi.getFinishedStudents({
        search: searchQuery,
        department: departmentFilter !== 'all' ? departmentFilter : undefined,
        statusFilter: statusFilter !== 'all' ? statusFilter : undefined
      });

      if (res.data && res.data.success) {
        setFinishedStudents(res.data.finishedStudents || []);
      }
    } catch (err) {
      console.warn('Error fetching finished students:', err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, departmentFilter, statusFilter]);

  useEffect(() => {
    fetchFinishedStudents();
  }, [fetchFinishedStudents]);

  const exportToExcel = () => {
    const exportData = finishedStudents.map(s => ({
      'Student Name': s.studentName,
      'USN / Reg No': s.usn || s.studentId,
      'Email': s.email,
      'Department': s.department,
      'Exam Name': s.examName,
      'Start Time': new Date(s.startTime).toLocaleTimeString(),
      'End Time': new Date(s.endTime || s.updatedAt).toLocaleTimeString(),
      'Duration': s.duration || '1h 45m',
      'Total Violations': s.totalViolations || 0,
      'Risk Score': s.riskScore || 10,
      'Monitoring Status': s.monitoringStatus || 'Passed Monitoring'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Finished Students');
    XLSX.writeFile(workbook, `Finished_Students_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 900, display: 'flex', alignItems: 'center', gap: 1.5, color: '#10b981' }}>
            <CheckCircle size={30} color="#10b981" /> Finished Exams & Completion Records
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, mt: 0.5 }}>
            Students Who Successfully Completed Monitoring & Submitted Answers
          </Typography>
        </Box>

        <Button
          variant="outlined"
          color="success"
          startIcon={<FileSpreadsheet size={16} />}
          onClick={exportToExcel}
          sx={{ fontWeight: 700, borderRadius: 3, textTransform: 'none' }}
        >
          Export Excel (XLSX)
        </Button>
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
          setStatusFilter('all');
        }}
      />

      {/* Finished Students Table */}
      <TableContainer component={Paper} sx={{ borderRadius: 4, boxShadow: 3 }}>
        <Table sx={{ minWidth: 850 }}>
          <TableHead sx={{ bgcolor: 'rgba(16, 185, 129, 0.08)' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 800 }}>Student Name & USN</TableCell>
              <TableCell sx={{ fontWeight: 800 }}>Exam Name</TableCell>
              <TableCell sx={{ fontWeight: 800 }}>Start / End Time</TableCell>
              <TableCell sx={{ fontWeight: 800 }}>Duration</TableCell>
              <TableCell sx={{ fontWeight: 800 }}>Violations</TableCell>
              <TableCell sx={{ fontWeight: 800 }}>AI Risk Score</TableCell>
              <TableCell sx={{ fontWeight: 800 }}>Monitoring Status</TableCell>
              <TableCell align="right" sx={{ fontWeight: 800 }}>Actions</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 5 }}>
                  <Typography variant="body2" color="text.secondary">
                    Loading Finished Student Records...
                  </Typography>
                </TableCell>
              </TableRow>
            ) : finishedStudents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 5 }}>
                  <Typography variant="h6" color="text.secondary">
                    No Finished Exams
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              finishedStudents.map((s, idx) => (
                <TableRow key={s._id || idx} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Avatar sx={{ bgcolor: '#10b981', width: 34, height: 34, fontSize: '0.85rem', fontWeight: 800 }}>
                        {s.studentName ? s.studentName.charAt(0) : 'F'}
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
                      {new Date(s.startTime).toLocaleTimeString()} - {new Date(s.endTime || s.updatedAt).toLocaleTimeString()}
                    </Typography>
                  </TableCell>

                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {s.duration || '1h 45m'}
                    </Typography>
                  </TableCell>

                  <TableCell>
                    <Chip
                      label={`${s.totalViolations || 0} Flags`}
                      color={s.totalViolations > 2 ? 'warning' : 'default'}
                      size="small"
                      sx={{ fontWeight: 800 }}
                    />
                  </TableCell>

                  <TableCell>
                    <RiskChip score={s.riskScore} size="small" />
                  </TableCell>

                  <TableCell>
                    <Chip
                      label={s.monitoringStatus || 'Passed Monitoring'}
                      color={s.monitoringStatus === 'Needs Review' ? 'warning' : 'success'}
                      size="small"
                      sx={{ fontWeight: 800 }}
                    />
                  </TableCell>

                  <TableCell align="right">
                    <Tooltip title="View Complete Activity Timeline">
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

export default FinishedStudentsPage;
