import { useState, useEffect } from 'react';
import { isFreshersWeekendEdition, supabase } from '../lib/supabase';
import { rankLeaderboard, nextRankTarget } from '../lib/leaderboard';
import '../leaderboard.css';
const format=value=>Number(value).toLocaleString('pt-PT');
function Avatar({entry}) {return <span className="ranking-avatar" style={{background:'hsl('+entry.rank*60+',55%,88%)',color:'hsl('+entry.rank*60+',55%,25%)'}}>{entry.name[0]?.toUpperCase()||'?'}</span>;}
export default function Leaderboard({ user }) {
 const [entries,setEntries]=useState([]);const [loading,setLoading]=useState(true);const [error,setError]=useState('');
 useEffect(()=>{let active=true;async function load(){setLoading(true);setError('');try{const users=[];for(let page=0;;page++){const {data,error}=await supabase.from(isFreshersWeekendEdition?'event_leaderboard':'profiles').select(isFreshersWeekendEdition?'*':'id,email,balance,username').order('balance',{ascending:false}).order('id',{ascending:true}).range(page*1000,page*1000+999);if(error)throw error;users.push(...data);if(data.length<1000)break;}if(active)setEntries(rankLeaderboard(users));}catch(err){if(active)setError(err.message||'Não foi possível carregar a classificação.');}finally{if(active)setLoading(false);}}load();return()=>{active=false;};},[user?.id]);
 const own=entries.find(u=>u.id===user?.id);const target=nextRankTarget(entries,user?.id);
 const top=entries.slice(0,3);const podium=[top[1],top[0],top[2]].filter(Boolean);
 return <div className="fds-ranking-page">
 <section className="ranking-hero"><header><h1>🏆 TOP DO <em>FDS</em></h1><p>Quem está a dominar as previsões?</p></header>
 {!loading&&!error&&<div className="ranking-podium">{podium.map(entry=>{const slot=top.indexOf(entry)+1;return <article key={entry.id} className={'podium-card podium-'+slot}><span className="podium-crown" aria-hidden="true">♛</span><span className="podium-rank">#{entry.rank}</span><Avatar entry={entry}/><h2>{entry.name}</h2><strong>{format(entry.tips)} <small>TIPS</small></strong><div className="podium-base"/></article>;})}</div>}
 </section>
 {own&&<section className="ranking-own"><div><h2>A TUA POSIÇÃO</h2><div className="ranking-own-identity"><b>#{own.rank}</b><Avatar entry={own}/><strong>{own.name}</strong></div></div><strong className="ranking-balance">{format(own.tips)} TIPS</strong><p className="ranking-progress">{own.rank===1?'👑 Estás no topo do FDS!':target?<>↑ Faltam <b>{format(target.difference)} TIPS</b> para igualares o #{target.rank}</>:'Partilhas esta posição com outros participantes.'}</p></section>}
 <section className="ranking-list"><div className="ranking-list-heading"><h2>▥ CLASSIFICAÇÃO GLOBAL</h2><span>Por TIPS ↓</span></div><p className="ranking-ties">Saldos iguais partilham a mesma posição.</p>
 {loading?<p role="status">A carregar classificação…</p>:error?<p role="alert">{error}</p>:!entries.length?<p>Ainda não há participantes na classificação.</p>:<table><thead><tr><th scope="col">#</th><th scope="col">UTILIZADOR</th><th scope="col">TIPS</th></tr></thead><tbody>{entries.map(entry=><tr key={entry.id} className={entry.id===user?.id?'is-current':''}><td><span className={'ranking-medal medal-'+entry.rank}>{entry.rank}</span></td><td><div className="ranking-user"><Avatar entry={entry}/><span>{entry.name}{entry.id===user?.id&&<small> · Tu</small>}</span></div></td><td>{format(entry.tips)}</td></tr>)}</tbody></table>}
 </section></div>;
}
