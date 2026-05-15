import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function LoginModal({ onClose }) {
  const { signIn, verifyCode } = useAuth();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1 = email, 2 = code
  const [error, setError] = useState('');

  const handleSendEmail = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email);
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await verifyCode(email, code);
      onClose(); // Close modal on success, user will be logged in
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#ffffff', border: '1px solid #e5e7eb',
          borderRadius: 24, padding: '36px 28px', width: '100%', maxWidth: 420,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: '#1e90ff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 900, fontSize: 24, color: '#fff', margin: '0 auto 14px',
          }}>N</div>
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 22, margin: '0 0 6px', letterSpacing: -0.5, color: '#1a1a1a' }}>
            Login to NOVA TIPS
          </h2>
          <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>Use your @novaims.unl.pt email</p>
        </div>

        {step === 2 ? (
          <form onSubmit={handleVerifyCode}>
            <div style={{
              background: '#f0f9ff', border: '1px solid #bae6fd',
              borderRadius: 14, padding: 16, textAlign: 'center', marginBottom: 20
            }}>
              <div style={{ color: '#0284c7', fontSize: 14, lineHeight: 1.5 }}>
                Enviámos um código para <strong style={{ color: '#0c4a6e' }}>{email}</strong>.
              </div>
            </div>
            
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
              Código de 6 Dígitos
            </label>
            <input
              type="text" value={code} onChange={e => setCode(e.target.value)}
              placeholder="Ex: 123456" required maxLength={6}
              style={{
                width: '100%', background: '#ffffff', textAlign: 'center', letterSpacing: 4,
                border: '1px solid #cbd5e1', borderRadius: 12,
                padding: '14px', color: '#1a1a1a', fontSize: 20, outline: 'none', fontWeight: 800,
                boxSizing: 'border-box', marginBottom: 16, transition: 'border-color 0.2s',
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)',
              }}
              onFocus={e => e.target.style.borderColor = '#1e90ff'}
              onBlur={e => e.target.style.borderColor = '#cbd5e1'}
            />
            
            {error && (
              <div style={{
                background: '#fef2f2', border: '1px solid #fecaca',
                borderRadius: 10, padding: '12px 14px', marginBottom: 16,
                fontSize: 13, color: '#dc2626', fontWeight: 500, textAlign: 'center'
              }}>⚠️ {error}</div>
            )}
            
            <button
              type="submit" disabled={loading || code.length < 6}
              style={{
                width: '100%',
                background: (loading || code.length < 6) ? '#e2e8f0' : '#10b981',
                color: (loading || code.length < 6) ? '#94a3b8' : '#ffffff', fontWeight: 700, fontSize: 15,
                border: 'none', borderRadius: 12, padding: '14px',
                cursor: (loading || code.length < 6) ? 'not-allowed' : 'pointer',
                boxShadow: (loading || code.length < 6) ? 'none' : '0 4px 6px -1px rgba(16, 185, 129, 0.2)',
                transition: 'all 0.2s'
              }}
            >{loading ? 'A verificar...' : 'Entrar na Plataforma 🚀'}</button>
            <button
              type="button" onClick={() => setStep(1)}
              style={{ width: '100%', background: 'none', border: 'none', color: '#64748b', fontSize: 13, marginTop: 12, cursor: 'pointer', fontWeight: 600 }}
            >
              Voltar atrás
            </button>
          </form>
        ) : (
          <form onSubmit={handleSendEmail}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
              Institutional Email
            </label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="yourname@novaims.unl.pt" required
              style={{
                width: '100%', background: '#ffffff',
                border: '1px solid #cbd5e1', borderRadius: 12,
                padding: '14px', color: '#1a1a1a', fontSize: 15, outline: 'none',
                boxSizing: 'border-box', marginBottom: 16, transition: 'border-color 0.2s',
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)',
              }}
              onFocus={e => e.target.style.borderColor = '#1e90ff'}
              onBlur={e => e.target.style.borderColor = '#cbd5e1'}
            />
            {error && (
              <div style={{
                background: '#fef2f2', border: '1px solid #fecaca',
                borderRadius: 10, padding: '12px 14px', marginBottom: 16,
                fontSize: 13, color: '#dc2626', fontWeight: 500
              }}>⚠️ {error}</div>
            )}
            <button
              type="submit" disabled={loading}
              style={{
                width: '100%',
                background: loading ? '#e2e8f0' : '#1e90ff',
                color: loading ? '#94a3b8' : '#ffffff', fontWeight: 700, fontSize: 15,
                border: 'none', borderRadius: 12, padding: '14px',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: loading ? 'none' : '0 4px 6px -1px rgba(30, 144, 255, 0.2)',
                transition: 'all 0.2s'
              }}
            >{loading ? 'Sending...' : 'Enviar Código Secreto 🔮'}</button>
            <p style={{ textAlign: 'center', fontSize: 12, color: '#94a3b8', marginTop: 16, marginBottom: 0, fontWeight: 500 }}>
              🔒 Secure. No password. No spam.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
