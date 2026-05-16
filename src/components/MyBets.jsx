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
              {b.is_multiple && b.legs && (
                <details style={{ marginTop: 12 }}>
                  <summary style={{ cursor: 'pointer', fontSize: 13, color: '#475569', fontWeight: 700, outline: 'none' }}>
                    Ver apostas ({b.legs.length})
                  </summary>
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {b.legs.map((leg, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, background: '#f8fafc', padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                        <span style={{ color: '#334155' }}>{leg.bet_title}</span>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ fontWeight: 700, color: '#1e90ff' }}>{leg.option_label}</span>
                          <span style={{ background: leg.status === 'Won' ? '#dcfce7' : leg.status === 'Lost' ? '#fee2e2' : '#fef3c7', color: leg.status === 'Won' ? '#16a34a' : leg.status === 'Lost' ? '#dc2626' : '#d97706', padding: '2px 6px', borderRadius: 6, fontSize: 10, fontWeight: 800 }}>
                            {leg.status || 'Pending'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              )}
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
