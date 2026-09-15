// Shared ownership metadata and dispatch. Does not change event eligibility or weights.
export function playerDecisionType(event){if(event.flow_type==="ROUTINE_MONTHLY_PROGRESS")return null;
 if(!event.content_template)return ['education','career','relocation','marriage','health','conflict','away_review'].includes(event.type)?event.type:null;
 const effects=(event.terminal_outcomes||[]).flatMap(o=>o.effects||[]).map(e=>e.kind);
 if(effects.includes('marriage'))return 'marriage';
 return event.importance==='major'||effects.some(k=>['relocation','targeteducation','targetcareer','fundeducation','reduceeducation','reassign','care','distance'].includes(k))?'content':null;
}
