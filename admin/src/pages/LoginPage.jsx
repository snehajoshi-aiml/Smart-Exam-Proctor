import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  InputAdornment,
  Alert,
  IconButton,
  useTheme
} from '@mui/material';
import { ShieldCheck, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import useAuth from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

export const LoginPage = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState('admin@proctor.com');
  const [password, setPassword] = useState('Admin@123');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    const res = await login(email, password);
    setLoading(false);

    if (res.success) {
      navigate('/');
    } else {
      setErrorMsg(res.error || 'Authentication failed');
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: theme.palette.mode === 'dark'
          ? 'radial-gradient(circle at 50% 50%, #1e1b4b 0%, #0b0f19 100%)'
          : 'radial-gradient(circle at 50% 50%, #e0e7ff 0%, #f8fafc 100%)',
        p: 2
      }}
    >
      <Card
        sx={{
          maxWidth: 440,
          width: '100%',
          borderRadius: 4,
          p: 2,
          boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
          backdropFilter: 'blur(16px)',
          border: `1px solid ${theme.palette.divider}`
        }}
      >
        <CardContent sx={{ p: 3 }}>
          {/* Header */}
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: '20px',
                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                mb: 2,
                boxShadow: '0 10px 25px -5px rgba(99, 102, 241, 0.5)'
              }}
            >
              <ShieldCheck size={36} />
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.03em' }}>
              ATHENA PROCTOR
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, mt: 0.5 }}>
              Admin Control Center Portal
            </Typography>
          </Box>

          {errorMsg && (
            <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
              {errorMsg}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <TextField
                fullWidth
                label="Admin Email"
                variant="outlined"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Mail size={18} />
                    </InputAdornment>
                  )
                }}
              />

              <TextField
                fullWidth
                label="Password"
                type={showPassword ? 'text' : 'password'}
                variant="outlined"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Lock size={18} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />

              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={loading}
                endIcon={<ArrowRight size={20} />}
                sx={{
                  py: 1.5,
                  borderRadius: 3,
                  fontWeight: 800,
                  fontSize: '1rem',
                  background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                  boxShadow: '0 8px 20px -4px rgba(99, 102, 241, 0.5)'
                }}
              >
                {loading ? 'Authenticating...' : 'Sign In as Admin'}
              </Button>
            </Box>
          </form>

          {/* Quick Demo Credentials */}
          <Box sx={{ mt: 4, p: 2, borderRadius: 3, backgroundColor: theme.palette.surface.main, textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: 'block' }}>
              Default System Credentials:
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 700, color: theme.palette.primary.main }}>
              Email: admin@proctor.com | Password: Admin@123
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default LoginPage;
