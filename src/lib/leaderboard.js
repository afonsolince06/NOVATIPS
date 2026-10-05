const correct=u=>Number(u.correct_predictions)||0;
const accuracy=u=>Number(u.accuracy)||0;
export function compareLeaderboard(a,b) {return Number(b.balance)-Number(a.balance)||correct(b)-correct(a)||accuracy(b)-accuracy(a);}
export function rankLeaderboard(users) {
 const sorted=[...users].sort(compareLeaderboard);
 return sorted.map(u=>({...u,rank:sorted.findIndex(v=>compareLeaderboard(v,u)===0)+1,name:u.username?.trim()||u.student_number||u.email?.split('@')[0]||'Participante',tips:Number(u.balance)||0}));
}
export function nextRankTarget(entries,id) {const own=entries.find(u=>u.id===id);if(!own)return null;const above=entries.filter(u=>u.rank<own.rank).at(-1);return above?{rank:above.rank,difference:above.tips-own.tips}:null;}
