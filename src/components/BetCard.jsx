export default function BetCard({ bet, onOptionClick, selectedOptionLabel }) {
  const closesLabel = bet.closes_in_label || bet.closesIn || '';
  
  // Calculate automatic expiry based on hours in the label
  let isExpired = false;
  let remainingText = closesLabel;
  let isClosingSoon = false;

  if (bet.created_at) {
    const hoursMatch = closesLabel.match(/(\d+)/);
    if (hoursMatch) {
      const hours = parseInt(hoursMatch[1], 10);
      
      // If it's labeled in days (e.g. "7d"), convert to hours for calculation
      const multiplier = closesLabel.toLowerCase().includes('d') ? 24 : 1;
      const totalHours = hours * multiplier;
      
      const createdAtTime = new Date(bet.created_at).getTime();
      const expiresAt = createdAtTime + (totalHours * 60 * 60 * 1000);
      const now = Date.now();

      if (now > expiresAt) {
        isExpired = true;
      } else {
        const diffMs = expiresAt - now;
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        
        if (diffHours >= 24) {
          const diffDays = Math.floor(diffHours / 24);
          remainingText = `${diffDays}d ${diffHours % 24}h`;
        } else if (diffHours > 0) {
          remainingText = `${diffHours}h ${diffMinutes}m`;
          if (diffHours <= 3) isClosingSoon = true;
        } else {
          remainingText = `${diffMinutes}m`;
          isClosingSoon = true;
        }
      }
    }
  } else {
    // Fallback if no created_at
    isClosingSoon = !isExpired && closesLabel.includes('m') && !closesLabel.includes('d');
  }

  // Safe parse: handle both proper JSONB array and accidental string (legacy bug)
  let opts = [];
  try {
    opts = typeof bet.options === 'string' ? JSON.parse(bet.options) : (bet.options || []);
  } catch { opts = []; }

  return (
    <div style={{
      background: '#ffffff',
      border: bet.featured ? '1px solid #84cc16' : '1px solid #e5e7eb',
      borderRadius: 12, padding: '16px', position: 'relative', overflow: 'hidden',
      boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
      transition: 'box-shadow 0.2s',
      opacity: isExpired ? 0.75 : 1,
    }}
    onMouseEnter={e => !isExpired && (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)')}
    onMouseLeave={e => !isExpired && (e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.02)')}
    >
      {bet.featured && !isExpired && (
        <div style={{ position: 'absolute', top: 0, right: 0, background: '#84cc16', color: '#fff', fontSize: 10, fontWeight: 700, padding: '4px 12px', borderRadius: '0 12px 0 8px', letterSpacing: 0.5 }}>
          ★ FEATURED
        </div>
      )}

      {/* Meta Row Top */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {isExpired ? (
            <span style={{ fontSize: 10, fontWeight: 800, background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#64748b', borderRadius: 4, padding: '2px 6px' }}>
              🔒 FECHADO
            </span>
          ) : (
            <>
              {bet.trending && (
                <span style={{ fontSize: 10, fontWeight: 700, background: '#fef2f2', border: '1px solid #fecaca', color: '#ef4444', borderRadius: 4, padding: '2px 6px' }}>
                  📈 HOT
                </span>
              )}
              {isClosingSoon && (
                <span style={{ fontSize: 10, fontWeight: 700, background: '#fffbeb', border: '1px solid #fde68a', color: '#d97706', borderRadius: 4, padding: '2px 6px' }}>
                  ⏰ CLOSING {remainingText}
                </span>
              )}
              {!isClosingSoon && (
                 <span style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>
                   Faltam {remainingText}
                 </span>
              )}
            </>
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
        {opts.map((opt, i) => {
          const isNo = opt.label.toLowerCase().trim() === 'não' || opt.label.toLowerCase().trim() === 'nao';
          const isSelected = selectedOptionLabel === opt.label;
          
          return (
            <button
              key={i}
              disabled={isExpired}
              onClick={() => !isExpired && onOptionClick(bet, opt)}
              style={{
                flex: 1, minWidth: 80, 
                background: isExpired ? '#f8fafc' : (isSelected ? '#1e90ff' : '#ffffff'),
                border: isSelected ? '1px solid #1e90ff' : '1px solid #e2e8f0', 
                borderRadius: 8, padding: '12px 8px',
                cursor: isExpired ? 'not-allowed' : 'pointer', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              }}
              onMouseEnter={e => { 
                if (isExpired || isSelected) return;
                e.currentTarget.style.transform = 'scale(1.03)';
                e.currentTarget.style.borderColor = isNo ? '#ef4444' : '#84cc16';
                e.currentTarget.style.boxShadow = isNo ? '0 4px 6px -1px rgba(239, 68, 68, 0.1)' : '0 4px 6px -1px rgba(132, 204, 22, 0.1)';
              }}
              onMouseLeave={e => { 
                if (isExpired || isSelected) return;
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.borderColor = '#e2e8f0';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <span style={{ fontSize: 12, color: isExpired ? '#94a3b8' : (isSelected ? '#e0f2fe' : (isNo ? '#ef4444' : '#475569')), fontWeight: 600 }}>{opt.label}</span>
              <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 800, fontSize: 16, color: isExpired ? '#94a3b8' : (isSelected ? '#ffffff' : (isNo ? '#ef4444' : '#00c853')) }}>
                {opt.odds.toFixed(2)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
