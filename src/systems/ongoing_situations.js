import {id,bound} from '../core/rng.js';
import {recordEvent} from './life_context.js';
export function ensureSituation(s,type,participants,causes,severity=20,scope_key=null){
 let x=Object.values(s.ongoing_situations).find(x=>x.status==='active'&&x.type===type&&(scope_key?x.scope_key===scope_key:x.participants.join('|')===participants.join('|')));
 if(x)return x;
 const prior=Object.values(s.ongoing_situations).filter(x=>x.type===type&&x.participants.join('|')===participants.join('|'));
 const key=id(s,'situation');x={id:key,type,scope_key,start_month:s.current_world_month,severity,status:'active',participants,causes,last_development_month:s.current_world_month,development_history:[{month:s.current_world_month,kind:'started',severity}],resolution_conditions:['原因消失并恢复','当事人死亡'],previous_situation_ids:prior.map(p=>p.id),needs_decision:false,last_decision_month:null};s.ongoing_situations[key]=x;participants.forEach(cid=>recordEvent(s,cid,type,'situation_started'));return x;
}
export function updateSituations(s,cid,defaults){
 const c=s.characters[cid],h=s.resources.households[c.current_household_id],causes=[];
 if(defaults.conflict)causes.push('职责时间超过可用时间');if(h.unfunded_months>=s.config.household_conflict_months){const members=s.households[c.current_household_id].members.filter(id=>s.characters[id].alive).sort();ensureSituation(s,'financial_strain',members,['家庭收支持续不足'],20,c.current_household_id);}
 if(causes.length)ensureSituation(s,'family_conflict',[cid],causes);
 const marriage=Object.values(s.marriages).find(m=>m.status==='active'&&m.people.includes(cid)),rel=marriage&&Object.values(s.relationships).find(r=>marriage.people.every(p=>r.people.includes(p)));
 if(marriage&&c.dynamic.stress>s.config.stress_trigger&&rel?.attitude<s.config.relationship_conflict_trigger)ensureSituation(s,'relationship_strain',[...marriage.people].sort(),['压力与关系同时恶化']);
 const developments=[];
 for(const x of Object.values(s.ongoing_situations).filter(x=>x.status==='active'&&x.participants[0]===cid)){
  if(x.content_theme)continue;
  if(x.type==='marriage_negotiation'){const marriages=Object.values(s.marriages).filter(m=>m.status==='active'&&x.participants.some(p=>m.people.includes(p)));if(marriages.length){x.status=marriages.some(m=>x.participants.every(p=>m.people.includes(p)))?'resolved':'ended';x.end_month=s.current_world_month;x.development_history.push({month:s.current_world_month,kind:x.status,severity:x.severity});}continue;}
  const still=x.type==='financial_strain'?h.unfunded_months>=s.config.household_conflict_months:x.type==='family_conflict'?causes.length>0:!!(marriage&&rel?.attitude<s.config.relationship_conflict_trigger&&c.dynamic.stress>s.config.stress_trigger);
  const old=x.severity;x.severity=bound(old+(still?s.config.situation_worsening:-s.config.situation_recovery));x.causes=x.type==='family_conflict'?causes:x.causes;
  const kind=x.severity===0?'resolved':Math.floor(x.severity/s.config.situation_notice_step)!==Math.floor(old/s.config.situation_notice_step)?(x.severity>old?'worsened':'improved'):'unchanged';
  if(kind==='resolved'){x.status='resolved';x.end_month=s.current_world_month;}
  x.needs_decision=x.status==='active'&&x.severity>=s.config.situation_decision_threshold&&(x.last_decision_month===null||s.current_world_month-x.last_decision_month>=s.config.situation_decision_cooldown);
  if(kind!=='unchanged'){x.last_development_month=s.current_world_month;x.development_history.push({month:s.current_world_month,kind,severity:x.severity,causes:[...x.causes]});recordEvent(s,cid,x.type,kind);}
  developments.push({situation_id:x.id,type:x.type,kind,severity:x.severity,needs_decision:x.needs_decision});
 }
 return developments;
}
