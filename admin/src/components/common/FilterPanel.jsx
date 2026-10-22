import React from 'react';
import { Paper, Box, TextField, InputAdornment, MenuItem, Select, FormControl, InputLabel, Button } from '@mui/material';
import { Search, RefreshCw, X } from 'lucide-react';

export const FilterPanel = ({
  searchQuery = '',
  onSearchChange,
  statusFilter = 'all',
  onStatusChange,
  riskFilter = 'all',
  onRiskChange,
  departmentFilter = 'all',
  onDepartmentChange,
  violationFilter = 'all',
  onViolationChange,
  onResetFilters
}) => {
  return (
    <Paper sx={{ p: 2.5, borderRadius: 4, mb: 3, bgcolor: 'background.paper' }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
        {/* Search Bar */}
        <Box sx={{ flex: '1 1 280px', minWidth: 260 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search by Student Name, USN, Email, Exam, Dept..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={18} />
                </InputAdornment>
              ),
              endAdornment: searchQuery ? (
                <InputAdornment position="end">
                  <X size={16} style={{ cursor: 'pointer' }} onClick={() => onSearchChange('')} />
                </InputAdornment>
              ) : null
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 3
              }
            }}
          />
        </Box>

        {/* Status Filter */}
        {onStatusChange && (
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              label="Status"
              onChange={(e) => onStatusChange(e.target.value)}
              sx={{ borderRadius: 3 }}
            >
              <MenuItem value="all">All Statuses</MenuItem>
              <MenuItem value="Online">🟢 Active (Online)</MenuItem>
              <MenuItem value="Warning">🟡 Warning</MenuItem>
              <MenuItem value="Terminated">🔴 Terminated</MenuItem>
              <MenuItem value="Finished">⚪ Finished</MenuItem>
            </Select>
          </FormControl>
        )}

        {/* Risk Level Filter */}
        {onRiskChange && (
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Risk Score Level</InputLabel>
            <Select
              value={riskFilter}
              label="Risk Score Level"
              onChange={(e) => onRiskChange(e.target.value)}
              sx={{ borderRadius: 3 }}
            >
              <MenuItem value="all">All Risk Levels</MenuItem>
              <MenuItem value="Safe">Safe (0-20)</MenuItem>
              <MenuItem value="Warning">Warning (21-50)</MenuItem>
              <MenuItem value="High Risk">High Risk (51-75)</MenuItem>
              <MenuItem value="Terminate">Terminate (76-100)</MenuItem>
            </Select>
          </FormControl>
        )}

        {/* Department Filter */}
        {onDepartmentChange && (
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Department</InputLabel>
            <Select
              value={departmentFilter}
              label="Department"
              onChange={(e) => onDepartmentChange(e.target.value)}
              sx={{ borderRadius: 3 }}
            >
              <MenuItem value="all">All Departments</MenuItem>
              <MenuItem value="Computer Science & Engineering">Computer Science</MenuItem>
              <MenuItem value="Information Science & Tech">Information Science</MenuItem>
              <MenuItem value="Electronics & Communication">Electronics & Comm</MenuItem>
              <MenuItem value="Mechanical Engineering">Mechanical Eng</MenuItem>
              <MenuItem value="Civil Engineering">Civil Eng</MenuItem>
            </Select>
          </FormControl>
        )}

        {/* Violation Type Filter */}
        {onViolationChange && (
          <FormControl size="small" sx={{ minWidth: 170 }}>
            <InputLabel>Violation Type</InputLabel>
            <Select
              value={violationFilter}
              label="Violation Type"
              onChange={(e) => onViolationChange(e.target.value)}
              sx={{ borderRadius: 3 }}
            >
              <MenuItem value="all">All Violation Types</MenuItem>
              <MenuItem value="phone_detected">📱 Phone Detected</MenuItem>
              <MenuItem value="gaze_away">👁 Gaze Deviation</MenuItem>
              <MenuItem value="multiple_faces">👥 Multiple Faces</MenuItem>
              <MenuItem value="no_face">⚠️ Candidate Absent</MenuItem>
              <MenuItem value="tab_switch">📑 Tab Switch</MenuItem>
              <MenuItem value="earphones_detected">🎧 Earphones Detected</MenuItem>
            </Select>
          </FormControl>
        )}

        {/* Reset Button */}
        {onResetFilters && (
          <Button
            variant="outlined"
            size="small"
            onClick={onResetFilters}
            startIcon={<RefreshCw size={14} />}
            sx={{ borderRadius: 3, textTransform: 'none', fontWeight: 700, px: 2, height: 40 }}
          >
            Reset
          </Button>
        )}
      </Box>
    </Paper>
  );
};

export default FilterPanel;
