import { useCallback,useEffect,useState } from 'react';
import MissionsAdmin from './MissionsAdmin';
import PredictionEditor from './PredictionEditor';
import '../admin-editor.css';
import {supabase} from '../lib/supabase';
import {isPredictionPublic} from '../lib/scheduling';
import AdminTips from './AdminTips';
import HousesAdmin from './HousesAdmin';
import PredictionManagement from './PredictionManagement';

export default function AdminPanel({ openBets = [], onAddBet, onResolveBet, onDeleteBet, onResetPassword, onMegaBoostSaved, onMissionReward, enableSections = false, sections = [] }) {

  const [panel, setPanel] = useState('create');
  const [capabilities,setCapabilities]=useState(null);
  useEffect(()=>{if(!enableSections)return;let active=true;supabase.rpc('fds_admin_capabilities').then(({data,error})=>{if(active)setCapabilities(error?{}:data);});return()=>{active=false;};},[enableSections]);
  const [managedBets,setManagedBets]=useState([]);const [editId,setEditId]=useState('');const [managementError,setManagementError]=useState('');
  const refreshManaged=useCallback(async()=>{if(!enableSections)return;const rows=[];for(let page=0;;page++){const {data,error}=await supabase.from('bets').select('*').order('created_at',{ascending:false}).order('id').range(page*1000,page*1000+999);if(error)throw error;rows.push(...data);if(data.length<1000)break;}setManagedBets(rows);setManagementError('');},[enableSections]);
  useEffect(()=>{if(!enableSections)return;let active=true;async function load(){try{const rows=[];for(let page=0;;page++){const {data,error}=await supabase.from('bets').select('*').order('created_at',{ascending:false}).order('id').range(page*1000,page*1000+999);if(error)throw error;rows.push(...data);if(data.length<1000)break;}if(active){setManagedBets(rows);setManagementError('');}}catch(error){if(active)setManagementError(error.message);}}load();const timer=setInterval(load,15000);return()=>{active=false;clearInterval(timer);};},[enableSections]);
  const editorBets=enableSections?managedBets.filter(b=>b.status==='open'):openBets;
  const resolutionBets=enableSections?editorBets.filter(b=>isPredictionPublic(b)):openBets;
  const saved=async()=>{await onMegaBoostSaved?.();await refreshManaged();};
  const resolved=async(...args)=>{await onResolveBet(...args);await refreshManaged();};
  const deleted=async id=>{await onDeleteBet(id);await refreshManaged();};

  // ── Resolve Bet section ──────────────────────────────────────────────────
  const [resolvingId, setResolvingId] = useState(null);
  const [winningOption, setWinningOption] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [sessionsRevoked, setSessionsRevoked] = useState(null);

  const confirmResolve = () => {
    if (!resolvingId || !winningOption) return;
    resolved(resolvingId, winningOption);
    setResolvingId(null);
    setWinningOption('');
  };

  const handlePasswordReset = async (event) => {
    event.preventDefault();
    setResetError('');
    setTemporaryPassword('');
    setSessionsRevoked(null);
    const email = resetEmail.trim().toLowerCase();
    if (!email.endsWith('@novaims.unl.pt')) {
      setResetError('Introduz o email institucional da pessoa.');
      return;
    }
    if (!window.confirm(`Vais substituir a password da conta ${email}. Confirma que verificaste a identidade da pessoa.`)) return;

    setResetLoading(true);
    try {
      const result = await onResetPassword(email);
      setTemporaryPassword(result.temporaryPassword);
      setSessionsRevoked(result.sessionsRevoked);
    } catch (error) {
      setResetError(error.message || 'Não foi possível redefinir a password.');
    } finally {
      setResetLoading(false);
    }
  };

  const inp = {
    width: '100%', background: '#ffffff',
    border: '1px solid #cbd5e1', borderRadius: 10,
    padding: '12px 14px', color: '#1a1a1a', fontSize: 14, outline: 'none', boxSizing: 'border-box',
    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)',
    transition: 'border-color 0.2s',
  };

  return (
    <div className="admin-control-center">
<nav className="admin-editor-nav" aria-label="Admin"><strong>ADMIN FDS</strong>{[['create','+ Criar previsão'],...(enableSections?[['manage','▣ Previsões']]:[]),['resolve','✓ Resolver previsões'],...(enableSections ? [['missions','🔥 Missões'],['tips','💰 Gestão de TIPS'],['houses','🏠 Casas']] : []),...(onResetPassword?[['access','♙ Acessos']]:[])].map(([id,label])=><button key={id} className={panel===id?'active':''} onClick={()=>{if(id==='create')setEditId('');setPanel(id);}}>{label}</button>)}</nav><div className="admin-workspace">

      {panel === 'create' && <PredictionEditor key={editId||'new'} schedulingEnabled={Boolean(capabilities?.scheduled_predictions)} initialBet={managedBets.find(b=>b.id===editId)} bets={editorBets} sections={sections} fdsMode={enableSections} onAddBet={onAddBet} onSaved={saved} />}

      {managementError&&<p className="editor-error" role="alert">{managementError}</p>}
      {enableSections&&capabilities&&!capabilities.scheduled_predictions&&['create','manage'].includes(panel)&&<p className="editor-notice">Para ativar publicação agendada e rascunhos no servidor, executa a migração 20261005001000_scheduled_predictions.sql no Supabase FDS e atualiza esta página.</p>}
      {panel === 'manage' && <PredictionManagement schedulingEnabled={Boolean(capabilities?.scheduled_predictions)} bets={managedBets} onEdit={bet=>{setEditId(bet.id);setPanel('create');}} onChanged={saved} onResolve={()=>setPanel('resolve')}/>}
      {panel === 'tips' && (capabilities?.admin_tips_grants?<AdminTips onBalanceRefresh={onMissionReward}/>:<section className="editor-panel"><h1>💰 Gestão de TIPS</h1><p>{capabilities===null?'A verificar configuração…':'Executa as migrações 010 e 011 no Supabase FDS e atualiza esta página para ativar atribuições manuais de TIPS.'}</p></section>)}
      {panel === 'houses' && (capabilities?.houses?<HousesAdmin/>:<section className="editor-panel"><h1>🏠 Casas FDS</h1><p>Executa a migração 012 no Supabase FDS e atualiza a página para ativar casas e onboarding.</p></section>)}
      {panel === 'missions' && <MissionsAdmin onBalanceRefresh={onMissionReward} />}

      {/* ── RESOLVE BETS ── */}
      {panel === 'resolve' && (
      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 16, padding: 24, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
        <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 18, margin: '0 0 6px', color: '#14532d' }}>✅ Resolve Bets</h2>
        <p style={{ color: '#166534', fontSize: 13, margin: '0 0 20px' }}>Select the winning outcome — winners get TIPS credited automatically.</p>

        {resolutionBets.filter(b => typeof b.id !== 'number').length === 0 ? (
          <div style={{ color: '#166534', fontSize: 14, textAlign: 'center', padding: '16px 0', fontWeight: 600 }}>No open bets to resolve.</div>
        ) : resolutionBets.filter(b => typeof b.id !== 'number').map(bet => {
          // Safe parse: handle string-encoded options from legacy bug
          let opts;
          try { opts = typeof bet.options === 'string' ? JSON.parse(bet.options) : (bet.options || []); } catch { opts = []; }

          const isResolving = resolvingId === bet.id;
          return (
            <div key={bet.id} style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px', marginBottom: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#1a1a1a' }}>{bet.title}</div>
                <button onClick={() => deleted(bet.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>Apagar 🗑️</button>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: isResolving ? 16 : 0 }}>
                {bet.mega_boost && opts.length === 1 && <button type="button" onClick={() => { setResolvingId(bet.id); setWinningOption('__mega_not_happened'); }} style={{ padding: 10, borderRadius: 8, border: '1px solid #fecaca', color: '#b91c1c', cursor: 'pointer' }}>Não aconteceu — apostas perdidas</button>}
                {opts.map((opt, i) => (
                  <button key={i} onClick={() => { setResolvingId(bet.id); setWinningOption(opt.label); }}
                    style={{
                      flex: 1, minWidth: 100,
                      background: (isResolving && winningOption === opt.label) ? '#dcfce7' : '#f8fafc',
                      border: (isResolving && winningOption === opt.label) ? '1px solid #4ade80' : '1px solid #e2e8f0',
                      color: (isResolving && winningOption === opt.label) ? '#166534' : '#475569',
                      borderRadius: 8, padding: '10px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                      transition: 'all 0.15s'
                    }}>
                    {opt.label} <span style={{ color: (isResolving && winningOption === opt.label) ? '#15803d' : '#1e90ff', fontFamily: "'Inter', sans-serif", fontWeight: 700 }}>{Number(opt.odds).toFixed(2)}</span>
                  </button>
                ))}
              </div>
              {isResolving && winningOption && (
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={confirmResolve} style={{ flex: 1, background: '#10b981', color: '#fff', fontWeight: 800, fontSize: 14, border: 'none', borderRadius: 8, padding: '12px', cursor: 'pointer', boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)' }}>
                    {winningOption === '__mega_not_happened' ? 'Confirmar: não aconteceu — apostas perdidas' : `Confirmar: ${winningOption} vence 🏆`}
                  </button>
                  <button onClick={() => { setResolvingId(null); setWinningOption(''); }} style={{ background: '#ffffff', border: '1px solid #cbd5e1', color: '#64748b', borderRadius: 8, padding: '12px 20px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                    Cancel
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      )}

      {panel === 'access' && onResetPassword && (
        <section style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 12, padding: 24 }}>
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 18, margin: '0 0 6px', color: '#9a3412' }}>
            Redefinir password de um participante
          </h2>
          <p style={{ color: '#7c2d12', fontSize: 13, lineHeight: 1.5, margin: '0 0 16px' }}>
            Confirma a identidade da pessoa antes de continuar. A password temporária só será mostrada uma vez; envia-a em privado e pede-lhe para a mudar no perfil.
          </p>
          <form onSubmit={handlePasswordReset} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input
              type="email"
              value={resetEmail}
              onChange={event => { setResetEmail(event.target.value); setTemporaryPassword(''); setSessionsRevoked(null); setResetError(''); }}
              placeholder="participante@novaims.unl.pt"
              aria-label="Email institucional do participante"
              required
              style={{ ...inp, flex: '1 1 260px' }}
            />
            <button
              type="submit"
              disabled={resetLoading || !resetEmail.trim()}
              style={{ background: resetLoading ? '#fed7aa' : '#c2410c', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 16px', fontSize: 14, fontWeight: 800, cursor: resetLoading ? 'wait' : 'pointer' }}
            >{resetLoading ? 'A redefinir...' : 'Redefinir acesso'}</button>
          </form>
          {resetError && <p role="alert" style={{ color: '#b91c1c', fontSize: 13, fontWeight: 600, margin: '12px 0 0' }}>{resetError}</p>}
          {temporaryPassword && (
            <div role="status" style={{ marginTop: 16, padding: 14, background: '#fff', border: '1px solid #fdba74', borderRadius: 8 }}>
              <div style={{ color: '#7c2d12', fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Password temporária. Copia-a agora e envia-a em privado.</div>
              <p style={{ color: sessionsRevoked ? '#166534' : '#b91c1c', fontSize: 12, margin: '0 0 10px' }}>
                {sessionsRevoked
                  ? 'As sessões anteriores foram revogadas. Tokens de acesso já emitidos podem continuar válidos até expirarem.'
                  : 'A password foi alterada, mas não foi possível revogar as sessões anteriores. Termina-as manualmente no Supabase Auth.'}
              </p>
              <code style={{ display: 'block', overflowWrap: 'anywhere', padding: 10, background: '#f8fafc', borderRadius: 6, color: '#1f2937', userSelect: 'all' }}>{temporaryPassword}</code>
              <button
                type="button"
                onClick={async () => {
                  try { await navigator.clipboard.writeText(temporaryPassword); }
                  catch { setResetError('Não foi possível copiar; seleciona e copia a password manualmente.'); }
                }}
                style={{ marginTop: 10, background: '#fff', border: '1px solid #fdba74', borderRadius: 6, padding: '8px 12px', color: '#9a3412', fontWeight: 700, cursor: 'pointer' }}
              >Copiar password</button>
              <button
                type="button"
                onClick={() => setTemporaryPassword('')}
                style={{ marginTop: 10, marginLeft: 8, background: 'transparent', border: 'none', padding: '8px 12px', color: '#64748b', fontWeight: 700, cursor: 'pointer' }}
              >Ocultar</button>
            </div>
          )}
        </section>
      )}
    </div></div>
  );
}
