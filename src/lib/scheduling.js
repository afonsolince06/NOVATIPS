export function toLocalDateTime(value) {
 const date=new Date(value);
 if(!Number.isFinite(date.getTime()))return '';
 return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);
}
export function windowState(start,end,now=Date.now()) {
 if(now>=Date.parse(end))return 'closed';
 if(start && now<Date.parse(start))return 'scheduled';
 return 'active';
}
export function isPredictionPublic(bet,now=Date.now()) {
 return bet.published!==false && (!bet.start_at || Date.parse(bet.start_at)<=now);
}
export function predictionState(bet,now=Date.now()) {
 if(bet.status==='resolved')return 'settled';
 if(bet.status==='cancelled')return 'cancelled';
 if(bet.published===false)return 'draft';
 return windowState(bet.start_at,bet.closes_at,now);
}
export const predictionStates={draft:'Rascunho',scheduled:'Agendada',active:'Ativa',closed:'Fechada',settled:'Resolvida',cancelled:'Cancelada'};
