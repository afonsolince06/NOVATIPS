import {useRef,useState} from 'react';
import {supabase} from '../lib/supabase';
export default function AdminUserSearch({onSelect,rpc='search_fds_mission_users',buttonLabel='Selecionar',disabled=false}) {
 const [query,setQuery]=useState('');const [results,setResults]=useState(null);const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 const request=useRef(0);
 async function search(event){
  event.preventDefault();if(busy)return;
  const version=++request.current;setBusy(true);setError('');
  try{const {data,error}=await supabase.rpc(rpc,{p_query:query});if(error)throw error;if(version===request.current)setResults(data);}
  catch(error){if(version===request.current)setError(error.message);}
  finally{setBusy(false);}
 }
 return <section className="admin-user-search"><form className="mission-search" onSubmit={search}><input aria-label="Procurar utilizador" required minLength={2} value={query} onChange={e=>{request.current++;setQuery(e.target.value);setResults(null);}} placeholder="@instagram / nome / número de aluno"/><button disabled={busy||disabled}>{busy?'A procurar…':'Procurar'}</button></form>
 {error&&<p role="alert" className="editor-error">{error}</p>}{results?.length===0&&<p>Nenhum utilizador encontrado.</p>}
 {results?.map(user=><div className="mission-participant" key={user.id}><div><strong>{user.username||user.official_name||user.student_number}</strong><small>{user.student_number}{user.instagram_username?' · @'+user.instagram_username:''} · Saldo: {Number(user.balance).toLocaleString('pt-PT')} TIPS</small></div><button disabled={disabled||busy} onClick={()=>onSelect(user)}>{buttonLabel}</button></div>)}</section>;
}
