import React from 'react';
import { Card, CardContent, Typography, Box, useTheme } from '@mui/material';

export const MetricCard = ({ title, value, subtitle, icon: Icon, color = '#6366f1', trend }) => {
  const theme = useTheme();

  return (
    <Card
      sx={{
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: theme.palette.mode === 'dark'
            ? `0 12px 24px -6px ${color}40`
            : `0 12px 24px -6px ${color}25`
        }
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box>
            <Typography variant="subtitle2" sx={{ color: theme.palette.text.secondary, fontWeight: 700, mb: 0.5 }}>
              {title}
            </Typography>
            <Typography variant="h3" sx={{ fontWeight: 800, color: theme.palette.text.primary, letterSpacing: '-0.03em' }}>
              {value}
            </Typography>
          </Box>
          <Box
            sx={{
              width: 52,
              height: 52,
              borderRadius: '16px',
              backgroundColor: `${color}18`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: color,
              border: `1px solid ${color}33`
            }}
          >
            {Icon && <Icon size={26} />}
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontWeight: 600 }}>
            {subtitle}
          </Typography>
          {trend && (
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                color: trend.startsWith('+') ? '#10b981' : '#ef4444',
                bgcolor: trend.startsWith('+') ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                px: 1,
                py: 0.2,
                borderRadius: '6px'
              }}
            >
              {trend}
            </Typography>
          )}
        </Box>
      </CardContent>

      {/* Decorative Gradient Bar */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 4,
          background: `linear-gradient(90deg, ${color} 0%, ${color}88 100%)`
        }}
      />
    </Card>
  );
};

export default MetricCard;
