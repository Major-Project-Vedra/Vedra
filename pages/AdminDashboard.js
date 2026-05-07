import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { FiUsers, FiBook, FiTrendingUp, FiCheckCircle } from 'react-icons/fi';
import AdminEmotionMonitor from '../components/AdminEmotionMonitor';

const StatCard = ({ icon: Icon, label, value, color, sub }) => (
  <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
    <div style={{
      width: '52px', height: '52px', borderRadius: '12px',
      background: `${color}20`, display: 'flex', alignItems: 'center',
      justifyContent: 'center', flexShrink: 0,
    }}>
      <Icon size={24} color={color} />
    </div>
    <div>
      <p style={{ color: 'var(--gray-500)', fontSize: '13px' }}>{label}</p>
      <p style={{ fontSize: '30px', fontWeight: 800, lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: '12px', color: 'var(--success)', marginTop: '2px' }}>{sub}</p>}
    </div>
  </div>
);

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/dashboard')
      .then(res => setData(res.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;

  const { stats, recent_users, recent_enrollments } = data;

  return (
    <div className="page-container" style={{ animation: 'fadeIn 0.3s ease' }}>
      <div className="page-header">
        <h1>⚙️ Admin Dashboard</h1>
        <p>Overview of your LMS platform</p>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid-4" style={{ marginBottom: '24px' }}>
        <StatCard icon={FiUsers}       label="Total Users"      value={stats.total_users}       color="#4F46E5" sub={`${stats.active_users} active`} />
        <StatCard icon={FiBook}        label="Total Courses"     value={stats.total_courses}     color="#0EA5E9" />
        <StatCard icon={FiTrendingUp}  label="Enrollments"       value={stats.total_enrollments} color="#F59E0B" />
        <StatCard icon={FiCheckCircle} label="Completion Rate"   value={`${stats.completion_rate}%`} color="#10B981" />
      </div>

      {/* ── Live Emotion Monitor (admin only) ── */}
      <AdminEmotionMonitor />

      {/* ── Quick actions + Recent users ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Quick actions */}
        <div className="card">
          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>Quick Actions</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <Link to="/admin/courses" className="btn btn-primary" style={{ justifyContent: 'center' }}>
              📚 Manage Courses
            </Link>
            <Link to="/admin/users" className="btn btn-outline" style={{ justifyContent: 'center' }}>
              👥 Manage Users
            </Link>
          </div>
        </div>

        {/* Recent Users */}
        <div className="card">
          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>Recent Users</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {recent_users.map(u => (
              <div key={u.id} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '8px', background: 'var(--gray-50)', borderRadius: '8px',
              }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                  background: 'linear-gradient(135deg, var(--primary), var(--primary-light))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontWeight: 700, fontSize: '12px',
                }}>
                  {u.full_name?.[0] || u.username[0]}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 500, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {u.full_name || u.username}
                  </p>
                  <p style={{ fontSize: '11px', color: 'var(--gray-500)' }}>{u.email}</p>
                </div>
                <span className={`badge badge-${u.role === 'admin' ? 'warning' : 'primary'}`}>
                  {u.role}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Enrollments */}
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>Recent Enrollments</h3>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Course</th>
                  <th>Progress</th>
                  <th>Enrolled</th>
                </tr>
              </thead>
              <tbody>
                {recent_enrollments.map(e => (
                  <tr key={e.id}>
                    <td>User #{e.user_id}</td>
                    <td>{e.course_title}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          width: '80px', height: '6px',
                          background: 'var(--gray-200)', borderRadius: '999px', overflow: 'hidden',
                        }}>
                          <div style={{
                            width: `${e.progress_percent}%`, height: '100%',
                            background: 'var(--primary)', borderRadius: '999px',
                          }} />
                        </div>
                        <span style={{ fontSize: '12px' }}>{Math.round(e.progress_percent)}%</span>
                      </div>
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--gray-500)' }}>
                      {new Date(e.enrolled_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}