import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { FiToggleLeft, FiToggleRight } from 'react-icons/fi';

export default function AdminUsers() {
  const [data, setData] = useState({ users: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const fetchUsers = () => {
    api.get(`/admin/users?page=${page}`).then(res => setData(res.data)).finally(() => setLoading(false));
  };

  useEffect(() => { fetchUsers(); }, [page]);

  const handleToggle = async (userId) => {
    try {
      const res = await api.put(`/admin/users/${userId}/toggle`);
      toast.success(`User ${res.data.is_active ? 'activated' : 'deactivated'}`);
      fetchUsers();
    } catch { toast.error('Action failed'); }
  };

  return (
    <div className="page-container" style={{ animation: 'fadeIn 0.3s ease' }}>
      <div className="page-header">
        <h1>👥 Manage Users</h1>
        <p>{data.total} total users</p>
      </div>

      {loading ? <div className="loading-screen"><div className="spinner" /></div> : (
        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>User</th><th>Email</th><th>Role</th><th>Level</th><th>XP</th><th>Streak</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {data.users.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                          background: 'linear-gradient(135deg, var(--primary), var(--primary-light))',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: 'white', fontWeight: 700, fontSize: '12px',
                        }}>
                          {u.full_name?.[0] || u.username[0]}
                        </div>
                        <div>
                          <p style={{ fontWeight: 600, fontSize: '13px' }}>{u.full_name || u.username}</p>
                          <p style={{ fontSize: '11px', color: 'var(--gray-500)' }}>@{u.username}</p>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize: '13px' }}>{u.email}</td>
                    <td><span className={`badge badge-${u.role === 'admin' ? 'warning' : 'primary'}`}>{u.role}</span></td>
                    <td>Lv.{u.level}</td>
                    <td>{u.xp} XP</td>
                    <td>{u.streak > 0 ? `🔥 ${u.streak}d` : '—'}</td>
                    <td><span className={`badge badge-${u.is_active ? 'success' : 'danger'}`}>{u.is_active ? 'Active' : 'Inactive'}</span></td>
                    <td>
                      <button className="btn btn-sm" style={{ background: 'var(--gray-50)', border: '1px solid var(--gray-200)' }} onClick={() => handleToggle(u.id)} title={u.is_active ? 'Deactivate' : 'Activate'}>
                        {u.is_active ? <FiToggleRight size={16} color="var(--success)" /> : <FiToggleLeft size={16} color="var(--gray-400)" />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
