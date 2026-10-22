import React, { useState } from 'react';
import { Grid, Box, Typography, TextField, MenuItem, InputAdornment } from '@mui/material';
import { Search, Filter } from 'lucide-react';
import StudentCard from './StudentCard';
import VideoStreamModal from './VideoStreamModal';

export const StudentGrid = ({ students = [], loading = false }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [riskFilter, setRiskFilter] = useState('ALL');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const filteredStudents = students.filter((s) => {
    const matchesSearch =
      s.studentName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.usn?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.examName?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRisk =
      riskFilter === 'ALL' || s.riskLevel?.toUpperCase() === riskFilter;

    return matchesSearch && matchesRisk;
  });

  const handleWatchLive = (student) => {
    setSelectedStudent(student);
    setModalOpen(true);
  };

  return (
    <Box>
      {/* Search and Filters Bar */}
      <Box sx={{ mb: 3, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, justifyContent: 'space-between' }}>
        <TextField
          placeholder="Search by student name, USN, email, or exam..."
          variant="outlined"
          size="small"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{ width: { xs: '100%', sm: 360 } }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search size={18} />
              </InputAdornment>
            )
          }}
        />

        <TextField
          select
          size="small"
          label="Filter Risk Level"
          value={riskFilter}
          onChange={(e) => setRiskFilter(e.target.value)}
          sx={{ minWidth: 160 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Filter size={16} />
              </InputAdornment>
            )
          }}
        >
          <MenuItem value="ALL">All Risk Levels</MenuItem>
          <MenuItem value="HIGH">High Risk Only</MenuItem>
          <MenuItem value="MEDIUM">Medium Risk Only</MenuItem>
          <MenuItem value="LOW">Low Risk Only</MenuItem>
        </TextField>
      </Box>

      {/* Grid of Student Cards */}
      {filteredStudents.length === 0 ? (
        <Box sx={{ p: 5, textAlign: 'center', backgroundColor: 'background.paper', borderRadius: 4 }}>
          <Typography variant="h6" color="text.secondary">
            No active students matching criteria.
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={3}>
          {filteredStudents.map((student) => (
            <Grid item xs={12} sm={6} md={4} key={student.sessionId || student.studentId}>
              <StudentCard student={student} onWatchLive={handleWatchLive} />
            </Grid>
          ))}
        </Grid>
      )}

      {/* Modal for Watching Stream */}
      <VideoStreamModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        student={selectedStudent}
      />
    </Box>
  );
};

export default StudentGrid;
