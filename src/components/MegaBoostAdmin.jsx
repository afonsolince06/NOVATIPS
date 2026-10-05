import { useState } from 'react';
import { supabase } from '../lib/supabase';

const empty = { enabled: true, active: false, title: '', description: '', section: 'general', yes_label: 'Sim', no_label: 'Não', yes_odds: '', no_odds: '', boosted_odds: '', boosted_no_odds: '', closes_at: '', badge: '', image_path: '' };
const localDate = value => { const d = new Date(value); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0,16); };
export default function MegaBoostAdmin({ bets, sections, onSaved }) {
 const [id, setId] = useState('');
 const [form, setForm] = useState(empty);
 const [file, setFile] = useState(null);
 const [busy, setBusy] = useState(false);
 const [error, setError] = useState('');
 const [notice, setNotice] = useState('');
 const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
 const choose = value => {
   setId(value); setFile(null); setError(''); setNotice('');
   const bet = bets.find(b => b.id === value);
   if (!bet) { setForm(empty); return; }
   const options = typeof bet.options === 'string' ? JSON.parse(bet.options) : bet.options;
   setForm({ ...empty, ...bet.mega_boost, title: bet.title, description: bet.description, section: bet.section || 'general', yes_label: options[0]?.label || 'Sim', no_label: options[1]?.label || '', yes_odds: bet.mega_boost?.base_yes_odds || options[0]?.odds || '', no_odds: bet.mega_boost?.base_no_odds || options[1]?.odds || '', boosted_no_odds: bet.mega_boost?.boosted_no_odds || '', boosted_odds: bet.mega_boost?.boosted_odds || '', closes_at: localDate(bet.closes_at) });
 };
 const save = async event => {
   event.preventDefault(); if (busy) return;
   setError(''); setNotice('');
   const other = bets.find(b => b.id !== id && b.mega_boost?.enabled && b.mega_boost?.active);
   if (form.enabled && form.active && other && !window.confirm('Já existe um Mega Boost ativo: “' + other.title + '”. Queres desativá-lo e substituí-lo por este?')) return;
   if (form.enabled && !file && !form.image_path) { setError('Escolhe uma imagem para o Mega Boost.'); return; }
   if (file && (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024)) { setError('Usa JPG, PNG ou WebP até 5 MB.'); return; }
   if (!form.yes_label.trim() || (form.no_label.trim() && form.yes_label.trim().toLowerCase() === form.no_label.trim().toLowerCase())) { setError('As opções precisam de nomes distintos.'); return; }
   setBusy(true); let uploaded;
   try {
     let imagePath = form.image_path;
     if (file) {
       const extension = { 'image/jpeg':'jpg','image/png':'png','image/webp':'webp' }[file.type];
       uploaded = 'mega-boost/' + crypto.randomUUID() + '.' + extension;
       const { error: uploadError } = await supabase.storage.from('prediction-images').upload(uploaded, file, { contentType: file.type });
       if (uploadError) { uploaded = null; throw uploadError; }
       imagePath = uploaded;
       set('image_path', imagePath);
       setFile(null);
     }
     const { error: saveError } = await supabase.rpc('save_mega_boost', { p_bet_id: id || null, p_payload: { ...form, no_odds: form.no_label.trim() ? form.no_odds : '', boosted_no_odds: form.no_label.trim() ? form.boosted_no_odds : '', image_path: imagePath, closes_at: new Date(form.closes_at).toISOString() }, p_replace_id: other?.id || null });
     if (saveError) throw saveError;
     uploaded = null;
     setFile(null); setId(''); setForm(empty); setNotice('Mega Boost guardado.');
     await onSaved();
   } catch (err) {
     // Retain uploaded media for retry: a network failure may happen after the save committed.
     setError(err.message || 'Não foi possível guardar o Mega Boost.');
   } finally { setBusy(false); }
 };
 const imageUrl = form.image_path ? supabase.storage.from('prediction-images').getPublicUrl(form.image_path).data.publicUrl : null;
 return <section className="mega-admin">
   <h2>🔥 Mega Boost</h2>
   <p>Um destaque temporário, sem criar uma categoria. Define o nome das opções. Deixa a opção 2 vazia para mostrar apenas uma opção. Cada opção pode ter a sua própria odd boosted. As odds ficam bloqueadas depois da primeira aposta.</p>
   <form onSubmit={save}>
     <label>Previsão<select value={id} onChange={e => choose(e.target.value)} disabled={busy}><option value="">Criar nova previsão</option>{bets.map(b => <option key={b.id} value={b.id}>{b.title}{b.mega_boost?.enabled ? ' · Mega Boost' : ''}</option>)}</select></label>
     <label className="mega-check"><input type="checkbox" checked={form.enabled} onChange={e => set('enabled',e.target.checked)} />🔥 Mega Boost</label>
     <label className="mega-check"><input type="checkbox" checked={form.active} disabled={!form.enabled} onChange={e => set('active',e.target.checked)} />Ativo / destacado</label>
     <label>Título<input required value={form.title} onChange={e => set('title',e.target.value)} /></label>
     <label>Descrição curta<input value={form.description} onChange={e => set('description',e.target.value)} /></label>
     <label>Evento interno<select value={form.section} onChange={e => set('section',e.target.value)}>{sections.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select></label>
     <label>Imagem / banner (JPG, PNG, WebP · máximo 5 MB)<input key={id + form.image_path} type="file" accept="image/jpeg,image/png,image/webp" onChange={e => setFile(e.target.files?.[0] || null)} /></label>
     {imageUrl && <img className="mega-admin-preview" src={imageUrl} alt="Banner atual" />}
     <div className="mega-admin-grid">
       <label>Nome da opção 1<input required value={form.yes_label} onChange={e => set('yes_label',e.target.value)} /></label>
       <label>Nome da opção 2 (opcional)<input value={form.no_label} onChange={e => set('no_label',e.target.value)} /></label>
       <label>Odd base — opção 1<input required type="number" min="1.01" step="0.01" value={form.yes_odds} onChange={e => set('yes_odds',e.target.value)} /></label>
       <label>Odd base — opção 2<input required={Boolean(form.no_label.trim())} disabled={!form.no_label.trim()} type="number" min="1.01" step="0.01" value={form.no_odds} onChange={e => set('no_odds',e.target.value)} /></label>
       <label>Odd boosted — opção 1 (opcional)<input type="number" min="1.01" step="0.01" value={form.boosted_odds} onChange={e => set('boosted_odds',e.target.value)} /></label>
       <label>Odd boosted — opção 2 (opcional)<input disabled={!form.no_label.trim()} type="number" min="1.01" step="0.01" value={form.boosted_no_odds} onChange={e => set('boosted_no_odds',e.target.value)} /></label>
       <label>Data/hora de fecho (hora local)<input required type="datetime-local" value={form.closes_at} onChange={e => set('closes_at',e.target.value)} /></label>
     </div>
     <label>Badge personalizado (opcional)<input maxLength={80} value={form.badge} onChange={e => set('badge',e.target.value)} /></label>
     {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
     <button disabled={busy} type="submit">{busy ? 'A guardar…' : 'Guardar previsão / Mega Boost'}</button>
   </form>
 </section>;
}
