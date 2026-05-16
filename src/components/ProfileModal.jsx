import { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function ProfileModal({ user, balance, username, setUsername, onClose, onSignOut }) {
  const initial = (username || user?.email)?.[0]?.toUpperCase() ?? '?';
  const [promoCode, setPromoCode] = useState('');
  const [showPromoInput, setShowPromoInput] = useState(false);
  
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [tempUsername, setTempUsername] = useState(username || '');

  const handleSaveUsername = async () => {
    if (!tempUsername.trim()) return;
    const { error } = await supabase.from('profiles').update({ username: tempUsername.trim() }).eq('id', user.id);
    if (!error) {
      setUsername(tempUsername.trim());
      setIsEditingUsername(false);
    } else {
      alert('Erro ao guardar username: ' + error.message);
    }
  };

  const handleInvite = () => {
    navigator.clipboard.writeText('https://novatips.vercel.app/?ref=' + user.id);
    alert('Link de convite copiado! Ganhas 500 TIPS por cada amigo que se registar.');
  };

  const handlePromoCode = () => {
    if (promoCode.toUpperCase() === 'NOVATIPS1000') {
      alert('Código aplicado! +1000 TIPS (simulação)');
      setShowPromoInput(false);
      setPromoCode('');
    } else {
      alert('Código inválido ou expirado.');
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: '#f8fafc',
        display: 'flex', flexDirection: 'column',
        animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        overflowY: 'auto'
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px' }}>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: 24, cursor: 'pointer', color: '#1a1a1a' }}>
          ✕
        </button>
        <span style={{ fontSize: 16, fontWeight: 800, fontFamily: "'Space Grotesk', sans-serif" }}>O meu perfil</span>
        <div style={{ width: 24 }} /> {/* Spacer */}
      </div>

      {/* Avatar Section */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 10 }}>
        <div style={{
          width: 120, height: 120, borderRadius: '50%',
          background: 'linear-gradient(135deg, #84cc16 0%, #16a34a 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 48, fontWeight: 900, fontFamily: "'Space Grotesk', sans-serif",
          boxShadow: '0 10px 25px rgba(22, 163, 74, 0.3)',
          marginBottom: 16
        }}>
          {initial}
        </div>
        
        {isEditingUsername ? (
          <div style={{ display: 'flex', gap: 8, marginBottom: 30 }}>
            <input 
              type="text" value={tempUsername} onChange={e => setTempUsername(e.target.value)}
              placeholder="Novo username"
              style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #cbd5e1', outline: 'none', fontWeight: 600 }}
              autoFocus
            />
            <button onClick={handleSaveUsername} style={{ background: '#1e90ff', color: '#fff', border: 'none', borderRadius: 8, padding: '0 12px', cursor: 'pointer', fontWeight: 700 }}>Salvar</button>
            <button onClick={() => setIsEditingUsername(false)} style={{ background: '#e2e8f0', color: '#475569', border: 'none', borderRadius: 8, padding: '0 12px', cursor: 'pointer', fontWeight: 700 }}>X</button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 30 }}>
            <span style={{ fontSize: 18, color: '#1a1a1a', fontWeight: 800 }}>{username || user.email.split('@')[0]}</span>
            <button onClick={() => { setTempUsername(username || ''); setIsEditingUsername(true); }} style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✏️</button>
          </div>
        )}
      </div>

      {/* Balance Card */}
      <div style={{ padding: '0 20px', marginTop: '-10px' }}>
        <div style={{ 
          background: '#ffffff', borderRadius: 24, padding: 24,
          boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
          display: 'flex', flexDirection: 'column', alignItems: 'center'
        }}>
          <span style={{ fontSize: 14, color: '#64748b', fontWeight: 600, marginBottom: 8 }}>Saldo disponível</span>
          <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 900, fontSize: 42, color: '#1a1a1a', letterSpacing: -1 }}>
            {balance.toLocaleString()} <span style={{ fontSize: 20, color: '#84cc16' }}>TIPS</span>
          </span>
        </div>
      </div>

      {/* Actions List */}
      <div style={{ padding: '32px 20px' }}>
        <h4 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 16px 8px', color: '#1a1a1a' }}>Agora</h4>
        
        <div style={{ background: '#ffffff', borderRadius: 20, padding: '8px 0', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
          {/* Código Promocional */}
          <div 
            onClick={() => setShowPromoInput(!showPromoInput)}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 20 }}>🎟️</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#1e293b' }}>Código promocional</span>
            </div>
            <span style={{ color: '#cbd5e1' }}>›</span>
          </div>

          {/* Promo Input Area (Expandable) */}
          {showPromoInput && (
            <div style={{ padding: '16px 20px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: 8 }}>
              <input 
                type="text" 
                placeholder="Insere o código" 
                value={promoCode}
                onChange={e => setPromoCode(e.target.value)}
                style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1', outline: 'none', fontWeight: 600 }}
              />
              <button 
                onClick={handlePromoCode}
                style={{ background: '#1e90ff', color: '#fff', border: 'none', borderRadius: 8, padding: '0 16px', fontWeight: 700, cursor: 'pointer' }}
              >
                Aplicar
              </button>
            </div>
          )}

          {/* Convida um amigo */}
          <div 
            onClick={handleInvite}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 20 }}>🤝</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#1e293b' }}>Convida um amigo</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ background: '#84cc16', color: '#fff', padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 800 }}>+500 TIPS</div>
              <span style={{ color: '#cbd5e1' }}>›</span>
            </div>
          </div>

          {/* Instagram */}
          <a 
            href="https://www.instagram.com/novatips_?igsh=MXNoa3pwd2NpMWhteA=="
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', cursor: 'pointer', textDecoration: 'none', borderTop: '1px solid #f1f5f9' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 20 }}>📸</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#1e293b' }}>Segue-nos no Instagram</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#cbd5e1' }}>›</span>
            </div>
          </a>
        </div>

        {/* Logout */}
        <button 
          onClick={onSignOut}
          style={{ 
            width: '100%', marginTop: 32, background: '#fef2f2', border: '1px solid #fecaca', 
            color: '#ef4444', padding: 16, borderRadius: 16, fontSize: 16, fontWeight: 800, cursor: 'pointer' 
          }}
        >
          Terminar Sessão
        </button>
      </div>
    </div>
  );
}
