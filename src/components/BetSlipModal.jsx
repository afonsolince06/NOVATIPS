import { useState } from 'react';

export default function BetSlipModal({ betSlip, balance, onConfirm, onClose, onRemove }) {
  const [amount, setAmount] = useState(100);
  
  // Calculate total odds
  const totalOdds = betSlip.reduce((acc, item) => acc * item.option.odds, 1);
  const potentialReturn = Math.floor(amount * totalOdds);
  
  const isValid = amount > 0 && amount <= balance && betSlip.length > 0;
  const isMultiple = betSlip.length > 1;

  const handleConfirm = () => {
    if (!isValid) return;
    onConfirm(amount, totalOdds, potentialReturn);
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
          background: '#f8fafc', borderTop: '1px solid #e5e7eb',
          borderRadius: '24px 24px 0 0', padding: '24px 24px 40px',
          width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto',
          animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          boxShadow: '0 -10px 40px rgba(0,0,0,0.1)',
          display: 'flex', flexDirection: 'column'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div style={{ width: 40, height: 5, background: '#e2e8f0', borderRadius: 3, margin: '0 auto 24px' }} />

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 20, margin: 0, color: '#1a1a1a' }}>
            Boletim de Apostas
          </h3>
          <span style={{ background: isMultiple ? '#84cc16' : '#84cc16', color: isMultiple ? '#fff' : '#1a1a1a', padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 800 }}>
            {isMultiple ? `Múltiplas (${betSlip.length})` : 'Simples'}
          </span>
        </div>

        {/* Selected options list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          {betSlip.map((item, idx) => (
            <div key={idx} style={{
              background: '#ffffff', border: '1px solid #e2e8f0',
              borderRadius: 12, padding: '16px', position: 'relative'
            }}>
              <button 
                onClick={() => onRemove(item.bet.id)}
                style={{ 
                  position: 'absolute', top: 12, right: 12, background: 'transparent', 
                  border: 'none', fontSize: 18, color: '#94a3b8', cursor: 'pointer' 
                }}
              >
                ×
              </button>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4, fontWeight: 600, paddingRight: 20 }}>
                {item.bet.title}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: '#1a1a1a' }}>{item.option.label}</div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 800, fontSize: 16, color: '#1a1a1a' }}>
                  {item.option.odds.toFixed(2)}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Balance */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
        }}>
          <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>Saldo disponível</span>
          <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, color: '#166534', fontSize: 14 }}>
            TIPS {balance.toLocaleString()}
          </span>
        </div>

        {/* Amount input & Total Odds */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontWeight: 700 }}>TIPS</span>
            <input
              type="number" min={1} max={balance} value={amount}
              onChange={e => setAmount(Math.max(0, parseInt(e.target.value) || 0))}
              style={{
                width: '100%', background: '#ffffff',
                border: `1px solid ${amount > balance ? '#fca5a5' : '#cbd5e1'}`,
                borderRadius: 12, padding: '14px 14px 14px 56px', color: '#1a1a1a',
                fontSize: 18, fontWeight: 700, outline: 'none', boxSizing: 'border-box',
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)',
                transition: 'border-color 0.2s'
              }}
            />
          </div>
          <div style={{ 
            background: '#fde047', borderRadius: 12, padding: '0 20px', 
            display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
            border: '1px solid #facc15'
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#a16207', textTransform: 'uppercase' }}>Odd Total</span>
            <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 900, fontSize: 20, color: '#1a1a1a' }}>
              {totalOdds.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Quick amounts */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {[50, 100, 250, 500].map(q => (
            <button
              key={q}
              onClick={() => setAmount(Math.min(q, balance))}
              style={{
                flex: 1, background: amount === q ? '#1e90ff' : '#ffffff',
                border: `1px solid ${amount === q ? '#1e90ff' : '#e2e8f0'}`,
                borderRadius: 8, padding: '8px 0', color: amount === q ? '#fff' : '#475569',
                fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s'
              }}
            >{q}</button>
          ))}
        </div>

        {/* Potential return */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24,
          padding: '8px 4px'
        }}>
          <span style={{ fontSize: 15, color: '#1a1a1a', fontWeight: 800 }}>Ganhos possíveis</span>
          <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 900, color: '#15803d', fontSize: 24 }}>
            TIPS {isValid ? potentialReturn.toLocaleString() : '—'}
          </span>
        </div>

        {amount > balance && (
          <div style={{ color: '#ef4444', fontSize: 13, fontWeight: 600, textAlign: 'center', marginBottom: 16 }}>
            ⚠️ Saldo insuficiente
          </div>
        )}

        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, background: '#ffffff', border: '1px solid #e2e8f0',
              color: '#64748b', borderRadius: 12, padding: '14px', fontSize: 15, fontWeight: 700, cursor: 'pointer'
            }}
          >Cancelar</button>
          <button
            onClick={handleConfirm} disabled={!isValid}
            style={{
              flex: 2,
              background: isValid ? '#84cc16' : '#e2e8f0',
              color: isValid ? '#fff' : '#94a3b8', border: 'none', borderRadius: 12, padding: '14px',
              fontSize: 15, fontWeight: 800, cursor: isValid ? 'pointer' : 'not-allowed',
              boxShadow: isValid ? '0 4px 6px -1px rgba(132, 204, 22, 0.3)' : 'none',
              transition: 'all 0.2s'
            }}
          >Apostar 🎯</button>
        </div>
      </div>
    </div>
  );
}
