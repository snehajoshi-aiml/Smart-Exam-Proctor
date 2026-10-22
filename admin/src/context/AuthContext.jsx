import React, { createContext, useState, useEffect, useContext } from 'react';
import { adminApi } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [admin, setAdmin] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('adminToken') || null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedAdmin = localStorage.getItem('adminData');
    const storedToken = localStorage.getItem('adminToken');
    if (storedAdmin && storedToken) {
      try {
        setAdmin(JSON.parse(storedAdmin));
        setToken(storedToken);
      } catch (e) {
        localStorage.removeItem('adminData');
        localStorage.removeItem('adminToken');
      }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      const response = await adminApi.login({ email, password });
      if (response.data && response.data.success) {
        const { token, admin } = response.data;
        localStorage.setItem('adminToken', token);
        localStorage.setItem('adminData', JSON.stringify(admin));
        setToken(token);
        setAdmin(admin);
        return { success: true };
      }
      return { success: false, error: response.data.error || 'Login failed' };
    } catch (error) {
      const msg = error.response?.data?.error || 'Invalid credentials or connection error';
      return { success: false, error: msg };
    }
  };

  const logout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminData');
    setAdmin(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider
      value={{
        admin,
        token,
        isAuthenticated: !!token,
        loading,
        login,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
