import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { FiBookOpen, FiClock, FiRefreshCw } from 'react-icons/fi';

function formatDuration(mins) {
  if (!mins) return null;
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function ProgressBar({ percent, completed }) {
  const pct = Math.min(100, Math.round(percent || 0));
  const color = completed ? '#10B981' : pct > 60 ? '#4F46E5' : pct > 30 ? '#F59E0B' : '#4F46E5';
  return (
    <div style={{ height: 6, background: 'var(--gray-100)', borderRadius: 99, overflow: 'hidden' }}>
      <div style={{
        height: '100%', width: `${pct}%`, borderRadius: 99,
        background: color, transition: 'width 0.5s ease',
        boxShadow: pct > 0 ? `0 0 6px ${color}55` : 'none',
      }} />
    </div>
  );
}

export default function MyCoursesPage() {
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [retaking, setRetaking]       = useState(null);

  const fetchEnrollments = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await api.get('/enroll/my');
      setEnrollments(res.data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchEnrollments(); }, []);

  const handleRetake = async (courseId) => {
    if (!window.confirm('Retake this course? Your progress will be reset (XP already earned is kept).')) return;
    setRetaking(courseId);
    try {
      await api.post(`/enroll/retake/${courseId}`);
      await fetchEnrollments(true);
    } catch (err) {
      console.error('Retake failed', err);
      alert('Failed to reset course. Please try again.');
    } finally {
      setRetaking(null);
    }
  };

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;

  const inProgress = enrollments.filter(e => !e.completed && e.progress_percent > 0);
  const notStarted = enrollments.filter(e => !e.completed && e.progress_percent === 0);
  const completed  = enrollments.filter(e => e.completed);

  const CourseCard = ({ e }) => {
    const pct           = Math.round(e.progress_percent || 0);
    const hasLessons    = e.course.lesson_count > 0;
    const dur           = formatDuration(e.course.duration);
    const progressLabel = hasLessons ? 'Lessons' : 'Video watched';
    const isRetaking    = retaking === e.course_id;

    return (
      <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ position: 'relative' }}>
          <img src={e.course.thumbnail} alt={e.course.title}
            style={{ width: '100%', height: 150, objectFit: 'cover', display: 'block' }} />
          {e.completed && (
            <div style={{
              position: 'absolute', top: 10, right: 10, background: '#10B981',
              borderRadius: 99, padding: '3px 10px', fontSize: 11, fontWeight: 700, color: 'white',
            }}>✅ Done</div>
          )}
          {!e.completed && pct > 0 && (
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: 'rgba(0,0,0,0.3)' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: '#4F46E5', transition: 'width 0.5s' }} />
            </div>
          )}
        </div>

        <div style={{ padding: '14px 16px', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, lineHeight: 1.4 }}>{e.course.title}</h3>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span className={`badge badge-${e.course.difficulty === 'beginner' ? 'success' : e.course.difficulty === 'intermediate' ? 'warning' : 'danger'}`} style={{ fontSize: 10 }}>
              {e.course.difficulty}
            </span>
            {dur && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--gray-400)' }}>
                <FiClock size={10} /> {dur}
              </span>
            )}
            {hasLessons && (
              <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>
                📚 {e.course.lesson_count} lesson{e.course.lesson_count !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: 11, color: 'var(--gray-500)' }}>{progressLabel}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: e.completed ? '#10B981' : pct > 0 ? 'var(--primary)' : 'var(--gray-400)' }}>
                {e.completed ? '100%' : pct > 0 ? `${pct}%` : 'Not started'}
              </span>
            </div>
            <ProgressBar percent={pct} completed={e.completed} />
          </div>

          {e.completed ? (
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <Link to={`/courses/${e.course_id}`} className="btn btn-sm btn-outline"
                style={{ flex: 1, justifyContent: 'center' }}>
                📖 Review
              </Link>
              <button
                className="btn btn-sm"
                style={{
                  flex: 1, justifyContent: 'center',
                  background: '#F59E0B', color: 'white', border: 'none',
                  opacity: isRetaking ? 0.7 : 1,
                }}
                onClick={() => handleRetake(e.course_id)}
                disabled={isRetaking}
              >
                {isRetaking ? '⏳ Resetting…' : '🔄 Retake'}
              </button>
            </div>
          ) : (
            <Link to={`/courses/${e.course_id}`} className="btn btn-sm btn-primary"
              style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}>
              {pct > 0 ? '▶️ Continue' : '▶️ Start'}
            </Link>
          )}
        </div>
      </div>
    );
  };

  const Section = ({ title, items }) => {
    if (items.length === 0) return null;
    return (
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          {title}
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-400)', background: 'var(--gray-100)', borderRadius: 99, padding: '1px 8px' }}>
            {items.length}
          </span>
        </h2>
        <div className="grid-3">
          {items.map(e => <CourseCard key={e.id} e={e} />)}
        </div>
      </div>
    );
  };

  return (
    <div className="page-container" style={{ animation: 'fadeIn 0.3s ease' }}>
      <div className="page-header">
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><FiBookOpen /> My Courses</h1>
          <p style={{ color: 'var(--gray-500)', fontSize: 13 }}>
            {enrollments.length} course{enrollments.length !== 1 ? 's' : ''} enrolled
            {inProgress.length > 0 && ` · ${inProgress.length} in progress`}
            {completed.length > 0 && ` · ${completed.length} completed`}
          </p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={() => fetchEnrollments(true)}
          disabled={refreshing} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <FiRefreshCw size={13} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {enrollments.length === 0 ? (
        <div className="empty-state">
          <div className="icon">📚</div>
          <h3>No courses enrolled yet</h3>
          <p>Browse our course catalog to get started!</p>
          <Link to="/courses" className="btn btn-primary" style={{ marginTop: 16 }}>Browse Courses</Link>
        </div>
      ) : (
        <>
          <Section title="🔥 In Progress" items={inProgress} />
          <Section title="📚 Not Started"  items={notStarted} />
          <Section title="✅ Completed"    items={completed}  />
        </>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}