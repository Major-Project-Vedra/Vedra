import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

const RANK_COLORS = ['#F59E0B', '#9CA3AF', '#B45309'];
const RANK_EMOJIS = ['🥇', '🥈', '🥉'];

/**
 * Compute dense rank with tie support.
 * Returns an array of rank numbers (0-based) parallel to the input array.
 * People with identical level+xp share the same rank.
 *
 * Example: [100xp, 100xp, 80xp] → ranks [0, 0, 1]
 */
function computeRanks(leaders, tab, quizStats) {
  const ranks = [];
  let currentRank = 0;

  for (let i = 0; i < leaders.length; i++) {
    if (i === 0) {
      ranks.push(0);
    } else {
      const prev = leaders[i - 1];
      const curr = leaders[i];

      let isTie;
      if (tab === 'xp') {
        isTie = curr.level === prev.level && curr.xp === prev.xp;
      } else {
        const prevScore = quizStats[prev.id]?.avg_score ?? 0;
        const currScore = quizStats[curr.id]?.avg_score ?? 0;
        isTie = currScore === prevScore;
      }

      if (isTie) {
        ranks.push(ranks[i - 1]); // same rank as previous
      } else {
        currentRank = i; // dense rank = position after all tied entries
        ranks.push(currentRank);
      }
    }
  }
  return ranks;
}

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [leaders,   setLeaders]   = useState([]);
  const [quizStats, setQuizStats] = useState({});
  const [loading,   setLoading]   = useState(true);
  const [tab,       setTab]       = useState('xp');

  useEffect(() => {
    api.get('/progress/leaderboard')
      .then(res => {
        setLeaders(res.data);
        return api.get('/progress/leaderboard-quiz').catch(() => ({ data: {} }));
      })
      .then(qRes => { if (qRes?.data) setQuizStats(qRes.data); })
      .finally(() => setLoading(false));
  }, []);

  const sortedLeaders = tab === 'xp'
    ? leaders
    : [...leaders].sort((a, b) => {
        const aScore = quizStats[a.id]?.avg_score ?? 0;
        const bScore = quizStats[b.id]?.avg_score ?? 0;
        return bScore - aScore;
      });

  const ranks = computeRanks(sortedLeaders, tab, quizStats);

  // Find all unique people who share rank 0 (gold), 1 (silver), 2 (bronze)
  const topTierLeaders = sortedLeaders.filter((_, i) => ranks[i] <= 2);

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;

  return (
    <div className="page-container" style={{ animation: 'fadeIn 0.3s ease', maxWidth: '860px' }}>
      <div className="page-header">
        <h1>🏆 Leaderboard</h1>
        <p>Top learners ranked by XP, level, and quiz performance</p>
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        {[
          { key: 'xp',   label: '⚡ XP & Level'  },
          { key: 'quiz', label: '🧠 Quiz Scores'  },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={tab === t.key ? 'btn btn-primary' : 'btn btn-outline'}
            style={{ fontSize: '14px' }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Podium — show top-tier leaders (handles ties) */}
      {tab === 'xp' && topTierLeaders.length > 0 && (() => {
        // Group by rank for podium display
        const gold   = sortedLeaders.filter((_, i) => ranks[i] === 0);
        const silver = sortedLeaders.filter((_, i) => ranks[i] === 1);
        const bronze = sortedLeaders.filter((_, i) => ranks[i] === 2);

        const PodiumCard = ({ group, rank }) => {
          if (group.length === 0) return <div />;
          const color = RANK_COLORS[rank];
          return (
            <div className="card" style={{
              textAlign: 'center',
              border: `2px solid ${color}30`,
              transform: rank === 0 ? 'scale(1.05)' : 'none',
              background: rank === 0 ? `linear-gradient(135deg, ${color}10, white)` : 'white',
            }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>{RANK_EMOJIS[rank]}</div>
              {/* Show stacked avatars if multiple people share this rank */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                {group.map(leader => (
                  <div key={leader.id} style={{
                    width: group.length > 1 ? '40px' : '56px',
                    height: group.length > 1 ? '40px' : '56px',
                    borderRadius: '50%',
                    background: `linear-gradient(135deg, ${color}, ${color}88)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'white', fontWeight: 800,
                    fontSize: group.length > 1 ? '14px' : '20px',
                    border: `2px solid ${color}`,
                  }}>
                    {leader.full_name?.[0] || leader.username[0]}
                  </div>
                ))}
              </div>
              {group.length === 1 ? (
                <>
                  <p style={{ fontWeight: 700, fontSize: '14px' }}>{group[0].full_name || group[0].username}</p>
                  <p style={{ color: 'var(--gray-500)', fontSize: '12px' }}>Level {group[0].level}</p>
                  <p style={{ color, fontWeight: 700, fontSize: '16px', marginTop: '4px' }}>{group[0].xp} XP</p>
                  {group[0].streak > 0 && <p style={{ fontSize: '11px', color: '#F59E0B', marginTop: '4px' }}>🔥 {group[0].streak} day streak</p>}
                </>
              ) : (
                <>
                  <p style={{ fontWeight: 700, fontSize: '13px', color }}>
                    {group.map(l => l.full_name || l.username).join(' & ')}
                  </p>
                  <p style={{ color: 'var(--gray-500)', fontSize: '12px' }}>Tied — Level {group[0].level}</p>
                  <p style={{ color, fontWeight: 700, fontSize: '15px', marginTop: '4px' }}>{group[0].xp} XP each</p>
                </>
              )}
            </div>
          );
        };

        return (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr', gap: '12px', marginBottom: '24px' }}>
            <PodiumCard group={silver} rank={1} />
            <PodiumCard group={gold}   rank={0} />
            <PodiumCard group={bronze} rank={2} />
          </div>
        );
      })()}

      {/* Main table */}
      <div className="card">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Student</th>
                <th>Level</th>
                <th>XP</th>
                <th>Streak</th>
                {tab === 'quiz' && <>
                  <th>Quizzes Taken</th>
                  <th>Avg Score</th>
                  <th>Best Score</th>
                </>}
              </tr>
            </thead>
            <tbody>
              {sortedLeaders.map((leader, idx) => {
                const rank = ranks[idx];
                const qs   = quizStats[leader.id];
                const medalOrNumber = rank < 3
                  ? RANK_EMOJIS[rank]
                  : `#${rank + 1}`;

                return (
                  <tr
                    key={leader.id}
                    style={{ background: leader.id === user?.id ? 'rgba(79,70,229,0.05)' : undefined }}
                  >
                    <td>
                      <span style={{
                        fontWeight: 700,
                        fontSize: rank < 3 ? '18px' : '14px',
                        color: rank < 3 ? RANK_COLORS[rank] : 'var(--gray-600)',
                      }}>
                        {medalOrNumber}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '32px', height: '32px', borderRadius: '50%',
                          background: rank < 3
                            ? `linear-gradient(135deg, ${RANK_COLORS[rank]}, ${RANK_COLORS[rank]}88)`
                            : 'linear-gradient(135deg, var(--primary), var(--primary-light))',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: 'white', fontWeight: 700, fontSize: '13px', flexShrink: 0,
                          border: rank < 3 ? `2px solid ${RANK_COLORS[rank]}` : 'none',
                        }}>
                          {leader.full_name?.[0] || leader.username[0]}
                        </div>
                        <div>
                          <p style={{ fontWeight: 600, fontSize: '14px' }}>{leader.full_name || leader.username}</p>
                          <p style={{ fontSize: '12px', color: 'var(--gray-500)' }}>@{leader.username}</p>
                        </div>
                        {leader.id === user?.id && <span className="badge badge-primary">You</span>}
                        {/* Tie indicator */}
                        {rank < 3 && sortedLeaders.filter((_, i) => ranks[i] === rank).length > 1 && (
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 99,
                            background: `${RANK_COLORS[rank]}20`, color: RANK_COLORS[rank],
                          }}>
                            TIE
                          </span>
                        )}
                      </div>
                    </td>
                    <td><span className="badge badge-primary">Lv {leader.level}</span></td>
                    <td><span style={{ fontWeight: 700, color: rank < 3 ? RANK_COLORS[rank] : 'var(--primary)' }}>{leader.xp} XP</span></td>
                    <td>{leader.streak > 0 ? `🔥 ${leader.streak}d` : '—'}</td>
                    {tab === 'quiz' && <>
                      <td>{qs?.quizzes_taken ?? 0}</td>
                      <td>
                        {qs?.avg_score != null
                          ? <span style={{
                              fontWeight: 700,
                              color: qs.avg_score >= 70 ? 'var(--success)' : qs.avg_score >= 50 ? '#F59E0B' : 'var(--danger)',
                            }}>{Math.round(qs.avg_score)}%</span>
                          : <span style={{ color: 'var(--gray-400)' }}>—</span>
                        }
                      </td>
                      <td>
                        {qs?.best_score != null
                          ? <span style={{ fontWeight: 600, color: '#10B981' }}>{Math.round(qs.best_score)}%</span>
                          : <span style={{ color: 'var(--gray-400)' }}>—</span>
                        }
                      </td>
                    </>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {sortedLeaders.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--gray-400)' }}>
            No data available yet
          </div>
        )}
      </div>
    </div>
  );
}