import { useState } from 'react';
import './MyBets.css';
const number=n=>Number(n||0).toLocaleString('pt-PT');
const labels={Won:'✓ ACERTOU',Lost:'✕ FALHOU',Pending:'⏳ POR RESOLVER',Cancelled:'ANULADA'};
import { historySummary } from '../lib/historySummary';
function dayLabel(value){const d=new Date(value);if(!Number.isFinite(d.getTime()))return 'Sem data';const now=new Date();const yesterday=new Date();yesterday.setDate(now.getDate()-1);return d.toDateString()===now.toDateString()?'Hoje':d.toDateString()===yesterday.toDateString()?'Ontem':d.toLocaleDateString('pt-PT',{day:'numeric',month:'long',year:'numeric'});}
export default function MyBets({myBets,bets=[],sections=[],onViewBets}){
 const [filter,setFilter]=useState('All');const stats=historySummary(myBets);
 const filtered=[...myBets].filter(b=>filter==='All'||b.status===filter).sort((a,b)=>new Date(b.placed_at||b.placedAt)-new Date(a.placed_at||a.placedAt));
 const groups=new Map();filtered.forEach(b=>{const day=dayLabel(b.placed_at||b.placedAt);groups.set(day,[...(groups.get(day)||[]),b]);});
 return <div className="history-dashboard"><header className="history-hero"><h1>🎟 AS MINHAS PREVISÕES</h1><p>Acompanha as tuas previsões e resultados no FDS.</p></header>
 <div className="history-stats">{[[stats.total,'PREVISÕES'],[stats.won,'CERTAS ✓'],[stats.accuracy==null?'—':stats.accuracy.toLocaleString('pt-PT',{maximumFractionDigits:1})+'%','TAXA DE ACERTO']].map(([value,label])=><div key={label}><strong>{value}</strong><span>{label}</span></div>)}</div>
 <div className="history-filters" aria-label="Filtrar previsões">{[['All','Todas',stats.total],['Pending','⏳ Ativas',stats.pending],['Won','✓ Certas',stats.won],['Lost','✕ Falhadas',stats.lost]].map(([id,label,count])=><button key={id} aria-pressed={filter===id} onClick={()=>setFilter(id)}>{label} <span>{count}</span></button>)}</div>
 {!myBets.length?<section className="history-empty"><h2>🎟 Ainda não fizeste nenhuma previsão.</h2><p>Escolhe uma aposta e começa a subir no ranking.</p><button onClick={onViewBets}>Ver apostas</button></section>:!filtered.length?<p className="history-empty">Não há previsões neste filtro.</p>:[...groups].map(([day,items])=><section className="history-group" key={day}><h2>{day}</h2>{items.map(b=>{const prediction=bets.find(p=>p.id===b.bet_id);const section=sections.find(s=>s.id===(b.section||prediction?.section));const date=new Date(b.placed_at||b.placedAt);const close=prediction?.closes_at?new Date(prediction.closes_at):null;return <article className={'history-card status-'+b.status} key={b.id}>
 <div className="history-card-top"><span>{b.is_multiple?'PREVISÃO MÚLTIPLA':section?.title||'PREVISÃO'}{(b.mega_boost?.enabled||prediction?.mega_boost?.enabled)&&' · 🔥 MEGA BOOST'}</span><span className="history-status">{labels[b.status]||'POR RESOLVER'}</span></div>
 <h3>{b.bet_title||b.title}</h3><div className="history-selection"><small>A TUA PREVISÃO</small><strong>{b.option_label||b.option} <span>· {Number(b.odds).toFixed(2)}</span></strong></div>
 {b.is_multiple&&b.legs&&<details><summary>Ver seleções ({b.legs.length})</summary>{b.legs.map((leg,i)=><div className="history-leg" key={i}><span>{leg.bet_title}<strong>{leg.option_label} · {Number(leg.odds).toFixed(2)}</strong></span><span>{labels[leg.status]||labels.Pending}</span></div>)}</details>}
 <footer><div className="history-tips">{number(b.amount)} TIPS {b.status==='Won'?<strong>→ +{number(b.potential_return??b.potentialReturn)} TIPS recebidos</strong>:b.status==='Lost'?<strong>→ −{number(b.amount)} TIPS</strong>:b.status==='Cancelled'?<span>· Anulada</span>:<span>apostados · Retorno possível: {number(b.potential_return??b.potentialReturn)} TIPS</span>}</div><time dateTime={Number.isFinite(date.getTime())?date.toISOString():undefined}>{Number.isFinite(date.getTime())?date.toLocaleTimeString('pt-PT',{hour:'2-digit',minute:'2-digit'}):'—'}</time></footer>
 {b.status==='Pending'&&close&&<p className="history-close">{close>Date.now()?'Fecha a '+close.toLocaleString('pt-PT',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'Fechada · aguarda resultado'}</p>}
 </article>;})}</section>)}
 </div>;
}
