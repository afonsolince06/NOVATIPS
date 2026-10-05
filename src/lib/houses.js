export const houseImportStates={matched:'Correspondência confirmada',pending_account:'Sem conta · atribuição guardada para o registo',unmatched:'Sem correspondência',ambiguous:'Ambíguo',conflict:'Conflito · manter atribuição atual'};
export const houseMetricLabel=mode=>mode==='total'?'TIPS TOTAIS':'TIPS / MEMBRO';
export const formatHouseScore=value=>value==null?'—':Number(value).toLocaleString('pt-PT',{maximumFractionDigits:2});
export function summarizeHouseImport(rows){return rows.reduce((counts,row)=>({...counts,[row.status]:(counts[row.status]||0)+1}),{});}
