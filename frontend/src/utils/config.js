// Centralized API Base URL configuration for Local Dev and Production (Vercel)
export const getApiBaseUrl = () => {
  const envUrl = 
    process.env.REACT_APP_API_URL || 
    process.env.VITE_API_URL || 
    process.env.NEXT_PUBLIC_API_URL || 
    process.env.REACT_APP_BACKEND_URL;

  if (envUrl) {
    return envUrl.replace(/\/$/, '');
  }

  // When deployed on Vercel or any cloud domain, default directly to Render backend
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return 'https://athena-proctor-8.onrender.com';
  }

  return 'http://localhost:5000';
};

export const API_BASE_URL = getApiBaseUrl();

// Diagnostics Log
if (typeof window !== 'undefined') {
  console.log("API URL:", API_BASE_URL);
}

