export default function BetCard({ bet, onOptionClick }) {
  const closesLabel = bet.closes_in_label || bet.closesIn || '';
  const isClosingSoon = closesLabel.includes('m') && !closesLabel.includes('d');

  // Safe parse: handle both proper JSONB array and accidental string (legacy bug)
  let opts = [];
  try {
    opts = typeof bet.options === 'string' ? JSON.parse(bet.options) : (bet.options || []);
  } catch { opts = []; }

  return (
    <div style={{
      background: '#ffffff',
      border: bet.featured ? '1px solid #1e90ff' : '1px solid #e5e7eb',
      borderRadius: 12, padding: '16px', position: 'relative', overflow: 'hidden',
      boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
      transition: 'box-shadow 0.2s',
    }}
    onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)'}
    onMouseLeave={e => e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.02)'}
    >
      {bet.featured && (
        <div style={{ position: 'absolute', top: 0, right: 0, background: '#1e90ff', color: '#fff', fontSize: 10, fontWeight: 700, padding: '4px 12px', borderRadius: '0 12px 0 8px', letterSpacing: 0.5 }}>
          ★ FEATURED
        </div>
      )}

      {/* Meta Row Top */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {bet.trending && (
            <span style={{ fontSize: 10, fontWeight: 700, background: '#fef2f2', border: '1px solid #fecaca', color: '#ef4444', borderRadius: 4, padding: '2px 6px' }}>
              📈 HOT
            </span>
          )}
          {isClosingSoon && (
            <span style={{ fontSize: 10, fontWeight: 700, background: '#fffbeb', border: '1px solid #fde68a', color: '#d97706', borderRadius: 4, padding: '2px 6px' }}>
              ⏰ CLOSING {closesLabel}
            </span>
          )}
          {!isClosingSoon && (
             <span style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>
               Closes {closesLabel}
             </span>
          )}
        </div>
      </div>

      <div style={{ marginBottom: 16, textAlign: 'center' }}>
        <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16, margin: '0 0 4px', color: '#1a1a1a' }}>
          {bet.title}
        </h3>
        <p style={{ color: '#64748b', fontSize: 13, margin: 0, lineHeight: 1.4 }}>{bet.description}</p>
      </div>

      {/* Odds buttons */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {opts.map((opt, i) => (
          <button
            key={i}
            onClick={() => onOptionClick(bet, opt)}
            style={{
              flex: 1, minWidth: 80, background: '#ffffff',
              border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 8px',
              cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            }}
            onMouseEnter={e => { 
              e.currentTarget.style.transform = 'scale(1.03)';
              e.currentTarget.style.borderColor = '#1e90ff';
              e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(30, 144, 255, 0.1)';
            }}
            onMouseLeave={e => { 
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.borderColor = '#e2e8f0';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <span style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>{opt.label}</span>
            <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 800, fontSize: 16, color: '#00c853' }}>
              {opt.odds.toFixed(2)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
