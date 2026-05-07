import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function RegisterPage() {
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    full_name: ''
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({}); // ✅ added

  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    let newErrors = {};

    if (!form.full_name.trim()) {
      newErrors.full_name = 'Full name is required';
    }

    if (!form.username.trim()) {
      newErrors.username = 'Username is required';
    }

    if (!form.email.trim()) {
      newErrors.email = 'Email is required';
    }

    if (!form.password.trim()) {
      newErrors.password = 'Password is required';
    } else if (form.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error('Please fill all required fields');
      return;
    }

    setErrors({});
    setLoading(true);

    try {
      const user = await register(form);
      toast.success(`Welcome to Vedra, ${user.full_name || user.username}! 🎉`);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
      padding: '20px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '440px',
        background: 'rgba(255,255,255,0.04)',
        borderRadius: '16px',
        padding: '40px',
        border: '1px solid rgba(255,255,255,0.08)',
        animation: 'fadeIn 0.4s ease',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <span style={{ fontSize: '48px' }}>🎓</span>
          <h2 style={{ fontSize: '28px', fontWeight: 800, color: 'white', marginTop: '8px' }}>
            Create Account
          </h2>
          <p style={{ color: 'var(--gray-400)', marginTop: '4px' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: 'var(--primary-light)', fontWeight: 600 }}>
              Sign in
            </Link>
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate>

          {/* Full Name */}
          <div className="input-group">
            <label style={{ color: 'var(--gray-300)' }}>Full Name</label>
            <input
              type="text"
              placeholder="Enter your full name"
              value={form.full_name}
              onChange={e => {
                setForm({ ...form, full_name: e.target.value });
                if (errors.full_name) setErrors({ ...errors, full_name: '' });
              }}
              style={{
                background: 'rgba(255,255,255,0.07)',
                borderColor: errors.full_name ? '#F87171' : 'rgba(255,255,255,0.1)',
                color: 'white'
              }}
            />
            {errors.full_name && (
              <p style={{ color: '#F87171', fontSize: '12px', marginTop: '6px' }}>
                {errors.full_name}
              </p>
            )}
          </div>

          {/* Username */}
          <div className="input-group">
            <label style={{ color: 'var(--gray-300)' }}>Username</label>
            <input
              type="text"
              placeholder="Enter your username"
              value={form.username}
              onChange={e => {
                setForm({ ...form, username: e.target.value });
                if (errors.username) setErrors({ ...errors, username: '' });
              }}
              style={{
                background: 'rgba(255,255,255,0.07)',
                borderColor: errors.username ? '#F87171' : 'rgba(255,255,255,0.1)',
                color: 'white'
              }}
            />
            {errors.username && (
              <p style={{ color: '#F87171', fontSize: '12px', marginTop: '6px' }}>
                {errors.username}
              </p>
            )}
          </div>

          {/* Email */}
          <div className="input-group">
            <label style={{ color: 'var(--gray-300)' }}>Email Address</label>
            <input
              type="email"
              placeholder="Enter your email"
              value={form.email}
              onChange={e => {
                setForm({ ...form, email: e.target.value });
                if (errors.email) setErrors({ ...errors, email: '' });
              }}
              style={{
                background: 'rgba(255,255,255,0.07)',
                borderColor: errors.email ? '#F87171' : 'rgba(255,255,255,0.1)',
                color: 'white'
              }}
            />
            {errors.email && (
              <p style={{ color: '#F87171', fontSize: '12px', marginTop: '6px' }}>
                {errors.email}
              </p>
            )}
          </div>

          {/* Password */}
          <div className="input-group" style={{ position: 'relative' }}>
            <label style={{ color: 'var(--gray-300)' }}>Password</label>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              value={form.password}
              onChange={e => {
                setForm({ ...form, password: e.target.value });
                if (errors.password) setErrors({ ...errors, password: '' });
              }}
              style={{
                background: 'rgba(255,255,255,0.07)',
                borderColor: errors.password ? '#F87171' : 'rgba(255,255,255,0.1)',
                color: 'white',
                paddingRight: '40px'
              }}
            />
            <span
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute',
                right: '12px',
                top: '38px',
                cursor: 'pointer',
                color: '#9CA3AF',
                fontSize: '18px'
              }}
            >
              {showPassword ? '🙉' : '🙈'}
            </span>
            {errors.password && (
              <p style={{ color: '#F87171', fontSize: '12px', marginTop: '6px' }}>
                {errors.password}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary btn-lg"
            style={{ width: '100%', marginTop: '8px', justifyContent: 'center' }}
          >
            {loading ? 'Creating account...' : '🚀 Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
}