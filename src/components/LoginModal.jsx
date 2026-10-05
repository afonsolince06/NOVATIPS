import { useState } from 'react';
import { useAuth } from '../context/useAuth';

export default function LoginModal({ onClose }) {
  const { signInWithPassword, signUp, resetPassword } = useAuth();
  const [mode, setMode] = useState('login');
  const switchMode = (next) => { setMode(next); setPassword(''); setError(''); setNotice(''); };
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setLoading(true);
    try {
      if (mode === 'reset') {
        await resetPassword(email);
        setNotice('Se existir uma conta com este email, receberás um link para redefinir a password.');
        return;
      }
      const result = await (mode === 'signup' ? signUp(email, password) : signInWithPassword(email, password));
      if (result?.accountExists) {
        switchMode('login');
        setNotice('Já tens conta com este email. Inicia sessão com a tua password habitual.');
        return;
      }
      if (result?.requiresEmailConfirmation) {
        switchMode('login');
        setNotice('Se já te registaste com este email, entra com a tua password habitual. Se é o teu primeiro registo, verifica o email de confirmação antes de entrar.');
        return;
      }
      onClose(); // modal is closed automatically if successful
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
            {mode === 'signup' ? 'Criar conta' : mode === 'reset' ? 'Recuperar password' : 'Entrar no NOVA TIPS'}
          </h2>
          <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>Usa o teu email @novaims.unl.pt</p>
        </div>

        <form onSubmit={handleLogin}>
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

          {mode !== 'reset' && <>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            Password
          </label>
          <input
            type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder={mode === 'signup' ? 'Escolhe uma password' : 'A tua password'} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required minLength={mode === 'signup' ? 8 : undefined}
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

          </>}

          {error && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fecaca',
              borderRadius: 10, padding: '12px 14px', marginBottom: 16,
              fontSize: 13, color: '#dc2626', fontWeight: 500
            }}>⚠️ {error}</div>
          )}
          {notice && (
            <div role="status" style={{
              background: '#eff6ff', border: '1px solid #bfdbfe',
              borderRadius: 10, padding: '12px 14px', marginBottom: 16,
              fontSize: 13, color: '#1d4ed8', fontWeight: 500
            }}>{notice}</div>
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
          >{loading ? 'A processar...' : mode === 'signup' ? 'Criar conta' : mode === 'reset' ? 'Enviar link de recuperação' : 'Entrar'}</button>
          <p style={{ textAlign: 'center', fontSize: 12, color: '#94a3b8', marginTop: 16, marginBottom: 0, fontWeight: 500 }}>
            <button type="button" disabled={loading} onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')} style={{ background: 'none', border: 0, color: '#2563eb', cursor: 'pointer' }}>{mode === 'login' ? 'Não tens conta? Criar conta' : 'Voltar a Entrar'}</button>
            {mode === 'login' && <button type="button" disabled={loading} onClick={() => switchMode('reset')} style={{ display: 'block', margin: '12px auto 0', background: 'none', border: 0, color: '#2563eb', cursor: 'pointer' }}>Esqueci-me da password</button>}
          </p>
        </form>
      </div>
    </div>
  );
}
