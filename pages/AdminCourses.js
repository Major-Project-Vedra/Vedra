import React, { useEffect, useState } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { FiEdit2, FiTrash2, FiPlus, FiList, FiUpload, FiX } from 'react-icons/fi';

const EMPTY_FORM = {
  title: '', description: '', category: '', difficulty: 'beginner',
  thumbnail: '', video_url: '', slow_video_url: '', duration: 0,
  instructor: '', xp_reward: 100, is_published: true
};

const EMPTY_LESSON = { title: '', content: '', video_url: '', order: 0, duration: 0, xp_reward: 20 };

export default function AdminCourses() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Lesson management
  const [lessonCourse, setLessonCourse] = useState(null);
  const [showLessonModal, setShowLessonModal] = useState(false);
  const [lessonForm, setLessonForm] = useState(EMPTY_LESSON);
  const [savingLesson, setSavingLesson] = useState(false);

  // Video upload
  const [uploading, setUploading] = useState(false);
  const [uploadField, setUploadField] = useState(null); // 'video_url' | 'slow_video_url'

  const fetchCourses = () => {
    api.get('/courses/?per_page=100')
      .then(res => setCourses(res.data.courses))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchCourses(); }, []);

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setShowModal(true); };
  const openEdit = (c) => { setEditing(c); setForm({ ...EMPTY_FORM, ...c }); setShowModal(true); };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/courses/${editing.id}`, form);
        toast.success('Course updated!');
      } else {
        await api.post('/courses/', form);
        toast.success('Course created!');
      }
      setShowModal(false);
      fetchCourses();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save course');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this course?')) return;
    try {
      await api.delete(`/courses/${id}`);
      toast.success('Course deleted');
      fetchCourses();
    } catch { toast.error('Failed to delete'); }
  };

  // ── Video Upload ──────────────────────────────────────────────
  const handleVideoUpload = async (e, field) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setUploadField(field);
    const formData = new FormData();
    formData.append('video', file);
    try {
      const res = await api.post('/courses/upload-video', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setForm(prev => ({ ...prev, [field]: res.data.video_url }));
      toast.success('Video uploaded!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Upload failed');
    } finally { setUploading(false); setUploadField(null); }
  };

  // ── Lessons ───────────────────────────────────────────────────
  const openLessons = (course) => { setLessonCourse(course); setLessonForm(EMPTY_LESSON); setShowLessonModal(true); };

  const handleAddLesson = async (e) => {
    e.preventDefault();
    setSavingLesson(true);
    try {
      await api.post(`/courses/${lessonCourse.id}/lessons`, lessonForm);
      toast.success('Lesson added!');
      setLessonForm(EMPTY_LESSON);
      fetchCourses(); // refresh lesson count
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add lesson');
    } finally { setSavingLesson(false); }
  };

  return (
    <div className="page-container" style={{ animation: 'fadeIn 0.3s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div className="page-header" style={{ marginBottom: 0 }}>
          <h1>📚 Manage Courses</h1>
          <p>{courses.length} courses total</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}><FiPlus /> Add Course</button>
      </div>

      {loading ? <div className="loading-screen"><div className="spinner" /></div> : (
        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>Course</th><th>Category</th><th>Difficulty</th><th>Lessons</th><th>Students</th><th>XP</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {courses.map(c => (
                  <tr key={c.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <img src={c.thumbnail} alt="" style={{ width: '48px', height: '32px', borderRadius: '4px', objectFit: 'cover' }} />
                        <div>
                          <p style={{ fontWeight: 600, fontSize: '13px' }}>{c.title}</p>
                          <p style={{ fontSize: '11px', color: 'var(--gray-500)' }}>{c.instructor}</p>
                        </div>
                      </div>
                    </td>
                    <td><span style={{ fontSize: '13px' }}>{c.category}</span></td>
                    <td><span className={`badge badge-${c.difficulty === 'beginner' ? 'success' : c.difficulty === 'intermediate' ? 'warning' : 'danger'}`}>{c.difficulty}</span></td>
                    <td>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => openLessons(c)}
                        style={{ fontSize: '12px' }}
                      >
                        <FiList size={12} /> {c.lesson_count} lessons
                      </button>
                    </td>
                    <td>{c.enrollment_count}</td>
                    <td>+{c.xp_reward}</td>
                    <td><span className={`badge badge-${c.is_published ? 'success' : 'warning'}`}>{c.is_published ? 'Published' : 'Draft'}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn btn-outline btn-sm" onClick={() => openEdit(c)}><FiEdit2 size={12} /></button>
                        <button className="btn btn-sm" style={{ background: '#FEF2F2', color: 'var(--danger)', border: '1px solid #FECACA' }} onClick={() => handleDelete(c.id)}><FiTrash2 size={12} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Course Modal ── */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700 }}>{editing ? 'Edit Course' : 'Add New Course'}</h3>
              <button className="btn btn-outline btn-sm" onClick={() => setShowModal(false)}><FiX size={14} /></button>
            </div>
            <form onSubmit={handleSave}>
              {[
                { key: 'title', label: 'Title', type: 'text', required: true },
                { key: 'instructor', label: 'Instructor', type: 'text' },
                { key: 'category', label: 'Category', type: 'text' },
                { key: 'thumbnail', label: 'Thumbnail URL', type: 'url' },
                { key: 'duration', label: 'Duration (minutes)', type: 'number' },
                { key: 'xp_reward', label: 'XP Reward', type: 'number' },
              ].map(({ key, label, type, required }) => (
                <div className="input-group" key={key}>
                  <label>{label}</label>
                  <input type={type} value={form[key]} onChange={e => setForm({ ...form, [key]: type === 'number' ? parseInt(e.target.value) || 0 : e.target.value })} required={required} />
                </div>
              ))}

              {/* Video URL fields with upload buttons */}
              {[
                { key: 'video_url', label: 'Course Video URL (or upload below)' },
                { key: 'slow_video_url', label: 'Slow/Adaptive Video URL (optional)' },
              ].map(({ key, label }) => (
                <div className="input-group" key={key}>
                  <label>{label}</label>
                  <input
                    type="url"
                    value={form[key] || ''}
                    onChange={e => setForm({ ...form, [key]: e.target.value })}
                    placeholder="https://... or use Upload button"
                  />
                  <label
                    htmlFor={`upload-${key}`}
                    className="btn btn-outline btn-sm"
                    style={{ marginTop: '6px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    {uploading && uploadField === key ? 'Uploading…' : <><FiUpload size={12} /> Upload video file</>}
                  </label>
                  <input
                    id={`upload-${key}`}
                    type="file"
                    accept="video/*"
                    style={{ display: 'none' }}
                    onChange={e => handleVideoUpload(e, key)}
                    disabled={uploading}
                  />
                  {form[key] && (
                    <p style={{ fontSize: '11px', color: 'var(--success)', marginTop: '4px', wordBreak: 'break-all' }}>
                      ✅ {form[key]}
                    </p>
                  )}
                </div>
              ))}

              <div className="input-group">
                <label>Difficulty</label>
                <select value={form.difficulty} onChange={e => setForm({ ...form, difficulty: e.target.value })}>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
              <div className="input-group">
                <label>Description</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <input type="checkbox" id="published" checked={form.is_published} onChange={e => setForm({ ...form, is_published: e.target.checked })} />
                <label htmlFor="published" style={{ fontSize: '14px', cursor: 'pointer' }}>Published</label>
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving || uploading}>
                  {saving ? 'Saving...' : editing ? 'Update Course' : 'Create Course'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Lesson Modal ── */}
      {showLessonModal && lessonCourse && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700 }}>📋 Add Lesson</h3>
                <p style={{ fontSize: '13px', color: 'var(--gray-500)' }}>Course: {lessonCourse.title}</p>
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => setShowLessonModal(false)}><FiX size={14} /></button>
            </div>
            <form onSubmit={handleAddLesson}>
              <div className="input-group">
                <label>Lesson Title *</label>
                <input type="text" value={lessonForm.title} onChange={e => setLessonForm({ ...lessonForm, title: e.target.value })} required />
              </div>
              <div className="input-group">
                <label>Video URL</label>
                <input type="url" value={lessonForm.video_url} onChange={e => setLessonForm({ ...lessonForm, video_url: e.target.value })} placeholder="https://..." />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div className="input-group">
                  <label>Order</label>
                  <input type="number" value={lessonForm.order} onChange={e => setLessonForm({ ...lessonForm, order: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="input-group">
                  <label>Duration (min)</label>
                  <input type="number" value={lessonForm.duration} onChange={e => setLessonForm({ ...lessonForm, duration: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="input-group">
                  <label>XP Reward</label>
                  <input type="number" value={lessonForm.xp_reward} onChange={e => setLessonForm({ ...lessonForm, xp_reward: parseInt(e.target.value) || 0 })} />
                </div>
              </div>
              <div className="input-group">
                <label>Content / Notes</label>
                <textarea value={lessonForm.content} onChange={e => setLessonForm({ ...lessonForm, content: e.target.value })} rows={3} />
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowLessonModal(false)}>Close</button>
                <button type="submit" className="btn btn-primary" disabled={savingLesson}>
                  {savingLesson ? 'Adding...' : '+ Add Lesson'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}