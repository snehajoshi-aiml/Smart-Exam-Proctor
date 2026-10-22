import React, { createContext, useState, useContext, useMemo } from 'react';
import { createTheme, ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

const ThemeModeContext = createContext(null);

export const CustomThemeProvider = ({ children }) => {
  const [mode, setMode] = useState(localStorage.getItem('adminThemeMode') || 'dark');

  const toggleThemeMode = () => {
    setMode((prevMode) => {
      const nextMode = prevMode === 'dark' ? 'light' : 'dark';
      localStorage.setItem('adminThemeMode', nextMode);
      return nextMode;
    });
  };

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          ...(mode === 'dark'
            ? {
                primary: { main: '#6366f1', light: '#818cf8', dark: '#4f46e5' },
                secondary: { main: '#ec4899', light: '#f472b6', dark: '#db2777' },
                background: { default: '#0b0f19', paper: '#111827' },
                surface: { main: '#1f2937' },
                text: { primary: '#f9fafb', secondary: '#9ca3af' },
                success: { main: '#10b981' },
                warning: { main: '#f59e0b' },
                error: { main: '#ef4444' },
                info: { main: '#3b82f6' }
              }
            : {
                primary: { main: '#4f46e5', light: '#6366f1', dark: '#4338ca' },
                secondary: { main: '#db2777', light: '#ec4899', dark: '#be185d' },
                background: { default: '#f8fafc', paper: '#ffffff' },
                surface: { main: '#f1f5f9' },
                text: { primary: '#0f172a', secondary: '#64748b' },
                success: { main: '#059669' },
                warning: { main: '#d97706' },
                error: { main: '#dc2626' },
                info: { main: '#2563eb' }
              })
        },
        typography: {
          fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
          h1: { fontWeight: 800 },
          h2: { fontWeight: 800 },
          h3: { fontWeight: 700 },
          h4: { fontWeight: 700 },
          h5: { fontWeight: 600 },
          h6: { fontWeight: 600 },
          subtitle1: { fontWeight: 500 },
          subtitle2: { fontWeight: 500 },
          button: { textTransform: 'none', fontWeight: 600 }
        },
        shape: {
          borderRadius: 12
        },
        components: {
          MuiPaper: {
            styleOverrides: {
              root: {
                backgroundImage: 'none',
                boxShadow: mode === 'dark' ? '0 4px 20px 0 rgba(0,0,0,0.35)' : '0 4px 20px 0 rgba(0,0,0,0.05)'
              }
            }
          },
          MuiButton: {
            styleOverrides: {
              root: {
                borderRadius: 10,
                boxShadow: 'none',
                '&:hover': {
                  boxShadow: 'none'
                }
              }
            }
          },
          MuiCard: {
            styleOverrides: {
              root: {
                borderRadius: 16,
                border: mode === 'dark' ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.06)'
              }
            }
          }
        }
      }),
    [mode]
  );

  return (
    <ThemeModeContext.Provider value={{ mode, toggleThemeMode }}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeModeContext.Provider>
  );
};

export const useThemeMode = () => {
  const context = useContext(ThemeModeContext);
  if (!context) {
    throw new Error('useThemeMode must be used within a CustomThemeProvider');
  }
  return context;
};
