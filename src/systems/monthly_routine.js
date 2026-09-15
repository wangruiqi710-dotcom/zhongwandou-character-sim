import {changeRelationship} from './relationships.js';
import {coResident} from './life_context.js';
import {age} from '../core/state.js';
export function routineRelations(s,fullIds){
 const done=new Set(),rows=[];for(const cid of fullIds){const c=s.characters[cid];if(!c?.alive)continue;const targets=new Set([c.spouse_character_id,...c.biological_parent_ids,...Object.values(s.characters).filter(x=>x.alive&&x.biological_parent_ids.includes(cid)).map(x=>x.character_id),c.mentor_character_id]);
  for(const r of Object.values(s.relationships))if(r.people.includes(cid)&&r.attitude>=70)targets.add(r.people.find(x=>x!==cid));
  for(const target of targets){if(!s.characters[target]?.alive||!coResident(s,cid,target))continue;const key=[cid,target].sort().join(':');if(done.has(key))continue;done.add(key);const kind=c.spouse_character_id===target?'夫妻共同生活':c.biological_parent_ids.includes(target)||s.characters[target].biological_parent_ids.includes(cid)?'亲子照护与成长':'重要关系日常联系';changeRelationship(s,cid,target,s.config.routine_relation_delta??.15,kind);rows.push({people:[cid,target],kind});}
 }return rows;
}
export function routineSummary(s,cid,d,before,relations,resourceChanges){
 const c=s.characters[cid],hh=s.households[c.current_household_id],children=Object.values(s.characters).filter(x=>x.alive&&x.biological_parent_ids.includes(cid)),pregnancy=Object.values(s.reproduction).find(p=>p.status==='active'&&p.mother_id===cid),tracks={};
 for(const a of[d.primary,...d.secondary].filter(Boolean))if(a.allocated>0)tracks[a.type]={name:a.name,time:a.allocated};
 tracks.family={members:hh.members.filter(id=>s.characters[id].alive&&coResident(s,cid,id)).length,remote_members:hh.members.filter(id=>s.characters[id].alive&&!coResident(s,cid,id)).length};tracks.health={before:before.health.value,after:s.health[cid].value,fatigue:c.dynamic.fatigue};tracks.resources=resourceChanges.find(x=>x.household_id===c.current_household_id);
 const interactions=relations.filter(r=>r.people.includes(cid));if(interactions.length)tracks.relationships=interactions;
 if(children.length)tracks.parenting={children:children.length,young_children:children.filter(x=>age(s,x)<3&&coResident(s,cid,x.character_id)).length};if(pregnancy)tracks.pregnancy={month:s.current_world_month-pregnancy.start_month+1,due_month:pregnancy.due_month};
 const terms=Object.values(s.long_term_states).filter(t=>t.character_id===cid&&t.status==='active');if(terms.length)tracks.long_term={active:terms.length};return {kind:'ROUTINE_MONTHLY_PROGRESS',tracks};
}
