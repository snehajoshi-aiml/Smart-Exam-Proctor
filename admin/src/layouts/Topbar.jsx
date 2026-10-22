import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Box,
  Avatar,
  Menu,
  MenuItem,
  Tooltip,
  Badge,
  useTheme,
  Switch
} from '@mui/material';
import {
  Menu as MenuIcon,
  Sun,
  Moon,
  Bell,
  LogOut,
  User,
  ShieldCheck
} from 'lucide-react';

import useAuth from '../hooks/useAuth';
import useThemeMode from '../hooks/useThemeMode';
import useSocket from '../hooks/useSocket';

export const Topbar = ({ handleDrawerToggle }) => {
  const theme = useTheme();
  const { admin, logout } = useAuth();
  const { mode, toggleThemeMode } = useThemeMode();
  const { alertsList } = useSocket();

  const [anchorEl, setAnchorEl] = useState(null);
  const [alertsAnchorEl, setAlertsAnchorEl] = useState(null);

  const handleProfileMenuOpen = (event) => setAnchorEl(event.currentTarget);
  const handleProfileMenuClose = () => setAnchorEl(null);

  const handleAlertsMenuOpen = (event) => setAlertsAnchorEl(event.currentTarget);
  const handleAlertsMenuClose = () => setAlertsAnchorEl(null);

  const handleLogout = () => {
    handleProfileMenuClose();
    logout();
  };

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        backgroundColor: theme.palette.background.paper,
        borderBottom: `1px solid ${theme.palette.divider}`,
        color: theme.palette.text.primary,
        zIndex: (t) => t.zIndex.drawer + 1
      }}
    >
      <Toolbar sx={{ justifyContent: 'space-between', px: { xs: 2, sm: 3 }, minHeight: '70px !important' }}>
        {/* Mobile Toggle & Page Info */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <IconButton
            color="inherit"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ display: { md: 'none' } }}
          >
            <MenuIcon size={24} />
          </IconButton>
          <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: theme.palette.text.primary }}>
              System Admin Command Center
            </Typography>
            <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
              Real-Time Proctoring & Anomaly Oversight
            </Typography>
          </Box>
        </Box>

        {/* Right Actions */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {/* Light/Dark Mode Switch */}
          <Tooltip title={`Switch to ${mode === 'dark' ? 'Light' : 'Dark'} Mode`}>
            <Box
              onClick={toggleThemeMode}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                cursor: 'pointer',
                p: 0.8,
                px: 1.5,
                borderRadius: '20px',
                backgroundColor: theme.palette.surface.main,
                transition: 'all 0.2s'
              }}
            >
              {mode === 'dark' ? <Moon size={18} color="#818cf8" /> : <Sun size={18} color="#f59e0b" />}
              <Switch
                size="small"
                checked={mode === 'dark'}
                onChange={toggleThemeMode}
                color="primary"
                sx={{ pointerEvents: 'none' }}
              />
            </Box>
          </Tooltip>

          {/* Real-time Alerts Notification Bell */}
          <Tooltip title="Recent Alerts">
            <IconButton color="inherit" onClick={handleAlertsMenuOpen}>
              <Badge badgeContent={alertsList.length} color="error" max={99}>
                <Bell size={20} />
              </Badge>
            </IconButton>
          </Tooltip>

          {/* Alerts Dropdown Menu */}
          <Menu
            anchorEl={alertsAnchorEl}
            open={Boolean(alertsAnchorEl)}
            onClose={handleAlertsMenuClose}
            PaperProps={{
              sx: { width: 340, maxHeight: 420, borderRadius: 3, mt: 1.5 }
            }}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          >
            <Box sx={{ p: 2, borderBottom: `1px solid ${theme.palette.divider}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                Live Proctor Alerts
              </Typography>
              <Badge badgeContent={alertsList.length} color="error" size="small" />
            </Box>
            {alertsList.length === 0 ? (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  No active alerts recorded.
                </Typography>
              </Box>
            ) : (
              alertsList.slice(0, 5).map((a, idx) => (
                <MenuItem key={idx} onClick={handleAlertsMenuClose} sx={{ py: 1.5, px: 2, display: 'block' }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: theme.palette.error.main, display: 'block' }}>
                    {a.alertType || a.type || 'VIOLATION'}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.85rem' }}>
                    {a.message || a.description}
                  </Typography>
                  <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                    {a.studentName} ({a.studentId}) • {new Date(a.timestamp).toLocaleTimeString()}
                  </Typography>
                </MenuItem>
              ))
            )}
          </Menu>

          {/* Admin Avatar & Menu */}
          <Box
            onClick={handleProfileMenuOpen}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              cursor: 'pointer',
              p: 0.5,
              pr: 1.5,
              borderRadius: '24px',
              border: `1px solid ${theme.palette.divider}`,
              '&:hover': { backgroundColor: theme.palette.surface.main }
            }}
          >
            <Avatar
              sx={{
                width: 36,
                height: 36,
                bgcolor: theme.palette.primary.main,
                fontWeight: 700,
                fontSize: '0.9rem'
              }}
            >
              {admin?.name ? admin.name.charAt(0) : 'A'}
            </Avatar>
            <Box sx={{ display: { xs: 'none', lg: 'block' } }}>
              <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                {admin?.name || 'Admin User'}
              </Typography>
              <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                {admin?.role || 'Super Admin'}
              </Typography>
            </Box>
          </Box>

          {/* Profile Menu */}
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleProfileMenuClose}
            PaperProps={{
              sx: { width: 220, borderRadius: 3, mt: 1.5 }
            }}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          >
            <Box sx={{ p: 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                {admin?.name || 'Administrator'}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                {admin?.email || 'admin@proctor.com'}
              </Typography>
            </Box>
            <MenuItem onClick={handleProfileMenuClose} sx={{ py: 1.2, gap: 1.5 }}>
              <User size={18} />
              Profile Details
            </MenuItem>
            <MenuItem onClick={handleProfileMenuClose} sx={{ py: 1.2, gap: 1.5 }}>
              <ShieldCheck size={18} />
              Security Settings
            </MenuItem>
            <MenuItem onClick={handleLogout} sx={{ py: 1.2, gap: 1.5, color: theme.palette.error.main }}>
              <LogOut size={18} />
              Sign Out
            </MenuItem>
          </Menu>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Topbar;
