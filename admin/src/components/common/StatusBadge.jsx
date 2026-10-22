import React from 'react';
import { Box, Typography } from '@mui/material';

export const StatusBadge = ({ isTrue, trueText, falseText, trueColor = '#10b981', falseColor = '#ef4444' }) => {
  const color = isTrue ? trueColor : falseColor;
  const text = isTrue ? trueText : falseText;

  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.8,
        px: 1.2,
        py: 0.4,
        borderRadius: '8px',
        backgroundColor: `${color}18`,
        border: `1px solid ${color}33`
      }}
    >
      <Box
        sx={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          backgroundColor: color
        }}
      />
      <Typography
        variant="caption"
        sx={{
          fontWeight: 700,
          fontSize: '0.725rem',
          color: color
        }}
      >
        {text}
      </Typography>
    </Box>
  );
};

export default StatusBadge;
