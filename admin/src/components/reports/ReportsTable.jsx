import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  useTheme
} from '@mui/material';
import { Eye } from 'lucide-react';
import RiskChip from '../common/RiskChip';
import { useNavigate } from 'react-router-dom';

export const ReportsTable = ({ reports = [], loading = false }) => {
  const theme = useTheme();
  const navigate = useNavigate();

  return (
    <TableContainer component={Paper} sx={{ borderRadius: 4, boxShadow: 'none', border: `1px solid ${theme.palette.divider}` }}>
      <Table sx={{ minWidth: 750 }}>
        <TableHead sx={{ backgroundColor: theme.palette.surface.main }}>
          <TableRow>
            <TableCell sx={{ fontWeight: 800 }}>Student / USN</TableCell>
            <TableCell sx={{ fontWeight: 800 }}>Exam Name</TableCell>
            <TableCell sx={{ fontWeight: 800 }}>Department</TableCell>
            <TableCell sx={{ fontWeight: 800 }}>Risk Level</TableCell>
            <TableCell sx={{ fontWeight: 800 }}>Violations</TableCell>
            <TableCell sx={{ fontWeight: 800 }}>Status</TableCell>
            <TableCell sx={{ fontWeight: 800 }} align="right">Action</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {reports.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} align="center" sx={{ py: 5 }}>
                <Typography variant="body1" color="text.secondary">
                  No exam reports found.
                </Typography>
              </TableCell>
            </TableRow>
          ) : (
            reports.map((r, idx) => (
              <TableRow key={r.reportId || idx} hover>
                <TableCell>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    {r.studentName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    USN: {r.usn} | {r.email}
                  </Typography>
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{r.examName}</TableCell>
                <TableCell>{r.department}</TableCell>
                <TableCell>
                  <RiskChip level={r.riskLevel} />
                </TableCell>
                <TableCell>
                  <Chip
                    label={`${r.totalViolations || 0} Flags`}
                    size="small"
                    sx={{
                      fontWeight: 700,
                      bgcolor: r.totalViolations > 3 ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)',
                      color: r.totalViolations > 3 ? '#ef4444' : '#10b981'
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Chip size="small" label={r.status || 'Submitted'} color="primary" variant="outlined" sx={{ fontWeight: 600 }} />
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="View Student Detail">
                    <IconButton
                      color="primary"
                      onClick={() => navigate(`/student/${r.studentId || r.reportId}`)}
                    >
                      <Eye size={18} />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default ReportsTable;
