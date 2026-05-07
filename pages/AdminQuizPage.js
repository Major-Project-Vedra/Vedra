import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { FiPlus, FiTrash2, FiEdit2, FiX, FiImage, FiType, FiList, FiChevronDown, FiChevronUp } from 'react-icons/fi';

const EMPTY_QUESTION = {
  text: '',
  image_url: '',
  question_type: 'text', // 'text' | 'image' | 'text_image'
  options: ['', '', '', ''],
  correct_answer: 0,
  explanation: '',
};

const EMPTY_QUIZ = {
  course_id: '',
  title: '',
  description: '',
  xp_reward: 50,
  time_limit: 30,
  pass_percent: 70,
  questions: [],
};

function QuestionTypeIcon({ type }) {
  const icons = { text: <FiType size={13} />, image: <FiImage size={13} />, text_image: <><FiType size={11} />+<FiImage size={11} /></> };
  const colors = { text: '#4F46E5', image: '#059669', text_image: '#D97706' };
  const labels = { text: 'Text', image: 'Image only', text_image: 'Text + Image' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600,
      padding: '2px 8px', borderRadius: '99px',
      background: `${colors[type]}18`, color: colors[type],
    }}>
      {icons[type]} {labels[type]}
    </span>
  );
}

export default function AdminQuizPage() {
  const [courses, setCourses] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState(null);
  const [form, setForm] = useState(EMPTY_QUIZ);
  const [saving, setSaving] = useState(false);
  const [expandedQuiz, setExpandedQuiz] = useState(null);
  const [filterCourse, setFilterCourse] = useState('');

  const fetchData = async () => {
    try {
      const [cRes, qRes] = await Promise.all([
        api.get('/courses/?per_page=100'),
        api.get('/quiz/all'),
      ]);
      setCourses(cRes.data.courses || []);
      setQuizzes(qRes.data || []);
    } catch {
      // fallback: try fetching quizzes individually
      const cRes = await api.get('/courses/?per_page=100').catch(() => ({ data: { courses: [] } }));
      setCourses(cRes.data.courses || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setEditingQuiz(null);
    setForm({ ...EMPTY_QUIZ, questions: [{ ...EMPTY_QUESTION, options: ['', '', '', ''] }] });
    setShowModal(true);
  };

  const openEdit = (quiz) => {
    setEditingQuiz(quiz);
    setForm({
      course_id: quiz.course_id,
      title: quiz.title,
      description: quiz.description || '',
      xp_reward: quiz.xp_reward,
      time_limit: quiz.time_limit,
      pass_percent: quiz.pass_percent,
      questions: quiz.questions?.map(q => ({
        ...EMPTY_QUESTION,
        ...q,
        options: q.options?.length ? q.options : ['', '', '', ''],
        question_type: q.image_url ? (q.text ? 'text_image' : 'image') : 'text',
      })) || [],
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.course_id) { toast.error('Select a course'); return; }
    if (!form.title.trim()) { toast.error('Quiz title required'); return; }
    if (form.questions.length === 0) { toast.error('Add at least one question'); return; }

    // Validate questions
    for (let i = 0; i < form.questions.length; i++) {
      const q = form.questions[i];
      if (!q.text.trim() && q.question_type !== 'image') {
        toast.error(`Q${i + 1}: Question text required`); return;
      }
      if (q.question_type === 'image' && !q.image_url) {
        toast.error(`Q${i + 1}: Image URL required`); return;
      }
      const filledOpts = q.options.filter(o => o.trim());
      if (filledOpts.length < 2) {
        toast.error(`Q${i + 1}: At least 2 options needed`); return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        course_id: parseInt(form.course_id),
        questions: form.questions.map(q => ({
          text: q.text || '',
          image_url: q.image_url || '',
          question_type: q.question_type,
          options: q.options.filter(o => o.trim()),
          correct_answer: q.correct_answer,
          explanation: q.explanation || '',
        })),
      };

      if (editingQuiz) {
        await api.put(`/quiz/${editingQuiz.id}`, payload);
        toast.success('Quiz updated!');
      } else {
        await api.post('/quiz/', payload);
        toast.success('Quiz created!');
      }
      setShowModal(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save quiz');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this quiz?')) return;
    try {
      await api.delete(`/quiz/${id}`);
      toast.success('Quiz deleted');
      fetchData();
    } catch { toast.error('Failed to delete'); }
  };

  // Question helpers
  const addQuestion = () => {
    setForm(prev => ({ ...prev, questions: [...prev.questions, { ...EMPTY_QUESTION, options: ['', '', '', ''] }] }));
  };
  const removeQuestion = (idx) => {
    setForm(prev => ({ ...prev, questions: prev.questions.filter((_, i) => i !== idx) }));
  };
  const updateQuestion = (idx, field, value) => {
    setForm(prev => {
      const qs = [...prev.questions];
      qs[idx] = { ...qs[idx], [field]: value };
      // Auto-set question_type
      if (field === 'image_url') {
        qs[idx].question_type = value
          ? (qs[idx].text ? 'text_image' : 'image')
          : (qs[idx].text ? 'text' : 'text');
      }
      if (field === 'text') {
        qs[idx].question_type = value
          ? (qs[idx].image_url ? 'text_image' : 'text')
          : (qs[idx].image_url ? 'image' : 'text');
      }
      return { ...prev, questions: qs };
    });
  };
  const updateOption = (qIdx, optIdx, value) => {
    setForm(prev => {
      const qs = [...prev.questions];
      const opts = [...qs[qIdx].options];
      opts[optIdx] = value;
      qs[qIdx] = { ...qs[qIdx], options: opts };
      return { ...prev, questions: qs };
    });
  };
  const addOption = (qIdx) => {
    setForm(prev => {
      const qs = [...prev.questions];
      qs[qIdx] = { ...qs[qIdx], options: [...qs[qIdx].options, ''] };
      return { ...prev, questions: qs };
    });
  };
  const removeOption = (qIdx, optIdx) => {
    setForm(prev => {
      const qs = [...prev.questions];
      const opts = qs[qIdx].options.filter((_, i) => i !== optIdx);
      qs[qIdx] = { ...qs[qIdx], options: opts, correct_answer: Math.min(qs[qIdx].correct_answer, opts.length - 1) };
      return { ...prev, questions: qs };
    });
  };

  const filteredQuizzes = filterCourse
    ? quizzes.filter(q => String(q.course_id) === String(filterCourse))
    : quizzes;

  const getCourseTitle = (id) => courses.find(c => c.id === id)?.title || `Course #${id}`;

  return (
    <div className="page-container" style={{ animation: 'fadeIn 0.3s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div className="page-header" style={{ marginBottom: 0 }}>
          <h1>🧠 Manage Quizzes</h1>
          <p>{quizzes.length} quizzes total</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}><FiPlus /> Create Quiz</button>
      </div>

      {/* Filter */}
      <div style={{ marginBottom: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
        <label style={{ fontSize: '14px', color: 'var(--gray-500)' }}>Filter by course:</label>
        <select
          value={filterCourse}
          onChange={e => setFilterCourse(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--gray-200)', fontSize: '14px' }}
        >
          <option value="">All courses</option>
          {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
      </div>

      {loading ? <div className="loading-screen"><div className="spinner" /></div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredQuizzes.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: '48px', color: 'var(--gray-400)' }}>
              <p style={{ fontSize: '40px', marginBottom: '12px' }}>🧩</p>
              <p style={{ fontWeight: 600 }}>No quizzes yet</p>
              <p style={{ fontSize: '13px' }}>Create your first quiz to get started</p>
            </div>
          )}
          {filteredQuizzes.map(quiz => (
            <div key={quiz.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '16px 20px', cursor: 'pointer',
              }} onClick={() => setExpandedQuiz(expandedQuiz === quiz.id ? null : quiz.id)}>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <p style={{ fontWeight: 700, fontSize: '15px' }}>{quiz.title}</p>
                      <span className="badge badge-primary" style={{ fontSize: '10px' }}>
                        {getCourseTitle(quiz.course_id)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '16px', marginTop: '4px', fontSize: '12px', color: 'var(--gray-500)' }}>
                      <span>❓ {quiz.question_count} questions</span>
                      <span>⏱️ {quiz.time_limit}min</span>
                      <span>✅ Pass: {quiz.pass_percent}%</span>
                      <span>⚡ +{quiz.xp_reward} XP</span>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button className="btn btn-outline btn-sm" onClick={e => { e.stopPropagation(); openEdit(quiz); }}><FiEdit2 size={12} /></button>
                  <button
                    className="btn btn-sm"
                    style={{ background: '#FEF2F2', color: 'var(--danger)', border: '1px solid #FECACA' }}
                    onClick={e => { e.stopPropagation(); handleDelete(quiz.id); }}
                  ><FiTrash2 size={12} /></button>
                  {expandedQuiz === quiz.id ? <FiChevronUp size={16} /> : <FiChevronDown size={16} />}
                </div>
              </div>
              {expandedQuiz === quiz.id && quiz.questions?.length > 0 && (
                <div style={{ borderTop: '1px solid var(--gray-100)', padding: '16px 20px', background: 'var(--gray-50)' }}>
                  <p style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px', color: 'var(--gray-500)' }}>Questions Preview</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {quiz.questions.map((q, idx) => (
                      <div key={q.id} style={{ background: 'white', borderRadius: '8px', padding: '12px 16px', border: '1px solid var(--gray-200)' }}>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '8px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)', flexShrink: 0 }}>Q{idx + 1}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap' }}>
                              <QuestionTypeIcon type={q.image_url ? (q.text ? 'text_image' : 'image') : 'text'} />
                              {q.text && <p style={{ fontSize: '13px', fontWeight: 500 }}>{q.text}</p>}
                            </div>
                            {q.image_url && (
                              <img src={q.image_url} alt="question" style={{ maxWidth: '200px', maxHeight: '120px', borderRadius: '6px', objectFit: 'cover', border: '1px solid var(--gray-200)', marginBottom: '8px' }} />
                            )}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                              {q.options?.map((opt, oi) => (
                                <span key={oi} style={{
                                  fontSize: '11px', padding: '3px 10px', borderRadius: '99px',
                                  background: oi === q.correct_answer ? '#D1FAE5' : 'var(--gray-100)',
                                  color: oi === q.correct_answer ? '#065F46' : 'var(--gray-600)',
                                  fontWeight: oi === q.correct_answer ? 700 : 400,
                                  border: oi === q.correct_answer ? '1px solid #6EE7B7' : '1px solid transparent',
                                }}>
                                  {oi === q.correct_answer ? '✓ ' : ''}{opt}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Quiz Modal ── */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
          zIndex: 100, padding: '20px', overflowY: 'auto',
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '720px', marginTop: '20px', marginBottom: '40px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 800 }}>
                {editingQuiz ? '✏️ Edit Quiz' : '🧠 Create New Quiz'}
              </h3>
              <button className="btn btn-outline btn-sm" onClick={() => setShowModal(false)}><FiX size={14} /></button>
            </div>

            {/* Quiz meta */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '8px' }}>
              <div className="input-group" style={{ gridColumn: '1/-1' }}>
                <label>Course *</label>
                <select value={form.course_id} onChange={e => setForm({ ...form, course_id: e.target.value })}>
                  <option value="">Select a course</option>
                  {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
              </div>
              <div className="input-group" style={{ gridColumn: '1/-1' }}>
                <label>Quiz Title *</label>
                <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Python Basics Quiz" />
              </div>
              <div className="input-group" style={{ gridColumn: '1/-1' }}>
                <label>Description</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Optional quiz description" />
              </div>
              <div className="input-group">
                <label>XP Reward</label>
                <input type="number" value={form.xp_reward} onChange={e => setForm({ ...form, xp_reward: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="input-group">
                <label>Time Limit (minutes)</label>
                <input type="number" value={form.time_limit} onChange={e => setForm({ ...form, time_limit: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="input-group">
                <label>Pass Percentage (%)</label>
                <input type="number" value={form.pass_percent} min={0} max={100} onChange={e => setForm({ ...form, pass_percent: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>

            {/* Divider */}
            <div style={{ borderTop: '2px solid var(--gray-100)', margin: '20px 0' }} />

            {/* Questions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h4 style={{ fontSize: '16px', fontWeight: 700 }}>
                Questions <span style={{ color: 'var(--gray-400)', fontWeight: 400, fontSize: '13px' }}>({form.questions.length})</span>
              </h4>
              <button className="btn btn-outline btn-sm" onClick={addQuestion}><FiPlus size={13} /> Add Question</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {form.questions.map((q, qIdx) => (
                <div key={qIdx} style={{
                  border: '2px solid var(--gray-200)', borderRadius: '12px', padding: '18px',
                  background: 'var(--gray-50)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '14px' }}>Q{qIdx + 1}</span>
                      <QuestionTypeIcon type={q.question_type} />
                    </div>
                    {form.questions.length > 1 && (
                      <button
                        className="btn btn-sm"
                        style={{ background: '#FEF2F2', color: '#EF4444', border: '1px solid #FECACA' }}
                        onClick={() => removeQuestion(qIdx)}
                      ><FiTrash2 size={12} /></button>
                    )}
                  </div>

                  {/* Question type selector */}
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                    {[
                      { val: 'text', label: 'Text only', icon: <FiType size={12} /> },
                      { val: 'image', label: 'Image only', icon: <FiImage size={12} /> },
                      { val: 'text_image', label: 'Text + Image', icon: <><FiType size={10} /><FiImage size={10} /></> },
                    ].map(t => (
                      <button
                        key={t.val}
                        onClick={() => updateQuestion(qIdx, 'question_type', t.val)}
                        style={{
                          padding: '4px 12px', borderRadius: '99px', fontSize: '11px', fontWeight: 600,
                          border: `1.5px solid ${q.question_type === t.val ? 'var(--primary)' : 'var(--gray-300)'}`,
                          background: q.question_type === t.val ? 'rgba(79,70,229,0.1)' : 'white',
                          color: q.question_type === t.val ? 'var(--primary)' : 'var(--gray-500)',
                          cursor: 'pointer', display: 'flex', gap: '4px', alignItems: 'center',
                        }}
                      >{t.icon} {t.label}</button>
                    ))}
                  </div>

                  {/* Text input */}
                  {(q.question_type === 'text' || q.question_type === 'text_image') && (
                    <div className="input-group" style={{ marginBottom: '10px' }}>
                      <label style={{ fontSize: '12px' }}>Question Text{q.question_type === 'text' ? ' *' : ''}</label>
                      <textarea
                        value={q.text}
                        onChange={e => updateQuestion(qIdx, 'text', e.target.value)}
                        rows={2}
                        placeholder="Enter your question here…"
                        style={{ fontSize: '14px' }}
                      />
                    </div>
                  )}

                  {/* Image URL input */}
                  {(q.question_type === 'image' || q.question_type === 'text_image') && (
                    <div className="input-group" style={{ marginBottom: '10px' }}>
                      <label style={{ fontSize: '12px' }}>Image URL *</label>
                      <input
                        type="url"
                        value={q.image_url}
                        onChange={e => updateQuestion(qIdx, 'image_url', e.target.value)}
                        placeholder="https://example.com/image.png"
                        style={{ fontSize: '13px' }}
                      />
                      {q.image_url && (
                        <img
                          src={q.image_url} alt="preview"
                          style={{ marginTop: '8px', maxWidth: '220px', maxHeight: '140px', borderRadius: '8px', objectFit: 'cover', border: '1px solid var(--gray-200)' }}
                          onError={e => e.target.style.display = 'none'}
                        />
                      )}
                    </div>
                  )}

                  {/* Options */}
                  <div style={{ marginBottom: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--gray-600)' }}>
  Answer Options <span style={{ color: 'var(--gray-400)', fontWeight: 400 }}>— click radio to mark correct</span>
</label>
                      {q.options.length < 6 && (
                        <button className="btn btn-outline btn-sm" style={{ fontSize: '10px', padding: '2px 8px' }} onClick={() => addOption(qIdx)}>
                          <FiPlus size={10} /> Option
                        </button>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {q.options.map((opt, oi) => (
                        <div key={oi} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input
                            type="radio"
                            name={`correct_${qIdx}`}
                            checked={q.correct_answer === oi}
                            onChange={() => updateQuestion(qIdx, 'correct_answer', oi)}
                            style={{ accentColor: 'var(--primary)', cursor: 'pointer', flexShrink: 0 }}
                          />
                          <input
                            type="text"
                            value={opt}
                            onChange={e => updateOption(qIdx, oi, e.target.value)}
                            placeholder={`Option ${oi + 1}${q.correct_answer === oi ? ' ✓ (correct)' : ''}`}
                            style={{
                              flex: 1, padding: '8px 12px', borderRadius: '8px', fontSize: '13px',
                              border: `1.5px solid ${q.correct_answer === oi ? '#10B981' : 'var(--gray-200)'}`,
                              background: q.correct_answer === oi ? '#F0FDF4' : 'white',
                            }}
                          />
                          {q.options.length > 2 && (
                            <button
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)', padding: '4px' }}
                              onClick={() => removeOption(qIdx, oi)}
                            ><FiX size={13} /></button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Explanation */}
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '12px' }}>Explanation (shown after answer)</label>
                    <input
                      type="text"
                      value={q.explanation}
                      onChange={e => updateQuestion(qIdx, 'explanation', e.target.value)}
                      placeholder="Optional: explain why the answer is correct"
                      style={{ fontSize: '13px' }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <button
              className="btn btn-outline"
              onClick={addQuestion}
              style={{ width: '100%', marginTop: '16px', borderStyle: 'dashed' }}
            >
              <FiPlus size={14} /> Add Another Question
            </button>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px', borderTop: '1px solid var(--gray-100)', paddingTop: '20px' }}>
              <button className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : editingQuiz ? '💾 Update Quiz' : '🚀 Create Quiz'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}