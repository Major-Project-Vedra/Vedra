import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { FiBook, FiAward, FiTrendingUp, FiStar } from 'react-icons/fi';
import { BadgeCard } from '../components/common/BadgeSystem';

const StatCard = ({ icon: Icon, label, value, color, sub }) => (
  <div className="card" style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
    <div style={{
      width: '48px', height: '48px', borderRadius: '12px', flexShrink: 0,
      background: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Icon size={22} color={color} />
    </div>
    <div>
      <p style={{ color: 'var(--gray-500)', fontSize: '13px', fontWeight: 500 }}>{label}</p>
      <p style={{ fontSize: '28px', fontWeight: 800, color: 'var(--gray-900)', lineHeight: 1.2 }}>{value}</p>
      {sub && <p style={{ fontSize: '12px', color: 'var(--gray-400)', marginTop: '2px' }}>{sub}</p>}
    </div>
  </div>
);

export default function DashboardPage() {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState(null);
  const [recentCourses, setRecentCourses] = useState([]);
  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/progress/analytics'),
      api.get('/courses/?per_page=6'),
      api.get('/gamify/my-badges'),
    ]).then(([analyticsRes, coursesRes, badgesRes]) => {
      setAnalytics(analyticsRes.data);
      setRecentCourses(coursesRes.data.courses);
      setBadges(badgesRes.data);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const xpPercent = user ? Math.min(100, Math.round(user.xp / (user.level * 500) * 100)) : 0;

  if (loading) return <div className="loading-screen"><div className="spinner" /><p>Loading dashboard...</p></div>;

  return (
    <div className="page-container" style={{ animation: 'fadeIn 0.3s ease' }}>
      {/* Welcome banner */}
      <div style={{
        background: 'linear-gradient(135deg, var(--primary) 0%, #6366F1 50%, var(--secondary) 100%)',
        borderRadius: '16px', padding: '32px', marginBottom: '24px', color: 'white',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: '-20px', right: '-20px', fontSize: '120px', opacity: 0.1 }}>🎓</div>
        <h1 style={{ fontSize: '26px', fontWeight: 800 }}>Welcome back, {user?.full_name || user?.username}! 👋</h1>
        <p style={{ opacity: 0.8, marginTop: '4px' }}>Ready to continue your learning journey?</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '20px' }}>
          <div>
            <p style={{ fontSize: '12px', opacity: 0.7 }}>Level {user?.level} • {user?.xp} XP</p>
            <div style={{ width: '200px', height: '8px', background: 'rgba(255,255,255,0.2)', borderRadius: '999px', marginTop: '4px' }}>
              <div style={{ width: `${xpPercent}%`, height: '100%', background: 'white', borderRadius: '999px', transition: 'width 0.5s' }} />
            </div>
          </div>
          {user?.streak > 0 && (
            <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: '8px', padding: '8px 14px' }}>
              🔥 {user.streak} day streak!
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid-4" style={{ marginBottom: '24px' }}>
        <StatCard icon={FiBook} label="Courses Enrolled" value={analytics?.total_enrolled || 0} color="#4F46E5" />
        <StatCard icon={FiTrendingUp} label="Completed" value={analytics?.completed_courses || 0} color="#10B981" />
        <StatCard icon={FiStar} label="Quizzes Passed" value={analytics?.quizzes_passed || 0} color="#F59E0B" sub={`Avg: ${Math.round(analytics?.avg_quiz_score || 0)}%`} />
        <StatCard icon={FiAward} label="Badges Earned" value={badges.length} color="#0EA5E9" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '20px' }}>
        {/* Course Progress */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Course Progress</h2>
            <Link to="/my-courses" className="btn btn-outline btn-sm">View All</Link>
          </div>
          {analytics?.course_progress?.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {analytics.course_progress.slice(0, 5).map(c => (
                <div key={c.course_id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 500 }}>{c.course_title}</span>
                    <span style={{ fontSize: '13px', color: c.completed ? 'var(--success)' : 'var(--gray-500)' }}>
                      {c.completed ? '✅ Completed' : `${Math.round(c.progress)}%`}
                    </span>
                  </div>
                  <div className="xp-bar">
                    <div className="xp-bar-fill" style={{
                      width: `${c.progress}%`,
                      background: c.completed ? 'var(--success)' : undefined,
                    }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="icon">📚</div>
              <h3>No courses yet</h3>
              <p>Browse courses to get started!</p>
              <Link to="/courses" className="btn btn-primary" style={{ marginTop: '16px' }}>Browse Courses</Link>
            </div>
          )}
        </div>

        {/* Badges */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>🏅 My Badges</h2>
            <Link to="/profile" style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>
              View All →
            </Link>
          </div>

          {/* Current level badge — always shown */}
          {(() => {
            const levelBadges = badges
              .filter(ub => ub.badge?.condition_type === 'level')
              .sort((a, b) => (b.badge?.condition_value || 0) - (a.badge?.condition_value || 0));
            const highestLevelBadge = levelBadges[0];
            return highestLevelBadge ? (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: '6px', marginBottom: '16px', padding: '12px',
                background: 'linear-gradient(135deg, #EEF2FF, #F5F3FF)',
                borderRadius: '12px', border: '1px solid #C7D2FE',
              }}>
                <p style={{ fontSize: '10px', fontWeight: 700, color: '#6366F1', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                  Current Level Badge
                </p>
                <BadgeCard badge={highestLevelBadge.badge} earned size="md" showTooltip={false} />
                <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--gray-700)', margin: 0 }}>
                  Level {highestLevelBadge.badge.condition_value}
                </p>
              </div>
            ) : null;
          })()}

          {/* Recent achievement badges */}
          {badges.filter(ub => ub.badge?.condition_type !== 'level').length > 0 ? (
            <div>
              <p style={{ fontSize: '11px', color: 'var(--gray-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
                Achievements
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center' }}>
                {badges
                  .filter(ub => ub.badge?.condition_type !== 'level')
                  .slice(0, 4)
                  .map(ub => (
                    <BadgeCard key={ub.id} badge={ub.badge} earned size="sm" />
                  ))}
              </div>
            </div>
          ) : badges.length === 0 ? (
            <div className="empty-state" style={{ padding: '12px' }}>
              <div className="icon">🏆</div>
              <p style={{ fontSize: '13px' }}>Complete courses to earn badges!</p>
            </div>
          ) : null}
        </div>
      </div>

      {/* Browse Courses */}
      <div className="card" style={{ marginTop: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700 }}>📚 Available Courses</h2>
          <Link to="/courses" className="btn btn-outline btn-sm">See All</Link>
        </div>
        <div className="grid-3">
          {recentCourses.map(course => (
            <Link key={course.id} to={`/courses/${course.id}`} style={{ textDecoration: 'none' }}>
              <div style={{
                borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--gray-200)',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = 'var(--shadow-lg)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}>
                <img src={course.thumbnail} alt={course.title} style={{ width: '100%', height: '140px', objectFit: 'cover' }} />
                <div style={{ padding: '12px' }}>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--gray-900)', marginBottom: '4px' }}>{course.title}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className={`badge badge-${course.difficulty === 'beginner' ? 'success' : course.difficulty === 'intermediate' ? 'warning' : 'danger'}`}>
                      {course.difficulty}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 600 }}>+{course.xp_reward} XP</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}