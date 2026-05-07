import React, { useEffect, useState, useCallback, useRef } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { BadgeCard } from '../components/common/BadgeSystem';

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const [form, setForm]               = useState({ full_name: '', bio: '', password: '' });
  const [saving, setSaving]           = useState(false);
  const [userBadges, setUserBadges]   = useState([]);
  const [allBadges, setAllBadges]     = useState([]);
  const [xpData, setXpData]           = useState(null);
  const [stats, setStats]             = useState(null);
  const [activeTab, setActiveTab]     = useState('level');

  // Avatar state
  const [avatarPreview, setAvatarPreview]     = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [removingAvatar, setRemovingAvatar]   = useState(false);
  const [showAvatarMenu, setShowAvatarMenu]   = useState(false);
  const [lightboxOpen, setLightboxOpen]       = useState(false);
  const fileInputRef                           = useRef(null);
  const menuRef                                = useRef(null);

  const fetchData = useCallback(async () => {
    try {
      const [badgesRes, allBadgesRes, xpRes] = await Promise.all([
        api.get('/gamify/my-badges'),
        api.get('/gamify/badges'),
        api.get('/gamify/xp'),
      ]);
      setUserBadges(badgesRes.data);
      setAllBadges(allBadgesRes.data);
      setXpData(xpRes.data);
    } catch (err) {
      console.error('Failed to fetch profile data', err);
    }

    try {
      const [enrollRes, quizRes] = await Promise.all([
        api.get('/enroll/my'),
        api.get('/quiz/my-attempts'),
      ]);
      const completed = enrollRes.data.filter(e => e.completed).length;
      const passed    = quizRes.data.filter(a => a.passed).length;
      const best      = quizRes.data.length ? Math.max(...quizRes.data.map(a => a.score)) : 0;
      setStats({ completed, passed, best: Math.round(best), total_attempts: quizRes.data.length });
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    if (user) {
      setForm({ full_name: user.full_name || '', bio: user.bio || '', password: '' });
      fetchData();
    }
  }, [user, fetchData]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowAvatarMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Avatar helpers ────────────────────────────────────────────────────────

  const getAvatarUrl = () => {
    if (avatarPreview) return avatarPreview;
    if (!user?.avatar) return null;
    if (user.avatar.startsWith('http')) return user.avatar;
    return `${BASE_URL}${user.avatar}`;
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const allowed = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
    if (!allowed.includes(file.type)) {
      toast.error('Only PNG, JPG, GIF or WEBP images are allowed');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5 MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target.result);
    reader.readAsDataURL(file);

    setUploadingAvatar(true);
    setShowAvatarMenu(false);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const res = await api.post('/auth/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      updateUser(res.data.user);
      setAvatarPreview(null);
      toast.success('Avatar updated!');
    } catch (err) {
      setAvatarPreview(null);
      toast.error(err?.response?.data?.error || 'Failed to upload avatar');
    } finally {
      setUploadingAvatar(false);
      e.target.value = '';
    }
  };

  const handleRemoveAvatar = async () => {
    setShowAvatarMenu(false);
    setRemovingAvatar(true);
    try {
      const res = await api.delete('/auth/avatar');
      updateUser(res.data.user);
      toast.success('Avatar removed');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to remove avatar');
    } finally {
      setRemovingAvatar(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { full_name: form.full_name, bio: form.bio };
      if (form.password) payload.password = form.password;
      const res = await api.put('/auth/profile', payload);
      updateUser(res.data);
      toast.success('Profile updated!');
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  // ── Derived data ──────────────────────────────────────────────────────────
  const earnedIds    = new Set(userBadges.map(ub => ub.badge?.id));
  const currentLevel = xpData?.level || user?.level || 1;

  const levelBadges  = allBadges
    .filter(b => b.condition_type === 'level')
    .sort((a, b) => a.condition_value - b.condition_value);

  const achBadges         = allBadges.filter(b => b.condition_type !== 'level');
  const currentLevelBadge = levelBadges.find(b => b.condition_value === currentLevel);
  const shownBadges       = activeTab === 'level' ? levelBadges : achBadges;
  const earnedLevelCount  = levelBadges.filter(b => earnedIds.has(b.id)).length;
  const earnedAchCount    = achBadges.filter(b => earnedIds.has(b.id)).length;

  const xpPercent = xpData
    ? Math.min(100, Math.round(xpData.xp / xpData.xp_for_next_level * 100))
    : 0;

  const avatarUrl = getAvatarUrl();
  const initials  = (user?.full_name?.[0] || user?.username?.[0] || 'U').toUpperCase();
  const hasAvatar = !!(user?.avatar || avatarPreview);

  // ── Menu item style ───────────────────────────────────────────────────────
  const menuItem = (color, borderTop = false) => ({
    display: 'flex', alignItems: 'center', gap: '10px',
    width: '100%', padding: '10px 16px',
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: '13px', fontWeight: 600, color,
    textAlign: 'left',
    borderTop: borderTop ? '1px solid #F3F4F6' : 'none',
  });

  return (
    <div className="page-container" style={{ animation: 'fadeIn 0.3s ease' }}>

      {/* ── Lightbox ──────────────────────────────────────────────────────── */}
      {lightboxOpen && avatarUrl && (
        <div
          onClick={() => setLightboxOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'zoom-out',
          }}
        >
          <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
            <img
              src={avatarUrl}
              alt="Profile"
              style={{
                maxWidth: '90vw', maxHeight: '85vh',
                borderRadius: '16px',
                boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
                display: 'block',
              }}
            />
            <button
              onClick={() => setLightboxOpen(false)}
              style={{
                position: 'absolute', top: '-14px', right: '-14px',
                width: '32px', height: '32px', borderRadius: '50%',
                background: 'white', border: 'none', cursor: 'pointer',
                fontSize: '14px', fontWeight: 800, color: '#333',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
              }}
            >✕</button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '24px', alignItems: 'start' }}>

        {/* ── LEFT COLUMN ─────────────────────────────────────────────────── */}
        <div>
          <div className="card" style={{ textAlign: 'center', padding: '32px 24px', marginBottom: '16px' }}>

            {/* ── Avatar + dropdown ─────────────────────────────────────── */}
            <div style={{ position: 'relative', width: '80px', margin: '0 auto 8px' }} ref={menuRef}>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />

              {/* Avatar circle */}
              <div
                onClick={() => setShowAvatarMenu(v => !v)}
                title="Manage photo"
                style={{
                  width: '80px', height: '80px', borderRadius: '50%',
                  background: avatarUrl ? 'transparent' : 'linear-gradient(135deg,#4F46E5,#7C3AED)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '32px', fontWeight: 800, color: 'white',
                  cursor: 'pointer', overflow: 'hidden', position: 'relative',
                  boxShadow: showAvatarMenu
                    ? '0 0 0 3px #4F46E5'
                    : '0 0 0 3px rgba(79,70,229,0.3)',
                  transition: 'box-shadow 0.2s',
                }}
              >
                {avatarUrl
                  ? <img src={avatarUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : initials
                }

                {/* Spinner overlay when busy */}
                {(uploadingAvatar || removingAvatar) && (
                  <div style={{
                    position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%',
                  }}>
                    <div style={{
                      width: '24px', height: '24px', borderRadius: '50%',
                      border: '3px solid rgba(255,255,255,0.3)', borderTopColor: 'white',
                      animation: 'spin 0.8s linear infinite',
                    }}/>
                  </div>
                )}
              </div>

              {/* Camera badge */}
              <div style={{
                position: 'absolute', bottom: 0, right: 0,
                width: '24px', height: '24px', borderRadius: '50%',
                background: '#4F46E5', border: '2px solid white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '11px', pointerEvents: 'none',
              }}>📷</div>

              {/* ── Dropdown ──────────────────────────────────────────── */}
              {showAvatarMenu && (
                <div style={{
                  position: 'absolute', top: '92px', left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'white', borderRadius: '12px',
                  boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
                  border: '1px solid #E5E7EB',
                  overflow: 'hidden', zIndex: 200, minWidth: '170px',
                  animation: 'menuFadeIn 0.15s ease',
                }}>

                  {/* View — only when avatar exists */}
                  {hasAvatar && (
                    <button
                      onClick={() => { setLightboxOpen(true); setShowAvatarMenu(false); }}
                      style={menuItem('#4F46E5')}
                      onMouseEnter={e => e.currentTarget.style.background = '#F5F3FF'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                      <span style={{ fontSize: '15px' }}>🔍</span> View Photo
                    </button>
                  )}

                  {/* Change / Upload */}
                  <button
                    onClick={() => { fileInputRef.current?.click(); setShowAvatarMenu(false); }}
                    style={menuItem('#059669', hasAvatar)}
                    onMouseEnter={e => e.currentTarget.style.background = '#F0FDF4'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    <span style={{ fontSize: '15px' }}>📷</span>
                    {hasAvatar ? 'Change Photo' : 'Upload Photo'}
                  </button>

                  {/* Remove — only when avatar exists */}
                  {hasAvatar && (
                    <button
                      onClick={handleRemoveAvatar}
                      style={menuItem('#DC2626', true)}
                      onMouseEnter={e => e.currentTarget.style.background = '#FEF2F2'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                      <span style={{ fontSize: '15px' }}>🗑️</span> Remove Photo
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Hint */}
            <p style={{ fontSize: '11px', color: 'var(--gray-400)', marginBottom: '12px' }}>
              Click avatar to manage photo
            </p>

            <h2 style={{ fontWeight: 800, fontSize: '20px' }}>{user?.full_name || user?.username}</h2>
            <p style={{ color: 'var(--gray-500)', fontSize: '13px', marginBottom: '20px' }}>@{user?.username}</p>

            {currentLevelBadge && (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: '8px', marginBottom: '20px', padding: '16px', borderRadius: '12px',
                background: 'linear-gradient(135deg, #EEF2FF, #F5F3FF)',
                border: '1px solid #C7D2FE',
              }}>
                <p style={{ fontSize: '11px', fontWeight: 700, color: '#6366F1', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                  Current Level Badge
                </p>
                <BadgeCard badge={currentLevelBadge} earned size="lg" showTooltip={false} />
                <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--gray-700)', margin: 0 }}>
                  Level {currentLevel}
                </p>
              </div>
            )}

            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--gray-500)', marginBottom: '6px' }}>
                <span>Level {currentLevel}</span>
                <span>{xpData?.xp || user?.xp} / {xpData?.xp_for_next_level || (currentLevel * 500)} XP</span>
              </div>
              <div style={{ height: '10px', background: 'var(--gray-100)', borderRadius: '99px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: '99px',
                  background: 'linear-gradient(90deg,#4F46E5,#7C3AED)',
                  width: `${xpPercent}%`, transition: 'width 1s ease',
                }}/>
              </div>
              <p style={{ fontSize: '11px', color: 'var(--gray-400)', marginTop: '4px', textAlign: 'right' }}>
                {xpPercent}% → Level {currentLevel + 1}
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              {[
                { label: 'Completed', value: stats?.completed ?? '—' },
                { label: 'Quizzes',   value: stats?.passed ?? '—' },
                { label: 'Badges',    value: userBadges.length },
              ].map(s => (
                <div key={s.label} style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: '22px', fontWeight: 800, color: 'var(--primary)' }}>{s.value}</p>
                  <p style={{ fontSize: '11px', color: 'var(--gray-500)' }}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {stats && (
            <div className="card" style={{ padding: '20px' }}>
              <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px' }}>📊 Quiz Stats</h4>
              {[
                { label: 'Attempts',   value: stats.total_attempts },
                { label: 'Passed',     value: stats.passed },
                { label: 'Best Score', value: `${stats.best}%` },
              ].map(s => (
                <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '8px' }}>
                  <span style={{ color: 'var(--gray-500)' }}>{s.label}</span>
                  <span style={{ fontWeight: 600 }}>{s.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── RIGHT COLUMN ────────────────────────────────────────────────── */}
        <div>
          <div className="card" style={{ marginBottom: '20px', padding: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '20px' }}>✏️ Edit Profile</h3>
            <form onSubmit={handleSave}>
              <div className="input-group">
                <label>Full Name</label>
                <input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} placeholder="Your name"/>
              </div>
              <div className="input-group">
                <label>Bio</label>
                <textarea value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} rows={3} placeholder="Tell us about yourself..."/>
              </div>
              <div className="input-group">
                <label>New Password (optional)</label>
                <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Leave blank to keep current"/>
              </div>
              <button className="btn btn-primary" type="submit" disabled={saving} style={{ width: '100%', justifyContent: 'center' }}>
                {saving ? 'Saving...' : '💾 Save Changes'}
              </button>
            </form>
          </div>

          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>🏅 Badge Collection</h3>
                <p style={{ fontSize: '12px', color: 'var(--gray-400)', margin: '4px 0 0' }}>
                  {userBadges.length} of {allBadges.length} earned
                </p>
              </div>
              <div style={{ display: 'flex', gap: '6px', background: 'var(--gray-100)', padding: '4px', borderRadius: '10px' }}>
                {[
                  ['level',       `🎖️ Levels (${earnedLevelCount}/${levelBadges.length})`],
                  ['achievement', `🎯 Achievements (${earnedAchCount}/${achBadges.length})`],
                ].map(([tab, label]) => (
                  <button key={tab} onClick={() => setActiveTab(tab)} style={{
                    padding: '6px 12px', borderRadius: '7px', fontSize: '12px', fontWeight: 600,
                    border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                    background: activeTab === tab ? 'white' : 'transparent',
                    color: activeTab === tab ? 'var(--primary)' : 'var(--gray-500)',
                    boxShadow: activeTab === tab ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                    transition: 'all 0.2s',
                  }}>{label}</button>
                ))}
              </div>
            </div>

            {shownBadges.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--gray-400)' }}>
                <p style={{ fontSize: '32px' }}>🔒</p>
                <p style={{ fontSize: '13px' }}>No badges in this category yet</p>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: activeTab === 'level'
                  ? 'repeat(auto-fill, minmax(80px, 1fr))'
                  : 'repeat(auto-fill, minmax(100px, 1fr))',
                gap: activeTab === 'level' ? '12px' : '20px',
              }}>
                {shownBadges.map(badge => {
                  const earned = earnedIds.has(badge.id);
                  return (
                    <div key={badge.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                      <BadgeCard badge={badge} earned={earned} size="md" />
                      {!earned && activeTab === 'achievement' && (
                        <p style={{ fontSize: '9px', color: 'var(--gray-400)', textAlign: 'center', margin: 0, lineHeight: 1.3 }}>
                          {badge.condition_type === 'courses_completed' ? `Complete ${badge.condition_value} course${badge.condition_value > 1 ? 's' : ''}` :
                           badge.condition_type === 'quiz_passed'       ? `Pass ${badge.condition_value} quiz${badge.condition_value > 1 ? 'zes' : ''}` :
                           badge.condition_type === 'quiz_score'        ? `Score ${badge.condition_value}%` : ''}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes menuFadeIn {
          from { opacity: 0; transform: translateX(-50%) translateY(-8px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  );
}