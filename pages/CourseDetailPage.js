import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useBadgeNotification } from '../context/BadgeNotificationContext';
import {
  FiClock, FiUsers, FiBook, FiCheckCircle,
  FiCamera, FiCameraOff, FiAlertTriangle, FiZap, FiEye,
} from 'react-icons/fi';

// ─── helpers ──────────────────────────────────────────────────────────────────
function isDirectVideo(url) {
  if (!url) return false;
  try {
    const path = new URL(url).pathname.toLowerCase();
    return /\.(mp4|webm|ogg|mov|m4v|mkv|avi|wmv|flv)$/.test(path)
      || url.includes('/courses/videos/');
  } catch { return false; }
}

function formatDuration(mins) {
  if (!mins) return '0 min';
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function StrikeIndicator({ strikes, max = 3 }) {
  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      {Array.from({ length: max }).map((_, i) => (
        <div key={i} style={{
          width: '14px', height: '14px', borderRadius: '50%',
          background: i < strikes ? '#EF4444' : 'var(--gray-200)',
          transition: 'background 0.4s',
          boxShadow: i < strikes ? '0 0 8px #EF4444aa' : 'none',
        }} />
      ))}
    </div>
  );
}

// ─── ProgressBar ──────────────────────────────────────────────────────────────
function ProgressBar({ percent, completed, label }) {
  const pct = Math.round(percent || 0);
  return (
    <div style={{ marginBottom: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 13, color: 'var(--gray-500)', fontWeight: 500 }}>
          {label || 'Watch Progress'}
        </span>
        <span style={{ fontSize: 13, fontWeight: 700, color: completed ? 'var(--success)' : 'var(--primary)' }}>
          {completed ? '✅ Complete' : `${pct}%`}
        </span>
      </div>
      <div style={{ height: 8, background: 'var(--gray-100)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 99, transition: 'width 0.6s ease',
          width: `${pct}%`,
          background: completed
            ? 'var(--success)'
            : pct > 60
              ? 'linear-gradient(90deg,#4F46E5,#10B981)'
              : 'var(--primary)',
        }} />
      </div>
    </div>
  );
}

