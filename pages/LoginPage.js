import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    const newErrors = {};

    if (!form.email.trim()) {
      newErrors.email = 'Please enter your email address';
    }

    if (!form.password.trim()) {
      newErrors.password = 'Please enter your password';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error('Please fill in all required fields');
      return;
    }

    setErrors({});
    setLoading(true);

    try {
      const user = await login(form.email, form.password);
      toast.success(`Welcome back, ${user.full_name || user.username}! 🎉`);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background decoration */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: 'radial-gradient(circle at 25% 25%, rgba(79,70,229,0.15) 0%, transparent 50%), radial-gradient(circle at 75% 75%, rgba(14,165,233,0.1) 0%, transparent 50%)',
      }} />

      {/* Left Panel */}
      <div style={{
        flex: 1,
        display: window.innerWidth < 768 ? 'none' : 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '60px',
      }}>
        <div style={{ maxWidth: '480px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '40px' }}>
            <span style={{ fontSize: '48px' }}>🎓</span>
            <span style={{ fontSize: '40px', fontWeight: 900, color: 'white' }}>Vedra</span>
          </div>

          <h1 style={{ fontSize: '36px', fontWeight: 800, color: 'white', lineHeight: 1.2, marginBottom: '16px' }}>
            Learn, Play, <br /><span style={{ color: 'var(--primary-light)' }}>Level Up!</span>
          </h1>

          <p style={{ color: 'var(--gray-400)', fontSize: '16px', lineHeight: 1.7 }}>
            Join thousands of students on a gamified learning journey. Earn XP, unlock badges, and compete on the leaderboard.
          </p>

          <div style={{ display: 'flex', gap: '24px', marginTop: '40px' }}>
            {[{ emoji: '🏆', label: 'Earn Badges' }, { emoji: '⚡', label: 'Gain XP' }, { emoji: '🎯', label: 'Track Progress' }].map(item => (
              <div key={item.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '28px', marginBottom: '6px' }}>{item.emoji}</div>
                <p style={{ color: 'var(--gray-300)', fontSize: '13px', fontWeight: 500 }}>{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div style={{
        width: '100%',
        maxWidth: '480px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px',
        background: 'rgba(255,255,255,0.03)',
        backdropFilter: 'blur(10px)',
        borderLeft: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{ width: '100%', maxWidth: '380px', animation: 'fadeIn 0.4s ease' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 800, color: 'white', marginBottom: '8px' }}>Sign In</h2>
          <p style={{ color: 'var(--gray-400)', marginBottom: '32px' }}>
            Don't have an account? <Link to="/register" style={{ color: 'var(--primary-light)', fontWeight: 600 }}>Sign up</Link>
          </p>

          <form onSubmit={handleSubmit} noValidate>
            <div className="input-group">
              <label style={{ color: 'var(--gray-300)' }}>Email Address</label>
              <input
                type="email"
                placeholder="Enter your email"
                value={form.email}
                onChange={e => {
                  setForm({ ...form, email: e.target.value });
                  if (errors.email) {
                    setErrors({ ...errors, email: '' });
                  }
                }}
                style={{
                  background: 'rgba(255,255,255,0.07)',
                  borderColor: errors.email ? '#F87171' : 'rgba(255,255,255,0.1)',
                  color: 'white'
                }}
              />
              {errors.email && (
                <p style={{ color: '#F87171', fontSize: '12px', marginTop: '6px', marginBottom: '0' }}>
                  {errors.email}
                </p>
              )}
            </div>

            <div className="input-group" style={{ position: 'relative' }}>
              <label style={{ color: 'var(--gray-300)' }}>Password</label>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={form.password}
                onChange={e => {
                  setForm({ ...form, password: e.target.value });
                  if (errors.password) {
                    setErrors({ ...errors, password: '' });
                  }
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
                  fontSize: '18px',
                  userSelect: 'none'
                }}
              >
                {showPassword ? '🙉' : '🙈'}
              </span>
              {errors.password && (
                <p style={{ color: '#F87171', fontSize: '12px', marginTop: '6px', marginBottom: '0' }}>
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
              {loading ? 'Signing in...' : '🚀 Sign In'}
            </button>
          </form>

          <div style={{ marginTop: '24px', padding: '16px', background: 'rgba(79,70,229,0.1)', borderRadius: '8px', border: '1px solid rgba(79,70,229,0.2)' }}>
            <p style={{ color: 'var(--gray-300)', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Demo Credentials</p>
            <p style={{ color: 'var(--gray-400)', fontSize: '12px' }}>Email: <span style={{ color: 'var(--primary-light)' }}>admin@vedra.com</span></p>
            <p style={{ color: 'var(--gray-400)', fontSize: '12px' }}>Password: <span style={{ color: 'var(--primary-light)' }}>Admin@123</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}