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
  TablePagination,
  Chip,
  Button,
  IconButton,
  Avatar,
  Tooltip
} from '@mui/material';
import { ShieldAlert, Camera, ExternalLink, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../services/api';
import FilterPanel from '../components/common/FilterPanel';
import ViolationDetailModal from '../components/common/ViolationDetailModal';

export const ViolationsPage = () => {
  const navigate = useNavigate();

  const [violations, setViolations] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(15);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [violationTypeFilter, setViolationTypeFilter] = useState('all');
  const [timeframeFilter, setTimeframeFilter] = useState('all');

  // Modal inspection state
  const [selectedViolation, setSelectedViolation] = useState(null);

  const fetchViolations = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page: page + 1,
        limit: rowsPerPage,
        search: searchQuery,
        severity: severityFilter !== 'all' ? severityFilter : undefined,
        violationType: violationTypeFilter !== 'all' ? violationTypeFilter : undefined,
        timeframe: timeframeFilter !== 'all' ? timeframeFilter : undefined
      };

      const res = await adminApi.getViolations(params);
      if (res.data && res.data.success) {
        setViolations(res.data.violations || []);
        setTotalCount(res.data.total || (res.data.violations || []).length);
      }
    } catch (err) {
      console.warn('Error fetching violations:', err);
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, searchQuery, severityFilter, violationTypeFilter, timeframeFilter]);

  useEffect(() => {
    fetchViolations();
  }, [fetchViolations]);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const getSeverityBadge = (severity) => {
    const sev = severity || 'Medium';
    const colorMap = {
      Critical: { bgcolor: '#991b1b', color: '#ffffff' },
      High: { bgcolor: '#c2410c', color: '#ffffff' },
      Medium: { bgcolor: '#d97706', color: '#ffffff' },
      Low: { bgcolor: '#2563eb', color: '#ffffff' }
    };

    const style = colorMap[sev] || colorMap.Medium;

    return (
      <Chip
        label={sev}
        size="small"
        sx={{
          fontWeight: 800,
          fontSize: '0.725rem',
          bgcolor: style.bgcolor,
          color: style.color
        }}
      />
    );
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 900, display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <ShieldAlert color="#ef4444" size={28} /> AI Proctoring Violations Center
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, mt: 0.5 }}>
            Searchable & Filterable Record of All Detected Exam Malpractice & Anomalies
          </Typography>
        </Box>

        <Button
          variant="outlined"
          startIcon={<RefreshCw size={16} />}
          onClick={fetchViolations}
          sx={{ borderRadius: 3, fontWeight: 700, textTransform: 'none' }}
        >
          Refresh Violations
        </Button>
      </Box>

      {/* Filter Panel */}
      <FilterPanel
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        riskFilter={severityFilter}
        onRiskChange={setSeverityFilter}
        violationFilter={violationTypeFilter}
        onViolationChange={setViolationTypeFilter}
        onResetFilters={() => {
          setSearchQuery('');
          setSeverityFilter('all');
          setViolationTypeFilter('all');
          setTimeframeFilter('all');
          setPage(0);
        }}
      />

      {/* Violations Data Table */}
      <TableContainer component={Paper} sx={{ borderRadius: 4, boxShadow: 3, mb: 2 }}>
        <Table sx={{ minWidth: 800 }}>
          <TableHead sx={{ bgcolor: 'rgba(15, 23, 42, 0.6)' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 800 }}>Student Name & USN</TableCell>
              <TableCell sx={{ fontWeight: 800 }}>Exam Name</TableCell>
              <TableCell sx={{ fontWeight: 800 }}>Violation Type</TableCell>
              <TableCell sx={{ fontWeight: 800 }}>Time</TableCell>
              <TableCell sx={{ fontWeight: 800 }}>Severity</TableCell>
              <TableCell sx={{ fontWeight: 800 }}>Screenshot Frame</TableCell>
              <TableCell sx={{ fontWeight: 800 }}>Status</TableCell>
              <TableCell align="right" sx={{ fontWeight: 800 }}>Action</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 5 }}>
                  <Typography variant="body2" color="text.secondary">
                    Loading Violations Database...
                  </Typography>
                </TableCell>
              </TableRow>
            ) : violations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 5 }}>
                  <Typography variant="h6" color="text.secondary">
                    No Violations
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              violations.map((row) => (
                <TableRow
                  key={row._id || row.id}
                  hover
                  onClick={() => setSelectedViolation(row)}
                  sx={{ cursor: 'pointer', transition: 'background-color 0.2s' }}
                >
                  {/* Student */}
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Avatar sx={{ bgcolor: '#6366f1', width: 36, height: 36, fontWeight: 800, fontSize: '0.85rem' }}>
                        {row.studentName ? row.studentName.charAt(0) : 'S'}
                      </Avatar>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                          {row.studentName || 'Student'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          USN: {row.usn || row.studentId || 'N/A'}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>

                  {/* Exam Name */}
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {row.examName || 'Final Exam'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {row.department || 'General'}
                    </Typography>
                  </TableCell>

                  {/* Violation Type */}
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 800, color: '#ef4444' }}>
                      {row.type ? row.type.replace(/_/g, ' ').toUpperCase() : 'SUSPICIOUS EVENT'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Conf: {row.confidence ? `${(row.confidence * 100).toFixed(1)}%` : 'N/A'}
                    </Typography>
                  </TableCell>

                  {/* Timestamp */}
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {row.timestamp ? new Date(row.timestamp).toLocaleTimeString() : 'Just Now'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {row.timestamp ? new Date(row.timestamp).toLocaleDateString() : ''}
                    </Typography>
                  </TableCell>

                  {/* Severity Badge */}
                  <TableCell>{getSeverityBadge(row.severity)}</TableCell>

                  {/* Screenshot Thumbnail Preview */}
                  <TableCell>
                    {row.screenshotBase64 || row.screenshot ? (
                      <Box
                        sx={{
                          width: 50,
                          height: 34,
                          borderRadius: 1.5,
                          overflow: 'hidden',
                          border: '1px solid #334155',
                          bgcolor: '#000'
                        }}
                      >
                        <img
                          src={row.screenshotBase64 || row.screenshot}
                          alt="Violation Frame"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      </Box>
                    ) : (
                      <Camera size={18} color="#64748b" />
                    )}
                  </TableCell>

                  {/* Status */}
                  <TableCell>
                    <Chip
                      label={row.status || 'Flagged'}
                      size="small"
                      variant="outlined"
                      sx={{ fontWeight: 700, fontSize: '0.7rem' }}
                    />
                  </TableCell>

                  {/* Action */}
                  <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                    <Tooltip title="View Student Details">
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => navigate(`/student/${row.studentId || row.usn}`)}
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

        <TablePagination
          rowsPerPageOptions={[10, 15, 25, 50]}
          component="div"
          count={totalCount}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </TableContainer>

      {/* Complete Violation Details Inspection Modal */}
      <ViolationDetailModal
        violation={selectedViolation}
        open={Boolean(selectedViolation)}
        onClose={() => setSelectedViolation(null)}
      />
    </Box>
  );
};

export default ViolationsPage;
