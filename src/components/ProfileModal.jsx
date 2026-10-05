import { useEffect, useState } from 'react';
import '../profile.css';
import { normalizeInstagram } from '../lib/missions';
import { isFreshersWeekendEdition, supabase } from '../lib/supabase';

export default function ProfileModal({ user, balance, username, setUsername, onClose, onSignOut, forcePasswordChange = false, passwordRecovery = false, onPasswordChanged,houseNumber,onGuide }) {
  const [navHeight, setNavHeight] = useState(72);
  useEffect(() => {
    const nav = document.querySelector('nav');
    if (!nav) return;
    const measure = () => setNavHeight(nav.getBoundingClientRect().height);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(nav);
    return () => observer.disconnect();
  }, []);
  const [instagram, setInstagram] = useState('');
  const [instagramNotice, setInstagramNotice] = useState('');
  const [instagramBusy, setInstagramBusy] = useState(false);
  useEffect(() => { let active = true; if (isFreshersWeekendEdition) supabase.rpc('my_instagram').then(({data,error}) => { if(active && !error) setInstagram(data || ''); }); return () => {active=false;}; }, [user?.id]);
  const saveInstagram = async event => {
    event.preventDefault(); if (instagramBusy) return;
    setInstagramBusy(true); setInstagramNotice('');
    try {
      const canonical = normalizeInstagram(instagram);
      const {error} = await supabase.rpc('update_my_instagram', {p_username:canonical});
      if (error) throw error;
      setInstagram(canonical); setInstagramNotice('Instagram guardado.');
    } catch (error) { setInstagramNotice(error.message); }
    finally { setInstagramBusy(false); }
  };
  const initial = (username || user?.email)?.[0]?.toUpperCase() ?? '?';
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [tempUsername, setTempUsername] = useState(username || '');

  const handleSaveUsername = async () => {
    if (!tempUsername.trim()) return;
    const { error } = await supabase.rpc('update_my_username', { new_username: tempUsername.trim() });
    if (!error) {
      setUsername(tempUsername.trim());
      setIsEditingUsername(false);
    } else {
      alert('Erro ao guardar username: ' + error.message);
    }
  };

  const handlePasswordChange = async () => {
    if (newPassword.length < 8) {
      alert('A password deve ter pelo menos 8 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      alert('As passwords não coincidem.');
      return;
    }
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
      data: { ...user.user_metadata, force_password_change: false },
    });
    if (error) {
      alert('Erro ao mudar password: ' + error.message);
    } else {
      alert('Password atualizada com sucesso! 🔐');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordInput(false);
      onPasswordChanged?.();
    }
  };

  if (forcePasswordChange) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: '#f8fafc', display: 'grid', placeItems: 'center', padding: 20 }}>
        <section style={{ width: '100%', maxWidth: 440, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 28 }}>
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, color: '#1a1a1a', margin: '0 0 10px' }}>Cria a tua nova password</h2>
          <p style={{ color: '#64748b', fontSize: 14, lineHeight: 1.5, margin: '0 0 20px' }}>
            {passwordRecovery ? 'Escolhe uma nova password para recuperares o acesso à tua conta.' : 'A password temporária já não pode ser usada depois deste passo. Escolhe uma password nova para continuares.'}
          </p>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>Nova password</label>
          <input
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={newPassword}
            onChange={event => setNewPassword(event.target.value)}
            style={{ width: '100%', boxSizing: 'border-box', padding: 12, border: '1px solid #cbd5e1', borderRadius: 8, marginBottom: 14 }}
          />
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>Confirmar password</label>
          <input
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={confirmPassword}
            onChange={event => setConfirmPassword(event.target.value)}
            style={{ width: '100%', boxSizing: 'border-box', padding: 12, border: '1px solid #cbd5e1', borderRadius: 8, marginBottom: 18 }}
          />
          <button
            type="button"
            onClick={handlePasswordChange}
            style={{ width: '100%', padding: 13, background: '#15803d', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 800, cursor: 'pointer' }}
          >Guardar nova password</button>
        </section>
      </div>
    );
  }

  return (
    <div className="fds-profile-page" style={{ '--profile-nav-height': navHeight + 'px' }} role="dialog" aria-modal="false" aria-label="O meu perfil">
      <div className="profile-container">
        <section className="profile-hero">
          <button className="profile-back" onClick={onClose}>← Voltar</button>
          <div className="profile-avatar">{initial}</div>
          {isEditingUsername ? <form className="profile-name-form" onSubmit={e=>{e.preventDefault();handleSaveUsername();}}>
            <label className="profile-sr-only" htmlFor="profile-username">Nome de utilizador</label>
            <input id="profile-username" value={tempUsername} onChange={e=>setTempUsername(e.target.value)} placeholder="Novo username" autoFocus />
            <button className="profile-primary" type="submit">Guardar</button>
            <button type="button" onClick={()=>setIsEditingUsername(false)}>Cancelar</button>
          </form> : <div className="profile-name"><h1>{username || user.email.split('@')[0]}</h1><button aria-label="Editar nome de utilizador" onClick={()=>{setTempUsername(username||'');setIsEditingUsername(true);}}>✎</button></div>}
        </section>
        {isFreshersWeekendEdition&&<section className="profile-house"><span>🏠 A TUA CASA</span><strong>{houseNumber?'Casa '+houseNumber:'Ainda não atribuída.'}</strong><small>Atribuição oficial · pede à organização se precisares de uma correção.</small></section>}
        <section className="profile-balance" aria-label="Saldo disponível"><span className="profile-coins" aria-hidden="true">▱<br/>▱<br/>▱</span><div><p>Saldo disponível</p><strong>{Number(balance).toLocaleString('pt-PT')} <span>TIPS</span></strong></div></section>
        <section className="profile-account"><h2>Conta</h2><div className="profile-settings">
          {isFreshersWeekendEdition&&<button className="profile-action" aria-label="Como funciona" onClick={onGuide}><span className="profile-action-icon">?</span><span><strong>Como funciona</strong><small>Previsões, missões, TIPS e a tua Casa.</small></span><span className="profile-chevron">›</span></button>}
          <button className="profile-action" aria-expanded={showPasswordInput} aria-controls="profile-password-fields" onClick={()=>setShowPasswordInput(!showPasswordInput)}><span className="profile-action-icon" aria-hidden="true">⚿</span><span><strong>Mudar Password</strong><small>Atualiza a tua palavra-passe de acesso.</small></span><span className="profile-chevron" aria-hidden="true">›</span></button>
          {showPasswordInput && <form id="profile-password-fields" className="profile-password-form" onSubmit={e=>{e.preventDefault();handlePasswordChange();}}>
            <label>Nova password<input required type="password" autoComplete="new-password" minLength={8} value={newPassword} onChange={e=>setNewPassword(e.target.value)} /></label>
            <label>Confirmar nova password<input required type="password" autoComplete="new-password" minLength={8} value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} /></label>
            <button type="submit" className="profile-primary">Guardar nova password</button>
          </form>}
          <a className="profile-action" href="https://www.instagram.com/novatips_?igsh=MXNoa3pwd2NpMWhteA==" target="_blank" rel="noopener noreferrer"><span className="profile-action-icon" aria-hidden="true">◎</span><span><strong>Segue-nos no Instagram</strong><small>Fica a par de todas as novidades do FDS.</small></span><span className="profile-chevron" aria-hidden="true">›</span></a>
        </div></section>
        {isFreshersWeekendEdition && <section className="profile-instagram"><h2>Instagram <small>(opcional)</small></h2><p>Ajuda-nos a identificar as tuas participações nas Missões FDS.</p><form onSubmit={saveInstagram}><label htmlFor="instagram-handle">Nome no Instagram</label><input id="instagram-handle" value={instagram} onChange={e=>setInstagram(e.target.value)} placeholder="@username" /><button disabled={instagramBusy} className="profile-primary">{instagramBusy ? 'A guardar…' : 'Guardar'}</button></form>{instagramNotice && <p role="status">{instagramNotice}</p>}</section>}
        <button className="profile-signout" onClick={onSignOut}>⇥ &nbsp; Terminar Sessão</button>
      </div>
    </div>
  );
}
