import { useState } from 'react';

export default function BetModal({ bet, option, balance, onConfirm, onClose }) {
  const [amount, setAmount] = useState(100);
  const potentialReturn = Math.floor(amount * option.odds);
  const isValid = amount > 0 && amount <= balance;

  const handleConfirm = () => {
    if (!isValid) return;
    onConfirm(amount);
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 400,
        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#ffffff', borderTop: '1px solid #e5e7eb',
          borderRadius: '24px 24px 0 0', padding: '24px 24px 40px',
          width: '100%', maxWidth: 500,
          animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          boxShadow: '0 -10px 40px rgba(0,0,0,0.1)'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div style={{ width: 40, height: 5, background: '#e2e8f0', borderRadius: 3, margin: '0 auto 24px' }} />

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
            Placing bet on
          </div>
          <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 18, margin: '0 0 4px', color: '#1a1a1a' }}>
            {bet.title}
          </h3>
        </div>

        {/* Selected option */}
        <div style={{
          background: '#f0f9ff', border: '1px solid #bae6fd',
          borderRadius: 12, padding: '16px', marginBottom: 24,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: 12, color: '#0369a1', marginBottom: 2, fontWeight: 600 }}>Selected outcome</div>
            <div style={{ fontWeight: 800, fontSize: 16, color: '#0c4a6e' }}>{option.label}</div>
          </div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 800, fontSize: 24, color: '#00c853' }}>
            {option.odds.toFixed(2)}
          </div>
        </div>

        {/* Balance */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
        }}>
          <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>Your balance</span>
          <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, color: '#166534', fontSize: 14 }}>
            TIPS {balance.toLocaleString()}
          </span>
        </div>

        {/* Amount input */}
        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
          Amount (TIPS)
        </label>
        <input
          type="number" min={1} max={balance} value={amount}
          onChange={e => setAmount(Math.max(0, parseInt(e.target.value) || 0))}
          style={{
            width: '100%', background: '#ffffff',
            border: `1px solid ${amount > balance ? '#fca5a5' : '#cbd5e1'}`,
            borderRadius: 12, padding: '14px', color: '#1a1a1a',
            fontSize: 18, fontWeight: 700, outline: 'none', boxSizing: 'border-box',
            marginBottom: 12,
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)',
            transition: 'border-color 0.2s'
          }}
          onFocus={e => e.target.style.borderColor = '#1e90ff'}
          onBlur={e => e.target.style.borderColor = amount > balance ? '#fca5a5' : '#cbd5e1'}
        />

        {/* Quick amounts */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {[50, 100, 250, 500].map(q => (
            <button
              key={q}
              onClick={() => setAmount(Math.min(q, balance))}
              style={{
                flex: 1, background: amount === q ? '#1e90ff' : '#f8fafc',
                border: `1px solid ${amount === q ? '#1e90ff' : '#e2e8f0'}`,
                borderRadius: 8, padding: '8px 0', color: amount === q ? '#fff' : '#475569',
                fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s'
              }}
            >{q}</button>
          ))}
        </div>

        {/* Potential return */}
        <div style={{
          background: '#f0fdf4', border: '1px solid #bbf7d0',
          borderRadius: 12, padding: '14px 16px', marginBottom: 24,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: 13, color: '#166534', fontWeight: 600 }}>Potential return</span>
          <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 800, color: '#15803d', fontSize: 18 }}>
            TIPS {isValid ? potentialReturn.toLocaleString() : '—'}
          </span>
        </div>

        {amount > balance && (
          <div style={{ color: '#ef4444', fontSize: 13, fontWeight: 600, textAlign: 'center', marginBottom: 16 }}>
            ⚠️ Insufficient balance
          </div>
        )}

        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, background: '#ffffff', border: '1px solid #e2e8f0',
              color: '#64748b', borderRadius: 12, padding: '14px', fontSize: 15, fontWeight: 700, cursor: 'pointer',
              transition: 'background 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
            onMouseLeave={e => e.currentTarget.style.background = '#ffffff'}
          >Cancel</button>
          <button
            onClick={handleConfirm} disabled={!isValid}
            style={{
              flex: 2,
              background: isValid ? '#1e90ff' : '#e2e8f0',
              color: isValid ? '#fff' : '#94a3b8', border: 'none', borderRadius: 12, padding: '14px',
              fontSize: 15, fontWeight: 800, cursor: isValid ? 'pointer' : 'not-allowed',
              boxShadow: isValid ? '0 4px 6px -1px rgba(30, 144, 255, 0.2)' : 'none',
              transition: 'all 0.2s'
            }}
          >Place Bet 🎯</button>
        </div>
      </div>
    </div>
  );
}
