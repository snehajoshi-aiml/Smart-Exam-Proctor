import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Box, useTheme } from '@mui/material';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import AlertToast from '../components/common/AlertToast';

export const MainLayout = () => {
  const theme = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: theme.palette.background.default }}>
      {/* Sidebar Navigation */}
      <Sidebar mobileOpen={mobileOpen} handleDrawerToggle={handleDrawerToggle} />

      {/* Main Content Area */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - 260px)` },
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <Topbar handleDrawerToggle={handleDrawerToggle} />
        
        <Box sx={{ p: { xs: 2, sm: 3, md: 4 }, flexGrow: 1 }}>
          <Outlet />
        </Box>
      </Box>

      {/* Global Real-Time Alert Toast Popup */}
      <AlertToast />
    </Box>
  );
};

export default MainLayout;
