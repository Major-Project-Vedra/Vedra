import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';
import BadgeSystem from '../components/common/BadgeSystem';                                                              
const AuthContext = createContext(null);
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('vedra_token');
    const savedUser = localStorage.getItem('vedra_user');
    if (token && savedUser) {
      setUser(JSON.parse(savedUser));
      // Verify token is still valid
      api.get('/auth/me')
        .then(res => setUser(res.data))
        .catch(() => {
          localStorage.removeItem('vedra_token');
          localStorage.removeItem('vedra_user');
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    localStorage.setItem('vedra_token', res.data.token);
    localStorage.setItem('vedra_user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data.user;
  };

  const register = async (data) => {
    const res = await api.post('/auth/register', data);
    localStorage.setItem('vedra_token', res.data.token);
    localStorage.setItem('vedra_user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data.user;
  };

  const logout = () => {
    localStorage.removeItem('vedra_token');
    localStorage.removeItem('vedra_user');
    setUser(null);
  };

  const updateUser = (updatedUser) => {
    setUser(updatedUser);
    localStorage.setItem('vedra_user', JSON.stringify(updatedUser));
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);


const DashboardPage = () => {
  const { user } = useContext(AuthContext);

  return (
    <div className="dashboard-container">
      <h1>Welcome back, {user?.name}!</h1>
      
      {/* This is where the magic happens */}
      <BadgeSystem userLevel={user?.level || 1} />
      
      {/* Rest of your dashboard content */}
    </div>
  );
};