// ─── EmotionVideoPlayer ───────────────────────────────────────────────────────
function EmotionVideoPlayer({ normalUrl, slowUrl, title, duration, courseId, courseTitle, isAdmin, enrolled, hasLessons, updateUser }) {
  const videoRef             = useRef(null);
  const streamRef            = useRef(null);
  const webcamRef            = useRef(null);
  const canvasRef            = useRef(null);
  const detectionIntervalRef = useRef(null);
  const reportIntervalRef    = useRef(null);
  const strikeTimersRef      = useRef([]);
  const strikesRef           = useRef(0);
  const usingSlowRef         = useRef(false);
  const currentEmotionRef    = useRef(null);
  const progressIntervalRef  = useRef(null);
  const lastReportedRef      = useRef(0);

  const [cameraGranted,  setCameraGranted]  = useState(false);
  const [cameraLoading,  setCameraLoading]  = useState(false);
  const [strikes,        setStrikesState]   = useState(0);
  const [usingSlow,      setUsingSlow]      = useState(false);
  const [showModal,      setShowModal]      = useState(false);
  const [faceApiLoaded,  setFaceApiLoaded]  = useState(false);
  const [currentEmotion, setCurrentEmotion] = useState(null);
  const [emotionWarning, setEmotionWarning] = useState(false);
  const [strikeFlash,    setStrikeFlash]    = useState(false);
  const [modelsLoading,  setModelsLoading]  = useState(false);
  const [watchPercent,   setWatchPercent]   = useState(0);

  const MAX_STRIKES = 3;

  const setStrikes = useCallback((val) => {
    const next = typeof val === 'function' ? val(strikesRef.current) : val;
    strikesRef.current = next;
    setStrikesState(next);
  }, []);

  // Wire stream to webcam element after camera granted
  useEffect(() => {
    if (cameraGranted && streamRef.current && webcamRef.current) {
      webcamRef.current.srcObject = streamRef.current;
      webcamRef.current.play().catch(() => {});
    }
  }, [cameraGranted]);

  // ─── Load face-api.js ─────────────────────────────────────────────────────
  const loadFaceApi = useCallback(async () => {
    if (window.faceapi && faceApiLoaded) return true;
    setModelsLoading(true);
    try {
      if (!window.faceapi) {
        await new Promise((resolve, reject) => {
          const s   = document.createElement('script');
          s.src     = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js';
          s.onload  = resolve;
          s.onerror = reject;
          document.head.appendChild(s);
        });
      }
      const MODEL_URL = '/models';
      await Promise.all([
        window.faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        window.faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
      ]);
      setFaceApiLoaded(true);
      setModelsLoading(false);
      return true;
    } catch (err) {
      console.warn('face-api load failed:', err);
      setModelsLoading(false);
      return false;
    }
  }, [faceApiLoaded]);

  // ─── Request camera ───────────────────────────────────────────────────────
  const requestCamera = async () => {
    setCameraLoading(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      setCameraGranted(true);
      setShowModal(false);
      toast.success('📷 Camera connected — emotion detection active');
      loadFaceApi();
    } catch (err) {
      console.error('Camera error:', err);
      if (err.name === 'NotAllowedError') {
        toast.error('Camera permission denied. Please allow camera access in your browser settings.');
      } else if (err.name === 'NotFoundError') {
        toast.error('No camera found. Please connect a webcam and try again.');
      } else {
        toast.error('Could not access camera: ' + err.message);
      }
    } finally {
      setCameraLoading(false);
    }
  };

  // ─── Emotion detection ────────────────────────────────────────────────────
  const detectEmotion = useCallback(async () => {
    if (!window.faceapi || !faceApiLoaded) return false;
    const video = webcamRef.current;
    if (!video || !video.srcObject || video.readyState < 2) return false;
    try {
      const detection = await window.faceapi
        .detectSingleFace(video, new window.faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.3 }))
        .withFaceExpressions();
      if (detection) {
        const exprs    = detection.expressions;
        const dominant = Object.entries(exprs).sort((a, b) => b[1] - a[1])[0];
        const emo      = dominant[0];
        setCurrentEmotion(emo);
        currentEmotionRef.current = emo;
        const isEngaged = ['happy', 'neutral'].includes(emo) && dominant[1] > 0.3;
        setEmotionWarning(!isEngaged);
        return !isEngaged;
      }
    } catch { /* silent */ }
    return false;
  }, [faceApiLoaded]);

  // ─── Report emotion to backend ────────────────────────────────────────────
  const reportToBackend = useCallback(() => {
    if (!cameraGranted) return;
    api.post('/emotion/update', {
      course_id:    courseId,
      course_title: courseTitle,
      emotion:      currentEmotionRef.current || 'unknown',
      strikes:      strikesRef.current,
      slow_mode:    usingSlowRef.current,
    }).catch(() => {});
  }, [cameraGranted, courseId, courseTitle]);

  // ─── Report video progress to backend ────────────────────────────────────
  const reportProgress = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !courseId || !enrolled) return;
    const watched = Math.floor(video.currentTime);
    const total   = Math.floor(video.duration) || 0;
    if (total === 0 || watched === lastReportedRef.current) return;
    lastReportedRef.current = watched;
    const pct = Math.min(100, Math.round((watched / total) * 100));
    setWatchPercent(pct);
    try {
      const res = await api.post('/enroll/video-progress', {
        course_id:       courseId,
        watched_seconds: watched,
        total_seconds:   total,
      });
      if (res.data?.user && updateUser) updateUser(res.data.user);
      if (res.data?.completed && res.data?.xp_earned > 0) {
        toast.success(`🎉 Course completed! +${res.data.xp_earned} XP earned!`, { duration: 5000 });
      }
    } catch { /* non-critical */ }
  }, [courseId, enrolled, updateUser]);

  // ─── Start / stop progress tracking ──────────────────────────────────────
  const startProgressTracking = useCallback(() => {
    clearInterval(progressIntervalRef.current);
    progressIntervalRef.current = setInterval(reportProgress, 10000);
  }, [reportProgress]);

  const stopProgressTracking = useCallback(() => {
    clearInterval(progressIntervalRef.current);
    reportProgress();
  }, [reportProgress]);

  // ─── Update visual progress bar on timeupdate ─────────────────────────────
  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    const pct = Math.min(100, Math.round((video.currentTime / video.duration) * 100));
    setWatchPercent(pct);
  }, []);

  // ─── Strike timers at 33 / 66 / 90 % of video ────────────────────────────
  const getStrikeIntervals = useCallback(() => {
    const totalSec = (duration || 5) * 60;
    return [
      Math.floor(totalSec * 0.33),
      Math.floor(totalSec * 0.66),
      Math.floor(totalSec * 0.90),
    ];
  }, [duration]);

  const setupStrikeTimers = useCallback(() => {
    strikeTimersRef.current.forEach(clearTimeout);
    strikeTimersRef.current = [];
    getStrikeIntervals().forEach((checkAtSec) => {
      const t = setTimeout(async () => {
        if (!videoRef.current || videoRef.current.paused) return;
        const isBad = await detectEmotion();
        if (isBad) {
          setStrikes(prev => {
            const next = prev + 1;
            setStrikeFlash(true);
            setTimeout(() => setStrikeFlash(false), 600);
            toast(`⚠️ Strike ${next}/${MAX_STRIKES} — Distracted emotion detected`, {
              icon: '😶', style: { background: '#FEF3C7', color: '#92400E' },
            });
            if (next >= MAX_STRIKES && !usingSlowRef.current && slowUrl) {
              setTimeout(() => {
                usingSlowRef.current = true;
                setUsingSlow(true);
                toast('🐢 Switching to slow-paced version!', {
                  icon: '🔄', duration: 5000,
                  style: { background: '#EFF6FF', color: '#1E40AF' },
                });
              }, 800);
            }
            return next;
          });
        }
      }, checkAtSec * 1000);
      strikeTimersRef.current.push(t);
    });
  }, [getStrikeIntervals, detectEmotion, setStrikes, slowUrl]);

  // ─── Detection loop (every 4s while video playing) ───────────────────────
  useEffect(() => {
    if (!cameraGranted) return;
    detectionIntervalRef.current = setInterval(() => {
      if (videoRef.current && !videoRef.current.paused) detectEmotion();
    }, 4000);
    return () => clearInterval(detectionIntervalRef.current);
  }, [cameraGranted, detectEmotion]);

  // ─── Emotion report loop (every 4s to backend) ────────────────────────────
  useEffect(() => {
    if (!cameraGranted) return;
    reportIntervalRef.current = setInterval(reportToBackend, 4000);
    return () => clearInterval(reportIntervalRef.current);
  }, [cameraGranted, reportToBackend]);

  // ─── Cleanup on unmount ───────────────────────────────────────────────────
  useEffect(() => () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    strikeTimersRef.current.forEach(clearTimeout);
    clearInterval(detectionIntervalRef.current);
    clearInterval(reportIntervalRef.current);
    clearInterval(progressIntervalRef.current);
    api.post('/emotion/clear').catch(() => {});
  }, []);

  const activeUrl    = (usingSlow && slowUrl) ? slowUrl : normalUrl;
  const isDirect     = isDirectVideo(activeUrl);
  const emotionColor = {
    happy: '#10B981', neutral: '#6B7280', surprised: '#F59E0B',
    sad: '#3B82F6', angry: '#EF4444', disgusted: '#8B5CF6', fearful: '#F97316',
  }[currentEmotion] || '#6B7280';

  if (!normalUrl) return null;

  return (
    <div className="card" style={{ marginBottom: '20px', padding: 0, overflow: 'hidden', position: 'relative' }}>

      {/* ── Header ── */}
      <div style={{
        padding: '14px 20px', borderBottom: '1px solid var(--gray-100)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: usingSlow ? 'linear-gradient(90deg,#EFF6FF,#F0FDF4)' : 'white',
        transition: 'background 0.4s',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>
            {usingSlow ? '🐢 Slow-Pace Version (Auto-Switched)' : '📹 Course Video'}
          </h2>
          {cameraGranted && currentEmotion && (
            <span style={{
              fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '99px',
              background: `${emotionColor}18`, color: emotionColor,
              display: 'flex', alignItems: 'center', gap: '4px',
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: emotionColor, display: 'inline-block' }} />
              {currentEmotion}
            </span>
          )}
          {emotionWarning && cameraGranted && (
            <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '99px', background: '#FEF3C7', color: '#92400E' }}>
              ⚠️ Low engagement
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {cameraGranted ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FiCamera size={14} style={{ color: '#10B981' }} />
              <span style={{ fontSize: '12px', color: '#10B981', fontWeight: 600 }}>Camera ON</span>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FiCameraOff size={14} style={{ color: 'var(--gray-400)' }} />
              <span style={{ fontSize: '12px', color: 'var(--gray-400)' }}>Camera OFF</span>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FiAlertTriangle size={14} style={{ color: strikes > 0 ? '#EF4444' : 'var(--gray-300)' }} />
            <span style={{ fontSize: '12px', fontWeight: 600, color: strikes > 0 ? '#EF4444' : 'var(--gray-400)' }}>
              Strikes
            </span>
            <StrikeIndicator strikes={strikes} />
          </div>
        </div>
      </div>

      {/* ── Strike flash overlay ── */}
      {strikeFlash && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(239,68,68,0.2)', zIndex: 10, pointerEvents: 'none' }} />
      )}

      {/* ── Click-to-start overlay (before camera granted) ── */}
      {!cameraGranted && (
        <div
          style={{
            background: '#0F172A', minHeight: '280px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: '16px', cursor: 'pointer',
          }}
          onClick={() => setShowModal(true)}
        >
          <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FiCamera size={32} style={{ color: 'white' }} />
          </div>
          <p style={{ color: 'white', fontWeight: 700, fontSize: '17px' }}>Click to enable camera & play</p>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', textAlign: 'center', maxWidth: '340px' }}>
            {isAdmin
              ? 'As admin, your live camera feed will be shown on the video.'
              : 'Emotion detection requires your camera. Feed is hidden from you.'}
          </p>
          <button className="btn btn-primary" style={{ marginTop: '8px' }}>
            <FiCamera size={14} /> Enable Camera
          </button>
        </div>
      )}

      {/* ── Course video (shown after camera granted) ── */}
      {cameraGranted && (
        isDirect ? (
          <video
            ref={videoRef}
            controls
            src={activeUrl}
            key={activeUrl}
            onPlay={() => { setupStrikeTimers(); startProgressTracking(); }}
            onPause={stopProgressTracking}
            onEnded={stopProgressTracking}
            onTimeUpdate={handleTimeUpdate}
            style={{ width: '100%', maxHeight: '460px', background: '#000', display: 'block' }}
          />
        ) : (
          <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
            <iframe
              key={activeUrl}
              src={activeUrl}
              title={title || 'Course video'}
              allowFullScreen
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
            />
          </div>
        )
      )}

      {/* ── Video progress bar — only for video-only courses (no lessons), enrolled students ── */}
      {cameraGranted && enrolled && !hasLessons && (
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--gray-100)' }}>
          <ProgressBar
            percent={watchPercent}
            completed={watchPercent >= 95}
            label="Video Progress"
          />
        </div>
      )}

      {/* ── Webcam element — always in DOM ── */}
      <div style={
        isAdmin ? {
          position: 'absolute', bottom: '16px', right: '16px', zIndex: 20,
          border: '2px solid #4F46E5', borderRadius: '10px', overflow: 'hidden',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)', width: '180px',
          display: cameraGranted ? 'block' : 'none',
        } : {
          position: 'fixed', top: '-9999px', left: '-9999px',
          width: '1px', height: '1px', opacity: 0, pointerEvents: 'none',
        }
      }>
        {isAdmin && cameraGranted && (
          <div style={{ background: '#4F46E5', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FiEye size={11} style={{ color: 'white' }} />
            <span style={{ color: 'white', fontSize: '11px', fontWeight: 600 }}>Admin Live View</span>
          </div>
        )}
        <video
          ref={webcamRef}
          autoPlay
          muted
          playsInline
          style={{ width: '100%', display: 'block', background: '#000' }}
        />
      </div>

      {/* Hidden canvas */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* ── Camera permission modal ── */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 200, padding: '20px',
        }}>
          <div className="card" style={{ maxWidth: '440px', width: '100%', textAlign: 'center', padding: '40px 32px' }}>
            <div style={{
              width: '80px', height: '80px', borderRadius: '50%', margin: '0 auto 20px',
              background: 'linear-gradient(135deg,#4F46E5,#7C3AED)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <FiCamera size={36} style={{ color: 'white' }} />
            </div>
            <h3 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '10px' }}>Camera Required</h3>
            <p style={{ color: 'var(--gray-500)', fontSize: '14px', lineHeight: 1.6, marginBottom: '20px' }}>
              This course uses <strong>emotion detection</strong> to personalise your learning.
              {isAdmin
                ? ' As admin, your live feed is visible in the video corner.'
                : ' Your camera is active but the feed is hidden from you — no distraction.'}
            </p>
            <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '10px', padding: '12px 16px', marginBottom: '24px', textAlign: 'left' }}>
              <p style={{ fontSize: '13px', color: '#065F46', fontWeight: 600, marginBottom: '4px' }}>How it works:</p>
              <ul style={{ fontSize: '12px', color: '#047857', paddingLeft: '16px', margin: 0, lineHeight: 1.7 }}>
                <li>Checks emotion at 33%, 66%, 90% of the video</li>
                <li>3 strikes → switches to slow-paced version</li>
                <li>😊 Happy / neutral = engaged (no strike)</li>
                {isAdmin && <li>Admin sees live webcam in the video corner</li>}
              </ul>
            </div>
            {modelsLoading && (
              <p style={{ fontSize: '12px', color: 'var(--gray-400)', marginBottom: '12px' }}>
                ⏳ Loading emotion detection models…
              </p>
            )}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={requestCamera} disabled={cameraLoading}>
                {cameraLoading ? 'Requesting…' : <><FiCamera size={14} /> Allow Camera</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function CourseDetailPage() {
  const { id }               = useParams();
  const { user, updateUser } = useAuth();
  const { awardBadges } = useBadgeNotification();
  const navigate             = useNavigate();
  const [course,           setCourse]           = useState(null);
  const [enrolled,         setEnrolled]         = useState(false);
  const [loading,          setLoading]          = useState(true);
  const [enrolling,        setEnrolling]        = useState(false);
  const [completedLessons, setCompletedLessons] = useState({});
  const [enrollment,       setEnrollment]       = useState(null);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    Promise.all([
      api.get(`/courses/${id}`),
      api.get(`/enroll/check/${id}`),
    ]).then(([courseRes, enrollRes]) => {
      setCourse(courseRes.data);
      setEnrolled(enrollRes.data.enrolled);
    }).catch(console.error)
      .finally(() => setLoading(false));

    // Fetch current enrollment to get live progress
    api.get('/enroll/my').then(res => {
      const e = res.data.find(e => String(e.course_id) === String(id));
      if (e) {
        setEnrollment(e);
        const done = {};
        (e.completed_lesson_ids || []).forEach(lid => { done[lid] = true; });
        setCompletedLessons(done);
      }
    }).catch(() => {});
  }, [id]);

  const handleEnroll = async () => {
    if (enrolled) { navigate('/my-courses'); return; }
    setEnrolling(true);
    try {
      await api.post('/enroll/', { course_id: parseInt(id) });
      setEnrolled(true);
      toast.success('🎉 Successfully enrolled!');
      // Refresh enrollment
      const res = await api.get('/enroll/my');
      const e = res.data.find(e => String(e.course_id) === String(id));
      if (e) setEnrollment(e);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Enrollment failed');
    } finally { setEnrolling(false); }
  };

  const handleCompleteLesson = async (lessonId) => {
    try {
      const res = await api.post(`/enroll/lesson/${lessonId}/complete`);
      toast.success(`✅ Lesson complete! +${res.data.xp_earned} XP`);
      updateUser(res.data.user);
      awardBadges(res.data.newly_awarded);
      setCompletedLessons(prev => ({ ...prev, [lessonId]: true }));
      // Refresh enrollment progress
      const enrollRes = await api.get('/enroll/my');
      const e = enrollRes.data.find(e => String(e.course_id) === String(id));
      if (e) setEnrollment(e);
    } catch { toast.error('Failed to mark lesson as complete'); }
  };

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;
  if (!course)  return <div className="page-container"><p>Course not found</p></div>;

  const lessonCount   = course.lessons?.length ?? course.lesson_count ?? 0;
  const totalDuration = course.lessons?.reduce((sum, l) => sum + (l.duration || 0), 0) || course.duration || 0;
  const hasLessons    = lessonCount > 0;
  const progressPct   = enrollment?.progress_percent || 0;
  const isCompleted   = enrollment?.completed || false;

  return (
    <div className="page-container" style={{ animation: 'fadeIn 0.3s ease' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px', alignItems: 'start' }}>

        {/* ── Main column ── */}
        <div>
          {/* Course header */}
          <div className="card" style={{ marginBottom: '20px', padding: 0, overflow: 'hidden' }}>
            <img src={course.thumbnail} alt={course.title}
              style={{ width: '100%', height: '260px', objectFit: 'cover' }} />
            <div style={{ padding: '24px' }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                <span className={`badge badge-${course.difficulty === 'beginner' ? 'success' : course.difficulty === 'intermediate' ? 'warning' : 'danger'}`}>
                  {course.difficulty}
                </span>
                <span className="badge badge-primary">{course.category}</span>
              </div>
              <h1 style={{ fontSize: '26px', fontWeight: 800, marginBottom: '8px' }}>{course.title}</h1>
              <p style={{ color: 'var(--gray-600)', lineHeight: 1.7 }}>{course.description}</p>
              <div style={{ display: 'flex', gap: '20px', marginTop: '16px', color: 'var(--gray-500)', fontSize: '14px', flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><FiBook /> {lessonCount} Lesson{lessonCount !== 1 ? 's' : ''}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><FiClock /> {formatDuration(totalDuration)}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><FiUsers /> {course.enrollment_count} students</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><FiZap style={{ color: '#F59E0B' }} /> +{course.xp_reward} XP</span>
              </div>

              {/* Inline progress for enrolled students */}
              {enrolled && (
                <div style={{ marginTop: '20px', padding: '16px', background: 'var(--gray-50)', borderRadius: '10px' }}>
                  <ProgressBar
                    percent={progressPct}
                    completed={isCompleted}
                    label={hasLessons ? 'Lesson Progress' : 'Video Progress'}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Emotion-aware video player */}
          {course.video_url && (
            <EmotionVideoPlayer
              normalUrl={course.video_url}
              slowUrl={course.slow_video_url}
              title={course.title}
              duration={totalDuration}
              courseId={course.id}
              courseTitle={course.title}
              isAdmin={isAdmin}
              enrolled={enrolled}
              hasLessons={hasLessons}
              updateUser={updateUser}
            />
          )}

          {/* Admin: Both Videos Preview */}
          {isAdmin && course.video_url && (
            <div className="card" style={{ marginBottom: '20px', padding: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>
                🎬 Admin Video Preview
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {/* Normal Video */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{
                      background: '#D1FAE5', color: '#065F46',
                      fontSize: '11px', fontWeight: 700,
                      padding: '2px 8px', borderRadius: '99px',
                    }}>▶ NORMAL PACE</span>
                  </div>
                  <video
                    controls
                    src={course.video_url}
                    style={{ width: '100%', borderRadius: '8px', background: '#000', maxHeight: '200px' }}
                  />
                </div>
                {/* Slow Video */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    {course.slow_video_url ? (
                      <span style={{
                        background: '#DBEAFE', color: '#1E40AF',
                        fontSize: '11px', fontWeight: 700,
                        padding: '2px 8px', borderRadius: '99px',
                      }}>🐢 SLOW PACE</span>
                    ) : (
                      <span style={{
                        background: '#FEF3C7', color: '#92400E',
                        fontSize: '11px', fontWeight: 700,
                        padding: '2px 8px', borderRadius: '99px',
                      }}>⚠️ NO SLOW VIDEO</span>
                    )}
                  </div>
                  {course.slow_video_url ? (
                    <video
                      controls
                      src={course.slow_video_url}
                      style={{ width: '100%', borderRadius: '8px', background: '#000', maxHeight: '200px' }}
                    />
                  ) : (
                    <div style={{
                      width: '100%', height: '200px', borderRadius: '8px',
                      background: '#F9FAFB', border: '2px dashed #D1D5DB',
                      display: 'flex', alignItems: 'center',
                      justifyContent: 'center', flexDirection: 'column', gap: '8px',
                    }}>
                      <p style={{ color: '#9CA3AF', fontSize: '13px', fontWeight: 600 }}>No slow video uploaded</p>
                      <p style={{ color: '#D1D5DB', fontSize: '11px' }}>Add one in Admin → Courses → Edit</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Quizzes */}
          {course.quizzes?.length > 0 && (
            <div className="card" style={{ marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>🧠 Course Quizzes</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {course.quizzes.map(q => (
                  <div key={q.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '14px 18px', background: 'var(--gray-50)', borderRadius: '10px', border: '1px solid var(--gray-200)',
                  }}>
                    <div>
                      <p style={{ fontWeight: 600, fontSize: '14px' }}>{q.title}</p>
                      <p style={{ fontSize: '12px', color: 'var(--gray-500)' }}>
                        {q.question_count} questions · ⏱️ {q.time_limit}min · ✅ Pass: {q.pass_percent}% · ⚡ +{q.xp_reward} XP
                      </p>
                    </div>
                    {enrolled && (
                      <button className="btn btn-primary btn-sm" onClick={() => navigate(`/quiz/${q.id}`)}>
                        Take Quiz →
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lessons */}
          {lessonCount > 0 && (
            <div className="card">
              <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>📋 Course Content</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(course.lessons || []).sort((a, b) => a.order - b.order).map((lesson, idx) => {
                  const done = completedLessons[lesson.id];
                  return (
                    <div key={lesson.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '12px 16px',
                      background: done ? '#F0FDF4' : 'var(--gray-50)',
                      borderRadius: '8px',
                      border: `1px solid ${done ? '#BBF7D0' : 'var(--gray-200)'}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{
                          width: '28px', height: '28px', borderRadius: '50%',
                          background: done ? '#10B981' : 'var(--primary)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: 'white', fontSize: '12px', fontWeight: 700, flexShrink: 0,
                        }}>
                          {done ? '✓' : idx + 1}
                        </span>
                        <div>
                          <p style={{ fontWeight: 500, fontSize: '14px' }}>{lesson.title}</p>
                          <p style={{ fontSize: '12px', color: 'var(--gray-500)' }}>
                            {lesson.duration ? `${lesson.duration}min` : 'No duration'} · +{lesson.xp_reward} XP
                          </p>
                        </div>
                      </div>
                      {enrolled && (
                        <button
                          className={`btn btn-sm ${done ? 'btn-success' : 'btn-outline'}`}
                          onClick={() => !done && handleCompleteLesson(lesson.id)}
                          disabled={done}
                          style={{ opacity: done ? 0.7 : 1 }}
                        >
                          <FiCheckCircle size={13} /> {done ? 'Done' : 'Complete'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Sidebar ── */}
        <div style={{ position: 'sticky', top: '24px' }}>
          <div className="card">
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <p style={{ fontSize: '32px', fontWeight: 800, color: 'var(--primary)' }}>FREE</p>
              <p style={{ color: 'var(--gray-500)', fontSize: '14px' }}>+ {course.xp_reward} XP upon completion ⚡</p>
            </div>
            <button
              className={`btn btn-lg ${enrolled ? 'btn-success' : 'btn-primary'}`}
              onClick={handleEnroll} disabled={enrolling}
              style={{ width: '100%', justifyContent: 'center', marginBottom: '12px' }}
            >
              {enrolling ? 'Processing...' : enrolled ? '✅ Go to My Courses' : '🚀 Enroll Now'}
            </button>
            {enrolled && (
              <p style={{ textAlign: 'center', color: 'var(--success)', fontSize: '13px', fontWeight: 600 }}>
                You're enrolled in this course!
              </p>
            )}
            <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { icon: '👨‍🏫', label: 'Instructor',       value: course.instructor || '—' },
                { icon: '📚', label: 'Lessons',           value: hasLessons ? `${lessonCount} lesson${lessonCount !== 1 ? 's' : ''}` : 'Video course' },
                { icon: '⏱️', label: 'Duration',          value: formatDuration(totalDuration) },
                { icon: '📊', label: 'Level',             value: course.difficulty },
                { icon: '🧠', label: 'Adaptive Video',    value: course.slow_video_url ? '✅ Available' : '—' },
                { icon: '😊', label: 'Emotion Detection', value: '✅ Active' },
                ...(isAdmin ? [{ icon: '🎥', label: 'Admin Camera', value: '✅ Live view ON' }] : []),
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                  <span style={{ color: 'var(--gray-500)' }}>{item.icon} {item.label}</span>
                  <span style={{ fontWeight: 500 }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ marginTop: '16px', background: 'linear-gradient(135deg,#EFF6FF,#F0FDF4)' }}>
            <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '10px' }}>😊 Emotion-Adaptive Learning</h4>
            <p style={{ fontSize: '12px', color: 'var(--gray-600)', lineHeight: 1.6, marginBottom: '12px' }}>
              {isAdmin
                ? 'Admin mode: live camera visible on video. Student sessions stream to your dashboard.'
                : 'Camera monitors engagement. 3 distractions → slow video. Feed stays hidden from you.'}
            </p>
            {['😊 Happy / Neutral = engaged', '😐 Sad / Angry = strike', '3 strikes → slow mode'].map(tip => (
              <p key={tip} style={{ fontSize: '11px', color: 'var(--gray-500)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--primary)', display: 'inline-block', flexShrink: 0 }} />
                {tip}
              </p>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}