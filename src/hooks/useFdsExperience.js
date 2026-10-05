import {useCallback,useEffect,useRef,useState} from 'react';
import {isFreshersWeekendEdition,supabase} from '../lib/supabase';
const pendingKey=id=>'novatips_fds_experience_pending_'+id;
function pending(id){try{return JSON.parse(localStorage.getItem(pendingKey(id))||'{}');}catch{return {};}}
function store(id,value){try{if(value.onboarding||value.help?.length)localStorage.setItem(pendingKey(id),JSON.stringify(value));else localStorage.removeItem(pendingKey(id));}catch{/* Durable server storage remains the primary source. */}}
export default function useFdsExperience(user){
 const epoch=useRef(0);const [state,setState]=useState(null);const userId=user?.id;
 const data=userId&&state?.id===userId?state.data:null;
 useEffect(()=>{if(!isFreshersWeekendEdition||!userId)return;let active=true;
 async function load(){const token=++epoch.current;const queue=pending(userId);if(queue.onboarding||queue.help?.length){const topics=queue.help?.length?queue.help:[null];let failed=false;for(const topic of topics){const {error}=await supabase.rpc('mark_fds_experience',{p_onboarding:Boolean(queue.onboarding),p_help:topic});if(error)failed=true;}if(!failed){const current=pending(userId);store(userId,{onboarding:queue.onboarding?false:current.onboarding,help:(current.help||[]).filter(x=>!queue.help?.includes(x))});}}
 const {data,error}=await supabase.rpc('my_fds_experience');if(active&&token===epoch.current&&!error&&data&&!Array.isArray(data)&&Number.isInteger(data.onboarding_version_seen)&&Array.isArray(data.seen_help)){const remaining=pending(userId);setState({id:userId,data:{...data,onboarding_version_seen:remaining.onboarding?Math.max(data.onboarding_version_seen,1):data.onboarding_version_seen,seen_help:[...new Set([...(data.seen_help||[]),...(remaining.help||[])])]}});}}
 load();const timer=setInterval(load,30000);window.addEventListener('focus',load);window.addEventListener('online',load);return()=>{active=false;clearInterval(timer);window.removeEventListener('focus',load);window.removeEventListener('online',load);};},[userId]);
 const mark=useCallback(async({onboarding=false,help=null}={})=>{if(!userId)return;epoch.current++;const queue=pending(userId);const next={onboarding:queue.onboarding||onboarding,help:[...new Set([...(queue.help||[]),...(help?[help]:[])])]};store(userId,next);
 setState(old=>old?.id===userId?{...old,data:{...old.data,onboarding_version_seen:onboarding?1:old.data.onboarding_version_seen,seen_help:[...new Set([...(old.data.seen_help||[]),...(help?[help]:[])])]}}:old);
 const {error}=await supabase.rpc('mark_fds_experience',{p_onboarding:onboarding,p_help:help});if(!error){const current=pending(userId);store(userId,{onboarding:onboarding?false:current.onboarding,help:(current.help||[]).filter(x=>x!==help)});}return !error;
 },[userId]);return {experience:data,markExperience:mark};
}
