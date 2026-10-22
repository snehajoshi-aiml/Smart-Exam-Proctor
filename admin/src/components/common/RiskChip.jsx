import React from 'react';
import { Chip } from '@mui/material';
import { ShieldCheck, AlertTriangle, ShieldAlert, XCircle } from 'lucide-react';

/**
 * Calculates Risk Score Category and Badge Properties
 * 0–20: Safe (Green)
 * 21–50: Warning (Yellow/Amber)
 * 51–75: High Risk (Orange)
 * 76–100: Terminate (Red)
 */
export function getRiskDetails(scoreInput, levelInput) {
  let score = typeof scoreInput === 'number' ? scoreInput : null;
  let category = levelInput || 'Safe';

  if (score !== null) {
    if (score >= 76) category = 'Terminate';
    else if (score >= 51) category = 'High Risk';
    else if (score >= 21) category = 'Warning';
    else category = 'Safe';
  }

  switch (category) {
    case 'Terminate':
    case 'Terminated':
    case 'Critical':
      return {
        label: `Terminate (${score !== null ? score : '76+'})`,
        color: '#ef4444',
        bgcolor: 'rgba(239, 68, 68, 0.15)',
        borderColor: '#ef4444',
        icon: <XCircle size={14} color="#ef4444" />,
        score: score ?? 90
      };
    case 'High Risk':
    case 'High':
      return {
        label: `High Risk (${score !== null ? score : '51-75'})`,
        color: '#f97316',
        bgcolor: 'rgba(249, 115, 22, 0.15)',
        borderColor: '#f97316',
        icon: <ShieldAlert size={14} color="#f97316" />,
        score: score ?? 65
      };
    case 'Warning':
    case 'Medium':
      return {
        label: `Warning (${score !== null ? score : '21-50'})`,
        color: '#f59e0b',
        bgcolor: 'rgba(245, 158, 11, 0.15)',
        borderColor: '#f59e0b',
        icon: <AlertTriangle size={14} color="#f59e0b" />,
        score: score ?? 35
      };
    case 'Safe':
    case 'Low':
    default:
      return {
        label: `Safe (${score !== null ? score : '0-20'})`,
        color: '#10b981',
        bgcolor: 'rgba(16, 185, 129, 0.15)',
        borderColor: '#10b981',
        icon: <ShieldCheck size={14} color="#10b981" />,
        score: score ?? 10
      };
  }
}

export const RiskChip = ({ score, level, size = 'medium' }) => {
  const details = getRiskDetails(score, level);

  return (
    <Chip
      icon={details.icon}
      label={details.label}
      size={size}
      sx={{
        fontWeight: 800,
        fontSize: size === 'small' ? '0.725rem' : '0.8rem',
        color: details.color,
        backgroundColor: details.bgcolor,
        border: `1px solid ${details.borderColor}`,
        borderRadius: 2,
        '& .MuiChip-icon': {
          color: details.color
        }
      }}
    />
  );
};

export default RiskChip;
