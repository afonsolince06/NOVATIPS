const statusStyle = s => {
  if (s === 'Won') return { color: '#16a34a', bg: '#dcfce7', border: '#bbf7d0' };
  if (s === 'Lost') return { color: '#dc2626', bg: '#fee2e2', border: '#fecaca' };
  return { color: '#d97706', bg: '#fef3c7', border: '#fde68a' }; // Pending
};

export default function MyBets({ myBets }) {
  if (myBets.length === 0) {
    return (
      <div style={{
        background: '#ffffff', border: '1px solid #e5e7eb',
        borderRadius: 16, padding: '48px 24px', textAlign: 'center',
        boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
      }}>
        <div style={{ fontSize: 40, marginBottom: 14 }}>🎯</div>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6, fontFamily: "'Space Grotesk', sans-serif", color: '#1a1a1a' }}>
          No bets yet
        </div>
        <div style={{ color: '#64748b', fontSize: 13 }}>Place your first prediction to see it here.</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {myBets.map(b => {
        const status = statusStyle(b.status);
        return (
          <div key={b.id} style={{
            background: '#ffffff', border: '1px solid #e5e7eb',
            borderRadius: 12, padding: '16px 20px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            flexWrap: 'wrap', gap: 16,
            boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
          }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4, color: '#1a1a1a' }}>{b.bet_title || b.title}</div>
              <div style={{ fontSize: 13, color: '#64748b' }}>
                <span style={{ color: '#1e90ff', fontWeight: 700 }}>{b.option_label || b.option}</span>
                {' · '}
                <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, color: '#00c853' }}>{Number(b.odds).toFixed(2)}</span>
                {' · '}
                <span style={{ color: '#94a3b8' }}>{new Date(b.placed_at || b.placedAt).toLocaleDateString()}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, fontWeight: 600 }}>Placed</div>
                <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "'Inter', sans-serif", color: '#334155' }}>{b.amount.toLocaleString()}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, fontWeight: 600 }}>Return</div>
                <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "'Inter', sans-serif", color: '#00c853' }}>
                  {(b.potential_return || b.potentialReturn || 0).toLocaleString()}
                </div>
              </div>
              <div style={{
                background: status.bg,
                border: `1px solid ${status.border}`,
                color: status.color,
                borderRadius: 20, padding: '4px 12px',
                fontSize: 11, fontWeight: 700,
              }}>{b.status}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
