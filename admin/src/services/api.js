import axios from 'axios';

const getAdminBaseUrl = () => {
  const envUrl = 
    process.env.REACT_APP_API_URL || 
    process.env.VITE_API_URL || 
    process.env.NEXT_PUBLIC_API_URL || 
    process.env.REACT_APP_BACKEND_URL;

  if (envUrl) {
    return `${envUrl.replace(/\/$/, '')}/api`;
  }

  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return 'https://athena-proctor-8.onrender.com/api';
  }

  return 'http://localhost:5000/api';
};

const API_BASE_URL = getAdminBaseUrl();



const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add Authorization header token to request if present
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('adminToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminData');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Comprehensive Admin API Endpoints
export const adminApi = {
  // 1. Auth
  login: (credentials) => api.post('/admin/login', credentials),

  // 2. Dashboard & Overview Statistics
  getDashboard: () => api.get('/admin/dashboard'),

  // 3. Live Student Monitoring
  getLiveStudents: (params) => api.get('/admin/students/live', { params }),

  // 4. Student Details Page
  getStudentDetail: (id) => api.get(`/admin/student/${id}`),

  // 5. Violations Center
  getViolations: (params) => api.get('/admin/violations', { params }),

  // 6. Terminated Students
  getTerminatedStudents: (params) => api.get('/admin/terminated', { params }),

  // 7. Finished Students
  getFinishedStudents: (params) => api.get('/admin/finished', { params }),

  // 8. Reports & Analytics
  getReports: (params) => api.get('/admin/reports', { params }),
  getAnalytics: () => api.get('/admin/analytics'),
  getAlerts: () => api.get('/admin/alerts'),

  // 9. Admin Session Control Actions
  terminateSession: (studentId, reason) => api.post('/admin/terminate-session', { studentId, reason }),
  warnStudent: (studentId, message) => api.post('/admin/warn-student', { studentId, message })
};

export default api;
