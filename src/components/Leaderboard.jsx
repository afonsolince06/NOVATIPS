import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const rankColor = r => r === 1 ? '#eab308' : r === 2 ? '#94a3b8' : r === 3 ? '#d97706' : '#94a3b8';
const rankLabel = r => r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : `#${r}`;

export default function Leaderboard() {
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    supabase
      .from('profiles')
      .select('email, balance')
      .order('balance', { ascending: false })
      .limit(5)
      .then(({ data }) => {
        if (data) setEntries(data.map((u, i) => ({
          rank: i + 1,
          name: u.email?.split('@')[0] ?? 'anon',
          tips: u.balance,
          avatar: (u.email?.[0] ?? '?').toUpperCase(),
        })));
      });
  }, []);

  return (
    <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 16, padding: '24px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <span style={{ fontWeight: 800, fontSize: 15, fontFamily: "'Space Grotesk', sans-serif", color: '#1a1a1a' }}>🏆 Leaderboard</span>
        <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>By balance</span>
      </div>

      {entries.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>🚀</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 4 }}>No rankings yet</div>
          <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.6 }}>Be the first to place a bet<br />and claim the top spot!</div>
        </div>
      ) : entries.map(u => (
        <div key={u.rank} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: u.rank < entries.length ? '1px solid #f1f5f9' : 'none' }}>
          <span style={{ width: 22, fontSize: 14, textAlign: 'center', color: rankColor(u.rank), fontWeight: 700 }}>{rankLabel(u.rank)}</span>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: `hsl(${u.rank * 60}, 55%, 90%)`, color: `hsl(${u.rank * 60}, 55%, 30%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{u.avatar}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#166534', fontFamily: "'Inter', sans-serif" }}>{u.tips.toLocaleString()}</div>
        </div>
      ))}
    </div>
  );
}
