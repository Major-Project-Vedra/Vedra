/**
 * QuizHubPage.js — Student Quiz Hub
 *
 * Shows all available quizzes grouped by course.
 * Displays the student's best score and attempt history for each quiz.
 * Links to the existing QuizPage to actually take the quiz.
 */

import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { FiClock, FiAward, FiCheckCircle, FiXCircle, FiTrendingUp, FiRefreshCw } from 'react-icons/fi';

function ScoreBadge({ score, passed }) {
  if (score == null) return null;
  const color = passed ? '#10B981' : score >= 50 ? '#F59E0B' : '#EF4444';
  const bg    = passed ? '#D1FAE5' : score >= 50 ? '#FEF3C7' : '#FEE2E2';
  return (
    <span style={{
      fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 99,
      background: bg, color,
    }}>
      {Math.round(score)}%
    </span>
  );
}

export default function QuizHubPage() {
  const navigate = useNavigate();
  const [quizzes,   setQuizzes]   = useState([]);
  const [attempts,  setAttempts]  = useState({}); // quizId → best attempt
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      // Fetch all courses (which include their quizzes)
      const [coursesRes, attemptsRes] = await Promise.all([
        api.get('/courses/?per_page=100'),
        api.get('/quiz/my-attempts').catch(() => ({ data: [] })),
      ]);

      // Collect all quizzes from all courses
      const courses = coursesRes.data.courses || [];
      const allQuizzes = [];
      for (const course of courses) {
        const detail = await api.get(`/courses/${course.id}`).catch(() => null);
        if (detail?.data?.quizzes?.length) {
          detail.data.quizzes.forEach(q => allQuizzes.push({ ...q, course_title: course.title, course_id: course.id }));
        }
      }
      setQuizzes(allQuizzes);

      // Map attempts by quiz_id → best attempt
      const attMap = {};
      (attemptsRes.data || []).forEach(a => {
        if (!attMap[a.quiz_id] || a.score > attMap[a.quiz_id].score) {
          attMap[a.quiz_id] = a;
        }
      });
      setAttempts(attMap);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;

  // Group by course
  const byCourse = {};
  quizzes.forEach(q => {
    if (!byCourse[q.course_id]) byCourse[q.course_id] = { title: q.course_title, quizzes: [] };
    byCourse[q.course_id].quizzes.push(q);
  });

  const totalQuizzes  = quizzes.length;
  const attempted     = quizzes.filter(q => attempts[q.id]).length;
  const passed        = quizzes.filter(q => attempts[q.id]?.passed).length;
  const avgScore      = attempted > 0
    ? Math.round(quizzes.reduce((sum, q) => sum + (attempts[q.id]?.score || 0), 0) / attempted)
    : 0;

  return (
    <div className="page-container" style={{ animation: 'fadeIn 0.3s ease' }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <h1>🧠 Quiz Hub</h1>
          <p style={{ color: 'var(--gray-500)', fontSize: 13 }}>
            Test your knowledge — scores update the leaderboard instantly
          </p>
        </div>
        <button
          className="btn btn-outline btn-sm"
          onClick={() => fetchData(true)}
          disabled={refreshing}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <FiRefreshCw size={13} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 28 }}>
        {[
          { icon: '🧩', label: 'Total Quizzes',  value: totalQuizzes,        color: '#4F46E5' },
          { icon: '✏️', label: 'Attempted',       value: attempted,           color: '#F59E0B' },
          { icon: '✅', label: 'Passed',           value: passed,              color: '#10B981' },
          { icon: '📊', label: 'Avg Score',        value: attempted ? `${avgScore}%` : '—', color: '#0EA5E9' },
        ].map(s => (
          <div key={s.label} className="card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: `${s.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
              {s.icon}
            </div>
            <div>
              <p style={{ fontSize: 11, color: 'var(--gray-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</p>
              <p style={{ fontSize: 24, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Quiz list grouped by course */}
      {totalQuizzes === 0 ? (
        <div className="empty-state">
          <div className="icon">🧩</div>
          <h3>No quizzes available yet</h3>
          <p>Your instructor will add quizzes soon. Check back later!</p>
        </div>
      ) : (
        Object.entries(byCourse).map(([courseId, group]) => (
          <div key={courseId} style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              📚 {group.title}
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-400)', background: 'var(--gray-100)', borderRadius: 99, padding: '1px 8px' }}>
                {group.quizzes.length} quiz{group.quizzes.length !== 1 ? 'zes' : ''}
              </span>
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {group.quizzes.map(quiz => {
                const best    = attempts[quiz.id];
                const tried   = !!best;
                const hasPassed = best?.passed;

                return (
                  <div key={quiz.id} className="card" style={{
                    padding: 0, overflow: 'hidden',
                    border: hasPassed ? '1.5px solid #BBF7D0' : tried ? '1.5px solid #FDE68A' : '1px solid var(--gray-200)',
                  }}>
                    {/* Left accent strip */}
                    <div style={{ display: 'flex' }}>
                      <div style={{
                        width: 5, flexShrink: 0,
                        background: hasPassed ? '#10B981' : tried ? '#F59E0B' : 'var(--gray-200)',
                      }} />

                      <div style={{ flex: 1, padding: '18px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                        <div style={{ flex: 1, minWidth: 200 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{quiz.title}</h3>
                            {hasPassed && <span style={{ fontSize: 10, fontWeight: 700, background: '#D1FAE5', color: '#065F46', borderRadius: 99, padding: '2px 8px' }}>✅ PASSED</span>}
                            {tried && !hasPassed && <span style={{ fontSize: 10, fontWeight: 700, background: '#FEF3C7', color: '#92400E', borderRadius: 99, padding: '2px 8px' }}>⚠️ NOT PASSED</span>}
                            {!tried && <span style={{ fontSize: 10, fontWeight: 700, background: 'var(--gray-100)', color: 'var(--gray-500)', borderRadius: 99, padding: '2px 8px' }}>NEW</span>}
                          </div>

                          {quiz.description && (
                            <p style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 8, lineHeight: 1.5 }}>{quiz.description}</p>
                          )}

                          <div style={{ display: 'flex', gap: 14, fontSize: 12, color: 'var(--gray-400)', flexWrap: 'wrap' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <FiClock size={11} /> {quiz.time_limit} min
                            </span>
                            <span>❓ {quiz.question_count} questions</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <FiCheckCircle size={11} /> Pass: {quiz.pass_percent}%
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#F59E0B' }}>
                              <FiAward size={11} /> +{quiz.xp_reward} XP
                            </span>
                          </div>
                        </div>

                        {/* Right: score + action */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
                          {tried && (
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>Best score</span>
                                <ScoreBadge score={best.score} passed={best.passed} />
                              </div>
                              <p style={{ fontSize: 11, color: 'var(--gray-400)' }}>
                                {best.correct_count != null ? `${best.correct_count}/${quiz.question_count} correct · ` : ''}
                                +{best.xp_earned} XP earned
                              </p>
                            </div>
                          )}
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => navigate(`/quiz/${quiz.id}`)}
                            style={{ whiteSpace: 'nowrap' }}
                          >
                            {tried ? (hasPassed ? '🔄 Retake' : '🔁 Try Again') : '▶ Start Quiz'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}