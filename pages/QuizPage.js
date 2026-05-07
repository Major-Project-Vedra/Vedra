import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useBadgeNotification } from '../context/BadgeNotificationContext';

export default function QuizPage() {
  const { id } = useParams();
  const { updateUser } = useAuth();
  const { awardBadges } = useBadgeNotification();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [reviewData, setReviewData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    api.get(`/quiz/${id}`).then(res => {
      setQuiz(res.data);
      setTimeLeft((res.data.time_limit || 30) * 60); // seconds
    }).finally(() => setLoading(false));
  }, [id]);

  // Countdown timer
  useEffect(() => {
    if (!quiz || result || timeLeft === null) return;
    if (timeLeft <= 0) { handleSubmit(true); return; }
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(timerRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [quiz, result]);

  // Auto-submit on time up
  useEffect(() => {
    if (timeLeft === 0 && !result) handleSubmit(true);
  }, [timeLeft]);

  const handleSubmit = async (forced = false) => {
    if (!forced && Object.keys(answers).length < quiz.questions.length) {
      toast.error('Please answer all questions!');
      return;
    }
    clearInterval(timerRef.current);
    setSubmitting(true);
    try {
      const res = await api.post(`/quiz/${id}/submit`, { answers });
      setResult(res.data);
      setReviewData(res.data.review || null);
      updateUser(res.data.user);
      awardBadges(res.data.newly_awarded);
      toast[res.data.passed ? 'success' : 'error'](
        res.data.passed
          ? `🎉 Passed! +${res.data.xp_earned} XP`
          : `😔 Score: ${Math.round(res.data.score)}%. Keep practicing!`
      );
    } catch { toast.error('Submission failed'); }
    finally { setSubmitting(false); }
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;
  if (!quiz) return <div className="page-container"><p>Quiz not found</p></div>;

  /** Results screen */
  if (result) {
    return (
      <div className="page-container" style={{ maxWidth: '680px', animation: 'fadeIn 0.3s ease' }}>
        <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
          <div style={{ fontSize: '72px', marginBottom: '16px' }}>{result.passed ? '🎉' : '😔'}</div>
          <h2 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '8px' }}>
            {result.passed ? 'Congratulations!' : 'Keep Practicing!'}
          </h2>
          <p style={{ color: 'var(--gray-500)', marginBottom: '24px' }}>
            You scored {Math.round(result.score)}% ({result.correct}/{result.total} correct)
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '32px' }}>
            {[
              { val: `${Math.round(result.score)}%`, label: 'Score', color: result.passed ? 'var(--success)' : 'var(--danger)' },
              { val: `+${result.xp_earned}`, label: 'XP Earned', color: 'var(--primary)' },
              { val: `${result.correct}/${result.total}`, label: 'Correct', color: 'var(--gray-700)' },
            ].map(s => (
              <div key={s.label} style={{ background: 'var(--gray-50)', borderRadius: '10px', padding: '16px' }}>
                <p style={{ fontSize: '26px', fontWeight: 800, color: s.color }}>{s.val}</p>
                <p style={{ fontSize: '12px', color: 'var(--gray-500)' }}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* Review answers */}
          {quiz.questions?.length > 0 && (
            <div style={{ textAlign: 'left', marginBottom: '28px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '14px' }}>📝 Answer Review</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {quiz.questions.map((q, idx) => {
                  const submitted = answers[q.id];
                  const correct = result.correct_answers?.[q.id];
                  const isRight = submitted === correct || submitted === q.correct_answer;
                  return (
                    <div key={q.id} style={{
                      padding: '14px 16px', borderRadius: '10px',
                      background: isRight ? '#F0FDF4' : '#FFF1F2',
                      border: `1px solid ${isRight ? '#BBF7D0' : '#FECDD3'}`,
                    }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <span style={{ fontSize: '16px' }}>{isRight ? '✅' : '❌'}</span>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}>Q{idx + 1}. {q.text}</p>
                          {q.image_url && (
                            <img src={q.image_url} alt="" style={{ maxWidth: '160px', maxHeight: '100px', borderRadius: '6px', objectFit: 'cover', marginBottom: '8px' }} />
                          )}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {q.options?.map((opt, oi) => {
                              const isCorrect = oi === (q.correct_answer ?? correct);
                              const isYours = oi === submitted;
                              return (
                                <span key={oi} style={{
                                  fontSize: '11px', padding: '3px 10px', borderRadius: '99px',
                                  background: isCorrect ? '#D1FAE5' : (isYours && !isCorrect ? '#FEE2E2' : 'var(--gray-100)'),
                                  color: isCorrect ? '#065F46' : (isYours && !isCorrect ? '#991B1B' : 'var(--gray-500)'),
                                  fontWeight: (isCorrect || isYours) ? 700 : 400,
                                  border: isCorrect ? '1px solid #6EE7B7' : (isYours && !isCorrect ? '1px solid #FCA5A5' : '1px solid transparent'),
                                }}>
                                  {isCorrect ? '✓ ' : isYours && !isCorrect ? '✗ ' : ''}{opt}
                                </span>
                              );
                            })}
                          </div>
                          {q.explanation && (
                            <p style={{ fontSize: '11px', color: '#6B7280', marginTop: '8px', fontStyle: 'italic' }}>
                              💡 {q.explanation}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button className="btn btn-outline" onClick={() => { setResult(null); setAnswers({}); setTimeLeft(quiz.time_limit * 60); }}>
              🔄 Retry
            </button>
            <button className="btn btn-primary" onClick={() => navigate(-1)}>← Back to Course</button>
          </div>
        </div>
      </div>
    );
  }

  /** Quiz taking screen */
  const answered = Object.keys(answers).length;
  const total = quiz.questions?.length || 0;
  const timerWarning = timeLeft !== null && timeLeft < 60;

  return (
    <div className="page-container" style={{ maxWidth: '740px', animation: 'fadeIn 0.3s ease' }}>
      {/* Header */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '4px' }}>{quiz.title}</h1>
            <p style={{ color: 'var(--gray-500)', fontSize: '14px' }}>{quiz.description}</p>
          </div>
          {timeLeft !== null && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 18px', borderRadius: '10px',
              background: timerWarning ? '#FEF2F2' : 'var(--gray-50)',
              border: `2px solid ${timerWarning ? '#FECACA' : 'var(--gray-200)'}`,
            }}>
              <span style={{ fontSize: '20px' }}>⏱️</span>
              <span style={{ fontWeight: 800, fontSize: '22px', color: timerWarning ? '#EF4444' : 'var(--gray-800)', fontVariantNumeric: 'tabular-nums' }}>
                {formatTime(timeLeft)}
              </span>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '16px', marginTop: '14px', fontSize: '13px', color: 'var(--gray-500)', flexWrap: 'wrap' }}>
          <span>❓ {total} questions</span>
          <span>✅ Pass: {quiz.pass_percent}%</span>
          <span>⚡ +{quiz.xp_reward} XP</span>
          <span>📊 {answered}/{total} answered</span>
        </div>
        {/* Progress bar */}
        <div style={{ marginTop: '12px', height: '6px', background: 'var(--gray-100)', borderRadius: '99px', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: '99px',
            background: answered === total ? 'var(--success)' : 'var(--primary)',
            width: `${(answered / total) * 100}%`,
            transition: 'width 0.3s ease',
          }} />
        </div>
      </div>

      {/* Questions */}
      {quiz.questions?.map((q, idx) => {
        const isAnswered = answers[q.id] !== undefined;
        const qType = q.image_url ? (q.text ? 'text_image' : 'image') : 'text';
        return (
          <div key={q.id} className="card" style={{
            marginBottom: '16px',
            border: `2px solid ${isAnswered ? 'rgba(79,70,229,0.2)' : 'var(--gray-200)'}`,
            transition: 'border-color 0.2s',
          }}>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', alignItems: 'flex-start' }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                background: isAnswered ? 'var(--primary)' : 'var(--gray-200)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: isAnswered ? 'white' : 'var(--gray-500)', fontWeight: 800, fontSize: '12px',
                transition: 'background 0.2s',
              }}>{isAnswered ? '✓' : idx + 1}</div>
              <div style={{ flex: 1 }}>
                {/* Text question */}
                {(qType === 'text' || qType === 'text_image') && q.text && (
                  <p style={{ fontWeight: 600, fontSize: '15px', lineHeight: 1.5, marginBottom: qType === 'text_image' ? '12px' : 0 }}>
                    {q.text}
                  </p>
                )}
                {/* Image */}
                {(qType === 'image' || qType === 'text_image') && q.image_url && (
                  <div style={{ marginBottom: '12px' }}>
                    <img
                      src={q.image_url}
                      alt={`Question ${idx + 1}`}
                      style={{
                        maxWidth: '100%', maxHeight: '280px', borderRadius: '10px',
                        objectFit: 'contain', border: '1px solid var(--gray-200)',
                        background: 'var(--gray-50)',
                      }}
                    />
                    {qType === 'image' && (
                      <p style={{ fontSize: '12px', color: 'var(--gray-400)', marginTop: '6px', fontStyle: 'italic' }}>
                        Choose the correct answer based on the image above
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Options */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '38px' }}>
              {q.options.map((opt, oi) => (
                <label key={oi} style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '11px 16px', borderRadius: '10px', cursor: 'pointer',
                  background: answers[q.id] === oi ? 'rgba(79,70,229,0.07)' : 'var(--gray-50)',
                  border: `2px solid ${answers[q.id] === oi ? 'var(--primary)' : 'var(--gray-200)'}`,
                  transition: 'all 0.15s',
                }}>
                  <input
                    type="radio"
                    name={`q_${q.id}`}
                    value={oi}
                    checked={answers[q.id] === oi}
                    onChange={() => setAnswers({ ...answers, [q.id]: oi })}
                    style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '14px' }}>{opt}</span>
                </label>
              ))}
            </div>
          </div>
        );
      })}

      {/* Submit bar */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '20px', background: 'white', borderRadius: '12px',
        border: '1px solid var(--gray-200)', position: 'sticky', bottom: '16px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
      }}>
        <div>
          <p style={{ fontWeight: 600, fontSize: '14px' }}>{answered}/{total} answered</p>
          {answered < total && (
            <p style={{ fontSize: '12px', color: 'var(--gray-400)' }}>{total - answered} question{total - answered !== 1 ? 's' : ''} remaining</p>
          )}
        </div>
        <button
          className="btn btn-primary btn-lg"
          onClick={() => handleSubmit(false)}
          disabled={submitting}
          style={{ minWidth: '160px', justifyContent: 'center' }}
        >
          {submitting ? 'Submitting…' : '🚀 Submit Quiz'}
        </button>
      </div>
    </div>
  );
}