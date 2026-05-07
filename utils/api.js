import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// ✅ REQUEST (add token)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('vedra_token');

  if (token) {
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${token}`,
    };
  }

  return config;
});

// ✅ RESPONSE (handle errors)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('vedra_token');
      localStorage.removeItem('vedra_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;