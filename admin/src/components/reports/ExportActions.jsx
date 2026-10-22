import React from 'react';
import { Box, Button } from '@mui/material';
import { FileText, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';

export const ExportActions = ({ reports = [] }) => {
  const exportToExcel = () => {
    if (!reports || reports.length === 0) return;

    const exportData = reports.map((r) => ({
      'Report ID': r.reportId || r._id,
      'Student Name': r.studentName,
      'USN': r.usn,
      'Email': r.email,
      'Exam Name': r.examName,
      'Department': r.department,
      'Risk Level': r.riskLevel,
      'Total Violations': r.totalViolations,
      'Suspicious Count': r.suspiciousCount,
      'Cheating Score %': r.cheatingScore || 0,
      'Status': r.status,
      'Start Time': new Date(r.startTime).toLocaleString(),
      'End Time': r.endTime ? new Date(r.endTime).toLocaleString() : 'N/A'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Proctoring Reports');
    XLSX.writeFile(workbook, `Proctoring_Reports_${Date.now()}.xlsx`);
  };

  const exportToPDF = () => {
    if (!reports || reports.length === 0) return;

    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Athena Smart Proctoring - Audit Reports', 14, 22);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);
    doc.text(`Total Records: ${reports.length}`, 14, 36);

    let yPos = 48;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Student / USN', 14, yPos);
    doc.text('Exam Name', 65, yPos);
    doc.text('Risk', 130, yPos);
    doc.text('Violations', 155, yPos);
    doc.text('Status', 180, yPos);
    doc.line(14, yPos + 2, 195, yPos + 2);

    yPos += 8;
    doc.setFont('helvetica', 'normal');

    reports.forEach((r, idx) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
      doc.text(`${(r.studentName || 'Student').substring(0, 18)} (${r.usn || 'N/A'})`, 14, yPos);
      doc.text(`${(r.examName || '').substring(0, 22)}`, 65, yPos);
      doc.text(`${r.riskLevel || 'Low'}`, 130, yPos);
      doc.text(`${r.totalViolations || 0}`, 155, yPos);
      doc.text(`${r.status || 'Submitted'}`, 180, yPos);
      yPos += 7;
    });

    doc.save(`Proctoring_Audit_Report_${Date.now()}.pdf`);
  };

  return (
    <Box sx={{ display: 'flex', gap: 1.5 }}>
      <Button
        variant="outlined"
        color="success"
        startIcon={<Download size={16} />}
        onClick={exportToExcel}
        disabled={reports.length === 0}
        sx={{ fontWeight: 700, borderRadius: 2 }}
      >
        Export Excel
      </Button>

      <Button
        variant="contained"
        color="primary"
        startIcon={<FileText size={16} />}
        onClick={exportToPDF}
        disabled={reports.length === 0}
        sx={{ fontWeight: 700, borderRadius: 2 }}
      >
        Export PDF
      </Button>
    </Box>
  );
};

export default ExportActions;
