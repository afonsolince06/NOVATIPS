import {useCallback,useEffect,useRef,useState} from 'react';
import {supabase} from '../lib/supabase';
import AdminUserSearch from './AdminUserSearch';
import '../admin-tips.css';
const format=value=>Number(value||0).toLocaleString('pt-PT');
export default function AdminTips({onBalanceRefresh}) {
 const [scope,setScope]=useState('user');const [selected,setSelected]=useState(null);const [amount,setAmount]=useState('');const [reason,setReason]=useState('');const [count,setCount]=useState(0);const [history,setHistory]=useState([]);const [preview,setPreview]=useState(null);const [confirmation,setConfirmation]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [notice,setNotice]=useState('');
 const requestId=useRef(null);const operation=useRef(false);const confirmButton=useRef(null);const confirmInput=useRef(null);
 const reload=useCallback(async()=>{const [h,c]=await Promise.all([supabase.rpc('admin_tips_history'),supabase.rpc('admin_tips_eligible_count')]);if(h.error||c.error)throw h.error||c.error;setHistory(h.data);setCount(Number(c.data));},[]);
 useEffect(()=>{let active=true;Promise.all([supabase.rpc('admin_tips_history'),supabase.rpc('admin_tips_eligible_count')]).then(([h,c])=>{if(!active)return;if(h.error||c.error){setError((h.error||c.error).message);return;}setHistory(h.data);setCount(Number(c.data));});return()=>{active=false;};},[]);
 useEffect(()=>{if(!preview)return;(preview.scope==='all'?confirmInput:confirmButton).current?.focus();const close=event=>{if(event.key==='Escape'&&!operation.current){setPreview(null);setConfirmation('');}};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close);},[preview]);
 function resetRequest(){requestId.current=null;setNotice('');setError('');}
 async function prepare(event){
  event.preventDefault();if(operation.current)return;
  if(scope==='user'&&!selected){setError('Seleciona um utilizador.');return;}
  operation.current=true;setBusy(true);setError('');
  try{
   requestId.current??=crypto.randomUUID();
   const {data,error}=await supabase.rpc('prepare_admin_tips_grant',{p_request_id:requestId.current,p_user_id:scope==='user'?selected.id:null,p_amount:Number(amount),p_reason:reason.trim()});
   if(error)throw error;
   if(data.status==='completed'){setNotice('Esta atribuição já foi concluída.');await reload();return;}
   setPreview(data);setConfirmation('');
  }catch(error){setError(error.message);}finally{operation.current=false;setBusy(false);}
 }
 async function confirm(){
  if(operation.current||!preview||preview.scope==='all'&&confirmation!=='CONFIRMAR')return;
  operation.current=true;setBusy(true);setError('');
  try{
   const {error}=await supabase.rpc('confirm_admin_tips_grant',{p_request_id:preview.id,p_confirmation:confirmation});
   if(error)throw error;
   setPreview(null);setConfirmation('');requestId.current=null;setAmount('');setReason('');setSelected(null);setNotice('✓ TIPS atribuídos. A operação foi registada no histórico.');
   await reload();await onBalanceRefresh?.();
  }catch(error){setError(error.message);}finally{operation.current=false;setBusy(false);}
 }
 return <div className="admin-tips missions-admin"><header><h1>💰 Gestão de TIPS</h1><p>Atribui TIPS ao saldo existente dos participantes.</p></header>
 {error&&<p className="editor-error" role="alert">{error}</p>}{notice&&<p className="editor-notice" role="status">{notice}</p>}
 <section className="editor-panel"><h2>Destinatário</h2><div className="editor-types">{[['user','👤 Utilizador'],['all','👥 Todos']].map(([id,label])=><button disabled={busy} type="button" aria-pressed={scope===id} key={id} onClick={()=>{setScope(id);setSelected(null);resetRequest();}}>{label}</button>)}</div>
 {scope==='user'?<>{!selected?<AdminUserSearch disabled={busy} rpc="search_fds_tips_users" onSelect={user=>{setSelected(user);resetRequest();}}/>:<div className="tips-selected"><div><strong>{selected.username||selected.student_number}</strong><p>{selected.instagram_username?'@'+selected.instagram_username+' · ':''}{selected.student_number}</p><p>Saldo atual: <b>{format(selected.balance)} TIPS</b></p></div><button disabled={busy} onClick={()=>{setSelected(null);resetRequest();}}>Mudar utilizador</button></div>}</>:<div className="tips-bulk-summary"><strong>Todos os participantes elegíveis</strong><p>{format(count)} utilizadores · Total a distribuir: <b>{format(count*Number(amount||0))} TIPS</b></p><small>Contas excluídas dos bónus, sem acesso ou bloqueadas não recebem. Admins só recebem se forem incluídos explicitamente.</small></div>}
 </section><form onSubmit={prepare}><fieldset disabled={busy} className="editor-fields"><section className="editor-panel"><h2>Atribuição</h2><label>Valor TIPS *<input required type="number" min={1} max={1000000} step={1} value={amount} onChange={e=>{setAmount(e.target.value);resetRequest();}} placeholder="500"/></label><label>Motivo *<textarea required minLength={3} maxLength={300} rows={3} value={reason} onChange={e=>{setReason(e.target.value);resetRequest();}} placeholder="Prémio, bónus ou compensação"/></label><button className="tips-grant" disabled={scope==='user'&&!selected||scope==='all'&&count===0}>{busy?'A preparar…':amount?'Rever atribuição +'+format(amount)+' TIPS':'Rever atribuição'}</button></section></fieldset></form>
 <section className="editor-panel"><div className="tips-history-heading"><h2>Histórico de atribuições</h2><button disabled={busy} onClick={()=>reload().catch(error=>setError(error.message))}>Atualizar</button></div>{!history.length?<p>Ainda não há atribuições manuais.</p>:history.map(item=><article className="tips-history-row" key={item.id}><div><strong>{item.scope==='all'?'👥 Todos · '+format(item.recipient_count)+' utilizadores':'👤 '+item.recipient_name}</strong><p>{item.reason}</p><small>{new Date(item.completed_at).toLocaleString('pt-PT')} · Por {item.admin_name}</small></div><strong className="mission-reward">+{format(item.amount)} TIPS{item.scope==='all'&&<small> × {format(item.recipient_count)} · Total {format(item.total_tips)}</small>}</strong></article>)}</section>
 {preview&&<div className="tips-confirm-backdrop"><section className={'tips-confirm '+(preview.scope==='all'?'is-bulk':'')} role="dialog" aria-modal="true" aria-labelledby="tips-confirm-title" onKeyDown={event=>{if(event.key!=='Tab')return;const items=[...event.currentTarget.querySelectorAll('button:not(:disabled),input:not(:disabled)')];const first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}}>
 <h2 id="tips-confirm-title">{preview.scope==='all'?'⚠ Atribuir TIPS a todos?':'Confirmar atribuição?'}</h2><p>{preview.scope==='all'?format(preview.recipient_count)+' utilizadores':preview.recipient_name}</p><strong className="mission-reward">+{format(preview.amount)} TIPS{preview.scope==='all'?' por pessoa':''}</strong>
 {preview.scope==='user'?<p>Saldo: {format(preview.balance_before)} → <b>{format(Number(preview.balance_before)+Number(preview.amount))} TIPS</b></p>:<p>Total: <b>{format(preview.total_tips)} TIPS</b><br/>Esta atribuição altera os saldos e a classificação.</p>}<p className="tips-reason">{preview.reason}</p>
 {preview.scope==='all'&&<label>Escreve CONFIRMAR<input ref={confirmInput} value={confirmation} onChange={e=>setConfirmation(e.target.value)} autoComplete="off" disabled={busy}/></label>}{error&&<p className="editor-error" role="alert">{error}</p>}
 <small>Se a ligação falhar, volta a confirmar aqui. O mesmo pedido só é pago uma vez.</small><div className="editor-actions"><button disabled={busy} onClick={()=>{setPreview(null);setConfirmation('');requestId.current=null;}}>Cancelar</button><button ref={confirmButton} className="tips-grant" disabled={busy||preview.scope==='all'&&confirmation!=='CONFIRMAR'} onClick={confirm}>{busy?'A atribuir…':'✓ Confirmar +'+format(preview.amount)+' TIPS'}</button></div></section></div>}
 </div>;
}
