import {useEffect,useState} from 'react';
import {supabase} from '../lib/supabase';
import {predictionState,predictionStates} from '../lib/scheduling';
export default function PredictionManagement({bets,onEdit,onChanged,onResolve,schedulingEnabled=false}) {
 const [filter,setFilter]=useState('scheduled');const [now,setNow]=useState(Date.now);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
 async function change(bet,action){
  if(busy||!schedulingEnabled)return;
  if(action==='publish_now'&&!window.confirm('Publicar “'+bet.title+'” agora? O fecho mantém-se a '+new Date(bet.closes_at).toLocaleString('pt-PT')+'.'))return;
  if(action==='cancel_schedule'&&!window.confirm('Cancelar o agendamento de “'+bet.title+'” e guardar como rascunho?'))return;
  setBusy(true);setError('');
  try{const {error}=await supabase.rpc('set_prediction_publication',{p_bet_id:bet.id,p_action:action});if(error)throw error;await onChanged();}
  catch(error){setError(error.message);}finally{setBusy(false);}
 }
 const list=bets.filter(b=>filter==='all'||predictionState(b,now)===filter);
 return <div className="missions-admin prediction-management"><h1>Previsões</h1><p>Publicação e encerramento são horários independentes, na hora local.</p><div className="mission-filters">{[['all','Todas'],['draft','Rascunhos'],['scheduled','Agendadas'],['active','Ativas'],['closed','Fechadas'],['settled','Resolvidas']].map(([id,label])=><button key={id} aria-pressed={filter===id} onClick={()=>setFilter(id)}>{label} {bets.filter(b=>id==='all'||predictionState(b,now)===id).length}</button>)}</div>
 {error&&<p role="alert" className="editor-error">{error}</p>}{!list.length&&<p className="mission-empty">Não há previsões neste estado.</p>}
 {list.map(bet=>{const state=predictionState(bet,now);return <article className="mission-admin-row" key={bet.id}><div><span className={'prediction-state state-'+state}>{state==='scheduled'?'🗓 ':''}{predictionStates[state]}{bet.mega_boost?.enabled?' · 🔥 Mega Boost':''}</span><h3>{bet.title}</h3><p>Publica: {new Date(bet.start_at||bet.created_at).toLocaleString('pt-PT')}<br/>Fecha: {new Date(bet.closes_at).toLocaleString('pt-PT')}</p>{bet.status==='resolved'&&<small>Resultado: {bet.winning_option}</small>}</div><div className="mission-toolbar">{bet.status==='open'&&<button disabled={busy} onClick={()=>onEdit(bet)}>Editar</button>}{state==='scheduled'&&schedulingEnabled&&<><button disabled={busy} onClick={()=>change(bet,'publish_now')}>Publicar agora</button><button disabled={busy} onClick={()=>change(bet,'cancel_schedule')}>Cancelar agendamento</button></>}{['active','closed'].includes(state)&&<button disabled={busy} onClick={onResolve}>Resolver</button>}</div></article>;})}</div>;
}
