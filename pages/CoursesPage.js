import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { FiSearch, FiFilter, FiClock, FiUsers } from 'react-icons/fi';

const DIFFICULTIES = ['All', 'beginner', 'intermediate', 'advanced'];

export default function CoursesPage() {
  const [courses, setCourses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, per_page: 12 });
      if (search) params.set('search', search);
      if (difficulty) params.set('difficulty', difficulty);
      if (category) params.set('category', category);
      const res = await api.get(`/courses/?${params}`);
      setCourses(res.data.courses);
      setTotalPages(res.data.pages);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    api.get('/courses/categories').then(res => setCategories(res.data));
  }, []);

  useEffect(() => {
    const timer = setTimeout(fetchCourses, 300);
    return () => clearTimeout(timer);
  }, [search, difficulty, category, page]);

  const difficultyColor = { beginner: 'success', intermediate: 'warning', advanced: 'danger' };

  return (
    <div className="page-container" style={{ animation: 'fadeIn 0.3s ease' }}>
      <div className="page-header">
        <h1>📚 Course Catalog</h1>
        <p>Explore our library of courses and start learning today</p>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '24px', padding: '16px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '200px', background: 'var(--gray-50)', borderRadius: '8px', padding: '8px 12px', border: '1.5px solid var(--gray-200)' }}>
            <FiSearch color="var(--gray-400)" />
            <input
              type="text" placeholder="Search courses..."
              value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              style={{ border: 'none', background: 'none', fontSize: '14px', width: '100%' }}
            />
          </div>
          <select value={difficulty} onChange={e => { setDifficulty(e.target.value === 'All' ? '' : e.target.value); setPage(1); }}
            style={{ padding: '10px 12px', borderRadius: '8px', border: '1.5px solid var(--gray-200)', fontSize: '14px', background: 'white', minWidth: '140px' }}>
            {DIFFICULTIES.map(d => <option key={d} value={d === 'All' ? '' : d}>{d === 'All' ? 'All Levels' : d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
          </select>
          <select value={category} onChange={e => { setCategory(e.target.value); setPage(1); }}
            style={{ padding: '10px 12px', borderRadius: '8px', border: '1.5px solid var(--gray-200)', fontSize: '14px', background: 'white', minWidth: '140px' }}>
            <option value="">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="loading-screen"><div className="spinner" /></div>
      ) : courses.length === 0 ? (
        <div className="empty-state"><div className="icon">🔍</div><h3>No courses found</h3><p>Try adjusting your filters</p></div>
      ) : (
        <div className="grid-3">
          {courses.map(course => (
            <Link key={course.id} to={`/courses/${course.id}`} style={{ textDecoration: 'none' }}>
              <div className="card" style={{ padding: 0, overflow: 'hidden', transition: 'transform 0.2s, box-shadow 0.2s', cursor: 'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = 'var(--shadow-lg)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}>
                <img src={course.thumbnail} alt={course.title} style={{ width: '100%', height: '180px', objectFit: 'cover' }} />
                <div style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span className={`badge badge-${difficultyColor[course.difficulty] || 'primary'}`}>{course.difficulty}</span>
                    <span style={{ fontSize: '12px', color: 'var(--gray-500)' }}>{course.category}</span>
                  </div>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--gray-900)', marginBottom: '6px', lineHeight: 1.4 }}>{course.title}</h3>
                  <p style={{ fontSize: '13px', color: 'var(--gray-500)', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{course.description}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--gray-100)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--gray-500)', fontSize: '12px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><FiUsers size={12} />{course.enrollment_count}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><FiClock size={12} />{course.duration}min</span>
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary)' }}>+{course.xp_reward} XP ⚡</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '24px' }}>
          <button className="btn btn-outline btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
          <span style={{ padding: '6px 14px', fontSize: '14px', color: 'var(--gray-600)' }}>Page {page} of {totalPages}</span>
          <button className="btn btn-outline btn-sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
        </div>
      )}
    </div>
  );
}
