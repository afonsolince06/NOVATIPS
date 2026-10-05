import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { generateOppositeOdds, resolveOptionBOdds } from '../lib/predictionOdds';
import BetCard from './BetCard';
import MegaBoost from './MegaBoost';

const draftKey = 'nova-tips-fds-prediction-draft';
const localDate = value => { const d = new Date(value); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0,16); };
const initial = () => ({ type:'normal', title:'', description:'', section:'general', labelA:'Sim', labelB:'Não', oddA:'', oddB:'', boostA:'', boostB:'', closesAt:localDate(Date.now()+3600000), duration:'1h', trending:false, featured:false, active:true, badge:'', image_path:'' });
const presets = [['30m','30 min',1800000],['1h','1h',3600000],['2h','2h',7200000],['6h','6h',21600000],['24h','24h',86400000]];
function Toggle({ label, detail, checked, onChange }) { return <button type="button" className="editor-toggle" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}><span><strong>{label}</strong><small>{detail}</small></span><span className="editor-switch" aria-hidden="true" /></button>; }

export default function PredictionEditor({ bets, sections, fdsMode, onAddBet, onSaved }) {
 const [form,setForm] = useState(initial);
 const [editing,setEditing] = useState('');
 const [file,setFile] = useState(null);
 const [fileUrl,setFileUrl] = useState('');
 const [busy,setBusy] = useState(false);
 const [error,setError] = useState('');
 const [notice,setNotice] = useState('');
 const [now,setNow] = useState(Date.now);
 const uploadInput = useRef(null);
 useEffect(() => () => { if(fileUrl) URL.revokeObjectURL(fileUrl); },[fileUrl]);
 useEffect(() => { const timer=setInterval(()=>setNow(Date.now()),1000);return ()=>clearInterval(timer); },[]);
 const set = (key,value) => setForm(prev=>({...prev,[key]:value}));
 const isMega = form.type === 'mega';
 const baseB = resolveOptionBOdds(form.oddA,form.oddB);
 const closingMs = new Date(form.closesAt).getTime();
 const closingText = Number.isFinite(closingMs) ? new Date(closingMs).toLocaleString('pt-PT',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : 'Escolhe o fecho';
 const minutes = Math.max(0,Math.ceil((closingMs-now)/60000));
 const event = sections.find(s=>s.id===form.section);
 const image = fileUrl || (form.image_path ? supabase.storage.from('prediction-images').getPublicUrl(form.image_path).data.publicUrl : null);
 const previewBet = { title:form.title || 'Título da previsão', description:form.description, trending:form.trending, featured:form.featured, closes_at:Number.isFinite(closingMs)?new Date(closingMs).toISOString():undefined, options:[{label:form.labelA,odds:Number(isMega && form.boostA ? form.boostA : form.oddA)||0},...(!isMega || form.labelB.trim() ? [{label:form.labelB,odds:Number(isMega && form.boostB ? form.boostB : baseB)||0}] : [])], mega_boost:{badge:form.badge,image_path:form.image_path,base_yes_odds:form.oddA,base_no_odds:baseB,boosted_odds:form.boostA,boosted_no_odds:form.labelB.trim()?form.boostB:null} };
 const pickFile = selected => {
   setError('');
   if(selected && (!['image/jpeg','image/png','image/webp'].includes(selected.type)||selected.size>5242880)) {setError('Usa JPG, PNG ou WebP até 5 MB.');return;}
   setFile(selected);setFileUrl(selected?URL.createObjectURL(selected):'');
 };
 const clear = () => {setForm(initial());setEditing('');setFile(null);setFileUrl('');if(uploadInput.current)uploadInput.current.value='';};
 const choose = id => {
   setError('');setNotice('');setEditing(id);setFile(null);setFileUrl('');
   const bet=bets.find(b=>b.id===id);if(!bet){setForm(initial());return;}
   const opts=typeof bet.options==='string'?JSON.parse(bet.options):bet.options;
   setForm({...initial(),type:bet.mega_boost?.enabled?'mega':'normal',title:bet.title,description:bet.description,section:bet.section||'general',labelA:opts[0]?.label||'Sim',labelB:opts[1]?.label||'',oddA:bet.mega_boost?.base_yes_odds||opts[0]?.odds||'',oddB:bet.mega_boost?.base_no_odds||opts[1]?.odds||'',boostA:bet.mega_boost?.boosted_odds||'',boostB:bet.mega_boost?.boosted_no_odds||'',closesAt:localDate(bet.closes_at),duration:'custom',trending:bet.trending,featured:bet.featured,active:bet.mega_boost?.active??true,badge:bet.mega_boost?.badge||'',image_path:bet.mega_boost?.image_path||''});
 };
 const saveDraft = () => {
   try {localStorage.setItem(draftKey,JSON.stringify({form,editing}));setNotice('Rascunho guardado neste browser. Uma imagem ainda não enviada terá de ser selecionada novamente.');}catch{setError('Não foi possível guardar o rascunho neste browser.');}
 };
 const loadDraft = () => {try{const draft=JSON.parse(localStorage.getItem(draftKey));if(draft){setForm({...initial(),...draft.form});setEditing(draft.editing||'');setFile(null);setFileUrl('');setNotice('Rascunho recuperado. Confirma o prazo e a imagem antes de publicar.');}}catch{setError('Não foi possível recuperar o rascunho.');}};
 const submit = async e => {
   e.preventDefault();if(busy)return;setError('');setNotice('');
   if(!form.labelA.trim()||((!isMega||form.labelB.trim())&&(!form.labelB.trim()||form.labelA.trim().toLowerCase()===form.labelB.trim().toLowerCase()))){setError('Define nomes distintos para as opções.');return;}
   if(!Number.isFinite(Number(form.oddA))||Number(form.oddA)<=1||((!isMega||form.labelB.trim())&&(!Number.isFinite(Number(baseB))||Number(baseB)<=1))){setError('As odds base têm de ser superiores a 1.');return;}
   if(!Number.isFinite(closingMs)||closingMs<=Date.now()){setError('Escolhe uma data de fecho futura.');return;}
   if(isMega && ((form.boostA && Number(form.boostA)<=Number(form.oddA))||(form.labelB.trim()&&form.boostB&&Number(form.boostB)<=Number(baseB)))){setError('Cada odd boosted deve superar a respetiva odd base.');return;}
   if(isMega&&!image){setError('Escolhe uma imagem para o Mega Boost.');return;}
   const other=bets.find(b=>b.id!==editing&&b.mega_boost?.enabled&&b.mega_boost?.active);
   if(isMega&&form.active&&other&&!window.confirm('“'+other.title+'” já está ativo. Substituir este Mega Boost e desativar o anterior?'))return;
   setBusy(true);
   try {
     let imagePath=form.image_path;
     if(isMega&&file){const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type];const key='mega-boost/'+crypto.randomUUID()+'.'+ext;const {error:uploadError}=await supabase.storage.from('prediction-images').upload(key,file,{contentType:file.type});if(uploadError)throw uploadError;imagePath=key;set('image_path',key);setFile(null);setFileUrl('');}
     if(fdsMode){
       const {error:saveError}=await supabase.rpc('save_prediction',{p_bet_id:editing||null,p_replace_id:other?.id||null,p_payload:{enabled:isMega,active:isMega&&form.active,title:form.title.trim(),description:form.description.trim(),section:form.section,yes_label:form.labelA.trim(),no_label:form.labelB.trim(),yes_odds:form.oddA,no_odds:form.labelB.trim()?baseB:'',boosted_odds:isMega?form.boostA:'',boosted_no_odds:isMega&&form.labelB.trim()?form.boostB:'',closes_at:new Date(closingMs).toISOString(),image_path:imagePath,badge:isMega?form.badge:'',trending:form.trending,featured:form.featured}});
       if(saveError)throw saveError;
       await onSaved();
       // Preserve the existing notification integration for newly published predictions.
       if(!editing){try{await supabase.functions.invoke('send-bet-notification',{body:{title:'🎯 Nova aposta: '+form.title,body:form.description||'Entra e faz a tua previsão!'}});}catch{/* Notifications are optional. */}}
     }else{const ok=await onAddBet({title:form.title.trim(),description:form.description.trim(),options:previewBet.options,closes_in_label:form.duration==='custom'?Math.ceil((closingMs-Date.now())/3600000)+'h':form.duration,closes_at:new Date(closingMs).toISOString(),trending:form.trending,featured:form.featured,status:'open'});if(!ok)throw Error('Não foi possível publicar a previsão.');}
     clear();try{localStorage.removeItem(draftKey);}catch{/* Saving a prediction does not depend on local storage. */}setNotice(editing?'Previsão atualizada.':'Previsão publicada.');
   }catch(err){setError(err.message||'Não foi possível guardar.');}finally{setBusy(false);}
 };
 return <div className="prediction-editor" id="create-prediction">
  <header className="editor-header"><div><h1>{editing?'Editar previsão':'Criar previsão'}</h1><p>Cria uma previsão para o FDS do Caloiro.</p></div><button type="button" onClick={()=>setNotice('Escolhe o tipo, define as opções e publica. Odd B vazia usa a fórmula automática. Boosts são independentes. As opções e odds não podem mudar depois de haver apostas.')}>ⓘ Como funciona?</button></header>
  <div className="editor-layout">
   <form onSubmit={submit} className="editor-form"><fieldset disabled={busy} className="editor-fields">
    <section className="editor-panel"><h2>▣ Tipo de previsão</h2><div className="editor-types" role="group" aria-label="Tipo de previsão">{[['normal','⚡','NORMAL','Previsão standard'],...(fdsMode?[['mega','🔥','MEGA BOOST','Destaque especial']]:[])].map(([type,icon,label,detail])=><button type="button" key={type} aria-pressed={form.type===type} className={form.type===type?'selected':''} onClick={()=>set('type',type)}><span>{icon}</span><div><strong>{label}</strong><small>{detail}</small></div></button>)}</div>
     {fdsMode&&<label className="editor-existing">Criar ou editar<select value={editing} onChange={e=>choose(e.target.value)}><option value="">+ Nova previsão</option>{bets.map(b=><option key={b.id} value={b.id}>{b.title}</option>)}</select></label>}
    </section>
    <section className="editor-panel"><h2>▤ Detalhes da previsão</h2><label>Título *<input required value={form.title} onChange={e=>set('title',e.target.value)} placeholder="Quem ganha?" /></label><label>Descrição (opcional)<textarea rows={2} value={form.description} onChange={e=>set('description',e.target.value)} placeholder="Uma breve descrição da previsão" /></label><div className="editor-pair"><label>Evento / Categoria *<select value={form.section} onChange={e=>set('section',e.target.value)}>{(sections.length?sections:[{id:'general',title:'Apostas Gerais'}]).map(s=><option key={s.id} value={s.id}>{s.title}</option>)}</select></label><div><label>Fecha em *</label><div className="editor-presets">{presets.map(([value,label,ms])=><button type="button" key={value} aria-pressed={form.duration===value} onClick={()=>setForm(prev=>({...prev,duration:value,closesAt:localDate(Date.now()+ms)}))}>{label}</button>)}<button type="button" aria-pressed={form.duration==='custom'} onClick={()=>set('duration','custom')}>📅 Custom</button></div></div></div>{form.duration==='custom'&&<label>Data e hora local<input required type="datetime-local" value={form.closesAt} onChange={e=>set('closesAt',e.target.value)} /></label>}<p className="editor-closing">◷ Fecha a {closingText}{Number.isFinite(minutes)?' · daqui a '+minutes+' min':''}</p></section>
    <section className="editor-panel"><h2>♧ Opções e odds</h2><div className="editor-pair">{[['A','labelA','oddA'],['B','labelB','oddB']].map(([letter,name,odd])=><div className={'editor-option option-'+letter} key={letter}><h3><span>{letter}</span> OPÇÃO {letter}</h3><label>Nome da opção {letter==='B'&&isMega?'(opcional)':'*'}<input required={letter==='A'||!isMega} value={form[name]} onChange={e=>set(name,e.target.value)} /></label><label>Odd base {letter==='A'?'*':'(opcional / AUTO)'}<input type="number" required={letter==='A'} min="1.02" step="0.01" disabled={letter==='B'&&isMega&&!form.labelB.trim()} value={form[odd]} onChange={e=>set(odd,e.target.value)} placeholder={letter==='B'?'AUTO → '+(generateOppositeOdds(form.oddA)||'—'):'1.70'} /></label></div>)}</div></section>
    {isMega&&<section className="editor-panel"><h2>🔥 Definições Mega Boost</h2><div className="editor-upload" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();pickFile(e.dataTransfer.files?.[0]||null);}}>{image?<img src={image} alt="Banner selecionado" />:<div className="editor-drop"><span>▧</span><strong>Arrasta o banner para aqui</strong><small>ou escolhe uma imagem</small></div>}<input hidden ref={uploadInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>pickFile(e.target.files?.[0]||null)} /><div className="editor-upload-actions"><button type="button" onClick={()=>uploadInput.current?.click()}>{image?'Substituir':'Escolher imagem'}</button>{image&&<button type="button" onClick={()=>{pickFile(null);set('image_path','');if(uploadInput.current)uploadInput.current.value='';}}>Remover</button>}</div><small>JPG · PNG · WEBP · MAX 5 MB</small></div><label>Badge personalizado<input maxLength={80} value={form.badge} onChange={e=>set('badge',e.target.value)} /></label><div className="editor-pair"><label>Odd boosted — opção A (opcional)<input type="number" min="1.02" step="0.01" value={form.boostA} onChange={e=>set('boostA',e.target.value)} placeholder="Usar odd base" /></label><label>Odd boosted — opção B (opcional)<input type="number" min="1.02" step="0.01" disabled={!form.labelB.trim()} value={form.boostB} onChange={e=>set('boostB',e.target.value)} placeholder="Usar odd base" /></label></div><Toggle label="Destaque ativo" detail="Mostrar antes dos eventos" checked={form.active} onChange={value=>set('active',value)} /></section>}
    <section className="editor-panel"><h2>▣ Opções de exibição</h2><div className="editor-pair"><Toggle label="🔥 Marcar como Hot" detail="Destacar como tendência" checked={form.trending} onChange={v=>set('trending',v)} /><Toggle label="⭐ Destacar no topo" detail="Marcar como Featured" checked={form.featured} onChange={v=>set('featured',v)} /></div></section>
    {error&&<p role="alert" className="editor-error">{error}</p>}{notice&&<p role="status" className="editor-notice">{notice}</p>}
    <footer className="editor-actions"><button type="button" onClick={saveDraft}>Guardar rascunho</button><button type="submit" className="editor-publish">{busy?'A guardar…':editing?'Guardar alterações':isMega?'🔥 Publicar Mega Boost':'🚀 Publicar previsão'}</button></footer><div className="editor-draft-actions"><button type="button" onClick={loadDraft}>Recuperar rascunho local</button><button type="button" onClick={clear}>Nova previsão</button></div>
   </fieldset></form>
   <aside className="editor-preview"><section className="editor-panel preview-panel"><h2>◉ LIVE PREVIEW</h2><p>Assim será exibida no site para os utilizadores.</p><div className="fds-app">{isMega?<MegaBoost bet={previewBet} imageUrl={image} onOptionClick={()=>{}} />:<div className="editor-normal-preview"><span className="editor-event-name">✦ {event?.title||'Apostas Gerais'}</span><BetCard bet={previewBet} variant="fds" onOptionClick={()=>{}} /></div>}</div></section><section className="editor-panel editor-summary"><h2>Detalhes no site</h2><dl>{[['Evento',event?.title||'Apostas Gerais'],['Data de fecho',closingText],['Tipo',isMega?'Mega Boost':'Previsão normal'],['Hot',form.trending?'Sim':'Não'],['Destacado',form.featured?'Sim':'Não'],...(isMega?[['Ativo',form.active?'Sim':'Não']]:[])].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section></aside>
  </div>
 </div>;
}
