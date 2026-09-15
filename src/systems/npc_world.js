// MOCK_CONTENT / MOCK_TUNABLE. Background people share real person/state records.
import {integer,random,weighted} from '../core/rng.js';
import {age} from '../core/state.js';
import {lifeContext} from './life_context.js';
import {createCharacter} from './character_generation.js';
import {createHousehold} from './household.js';
import {employ,enroll} from './education_career.js';
import {establishMarriage,marriageHardConditions,arrangeMarriage,currentMarriage} from './marriage.js';
import {relationship} from './relationships.js';
export const stageOf=a=>a<12?'儿童':a<18?'青少年':a<30?'青年':a<45?'成年':a<60?'中年':'老年';
export const sameLocality=(s,a,b,contexts=null)=>{const x=contexts?.get(a)||lifeContext(s,a),y=contexts?.get(b)||lifeContext(s,b);return x.away||y.away||!x.co_resident||!y.co_resident?x.location.id===y.location.id:(s.characters[a].mock_locality||'本地')===(s.characters[b].mock_locality||'本地');};
export function initializePopulation(s,total=s.config.npc_initial_population){
 const wanted=Math.max(0,total+1-Object.keys(s.characters).length),created=[];
 while(created.length<wanted){const hid=createHousehold(s,'本地人家'),fund=s.resources.households[hid];fund.household_resources=integer(s,200,5000);const motherAge=integer(s,30,46);let father,mother,elder;
  for(let i=0;i<6&&created.length<wanted;i++){
   const sex=i===0||i===2?'男':i===1?'女':integer(s,0,1)?'男':'女',years=i===0?motherAge+integer(s,0,6):i===1?motherAge:i===2?integer(s,Math.max(63,motherAge+26),80):i===3?integer(s,18,28):integer(s,i===4?3:12,Math.min(17,motherAge-18));
   const c=createCharacter(s,{sex,surname:i===2||i===3?father.surname:undefined,age_years:years,household_id:hid,parents:i>=4?[father.character_id,mother.character_id]:i===3?[elder.character_id]:[],fidelity:i===3?'simplified':'background'});c.mock_locality='本地';c.mock_background=fund.household_resources<1500?'家计较紧':fund.household_resources>3500?'家计宽裕':'家计一般';
   s.health[c.character_id].value=integer(s,55,100);c.dynamic.stress=integer(s,0,45);s.resources.personal[c.character_id].personal_inheritable_estate=integer(s,0,300);
   if(years>=18&&years<65){employ(s,c.character_id,integer(s,0,2));c.skills.push({name:s.careers[c.character_id].skill,level:integer(s,8,65),source:'MOCK_CONTENT'});}else if(years>=6&&years<18&&random(s)<.65)enroll(s,c.character_id,0);
   if(i===0){father=c;s.households[hid].name=c.surname+'家';}if(i===1){mother=c;establishMarriage(s,father.character_id,mother.character_id,'MOCK_CONTENT initial family');}
   if(i===2){elder=c;father.biological_parent_ids=[elder.character_id];relationship(s,father.character_id,elder.character_id);}
   if(i>=4)for(const p of[father,mother])relationship(s,c.character_id,p.character_id);
   created.push(c.character_id);
  }
 }
 s.npc_world={source:'MOCK_CONTENT',initial_npcs:Object.keys(s.characters).length-1,created:created.length};return created;
}
export function importantNPC(s,cid,target,role=''){
 const c=s.characters[cid],t=s.characters[target];return !!t&&(c.spouse_character_id===target||c.biological_parent_ids.includes(target)||t.biological_parent_ids.includes(cid)||role==='mentor'&&c.mentor_character_id===target||['peer','colleague'].includes(role)&&s.careers[cid]?.id===s.careers[target]?.id||Object.values(s.relationships).some(r=>r.people.includes(cid)&&r.people.includes(target)&&r.attitude>=70));
}
export function selectNPC(s,cid,ids,role='ordinary'){
 if(!ids.length)return null;if(ids.length===1)return ids[0];const recent=s.npc_exposure?.recent||[],weights=ids.map(id=>{if(importantNPC(s,cid,id,role))return 1;const n=recent.filter(x=>x.target_id===id&&s.current_world_month-x.month<s.config.npc_repeat_months).length;return 1/(1+n/(s.config.npc_repeat_weight||.15));});return ids[weighted(s,weights)];
}
export function recordNPCExposure(s,cid,target,role='ordinary'){
 if(!target)return;const e=s.npc_exposure||(s.npc_exposure={recent:[],counts:{}}),important=importantNPC(s,cid,target,role);e.recent=e.recent.filter(x=>s.current_world_month-x.month<s.config.npc_repeat_months);e.recent.push({cid,target_id:target,role,month:s.current_world_month,important});const n=e.counts[target]||(e.counts[target]={ordinary:0,important:0});n[important?'important':'ordinary']++;
}
export function fullSimulationIds(s){
 const ids=new Set(s.npc_world?[]:Object.values(s.characters).filter(c=>c.alive&&c.active_simulation&&c.simulation_fidelity==='full').map(c=>c.character_id)),control=s.characters[s.control.current_control_character_id];
 if(control){for(const id of s.households[control.current_household_id].members)if(s.characters[id].alive)ids.add(id);if(control.mentor_character_id&&s.characters[control.mentor_character_id]?.alive)ids.add(control.mentor_character_id);}
 if(control&&s.npc_world)for(const r of Object.values(s.relationships).filter(r=>r.people.includes(control.character_id)&&r.attitude>=70).sort((a,b)=>b.attitude-a.attitude)){if(ids.size>=s.config.npc_full_limit)break;for(const id of r.people)if(s.characters[id].alive)ids.add(id);}
 return ids;
}
export function simplifiedDefaults(s,cid){
 const c=s.characters[cid],a=age(s,c),job=s.careers[cid],edu=s.education[cid],care=s.households[c.current_household_id].responsibilities[cid],list=[];
 if(a>=18&&a<65&&!job&&edu?.status!=='active'&&s.current_world_month%12===0)employ(s,cid,integer(s,0,2));
 if(care?.until>s.current_world_month)list.push({type:'care',name:'育儿与家庭照护',time:care.time??s.config.care_time});
 if(s.health[cid].value>=30){if(edu?.status==='active')list.push({type:'education',name:edu.name,time:edu.time,skill:edu.skill});const j=s.careers[cid];if(j?.status==='active')list.push({type:'career',name:j.name,time:j.time,skill:j.skill});}
 if(!list.length)list.push({type:'daily',name:'日常生活',time:.3});let used=0;for(const x of list){x.allocated=Math.max(0,Math.min(x.time,1-used));used+=x.allocated;}return {primary:list[0],secondary:list.slice(1),time_used:used,conflict:list.reduce((n,x)=>n+x.time,0)>1,work_fraction:(list.find(x=>x.type==='career')?.allocated||0)/(s.careers[cid]?.time||1)};
}
export function updateNPCMarriages(s,fullIds){
 if(s.current_world_month%12||!s.npc_world)return [];
 const single=Object.values(s.characters).filter(c=>c.alive&&!fullIds.has(c.character_id)&&age(s,c)>=18&&age(s,c)<45&&!currentMarriage(s,c.character_id)),results=[],localities=new Map(single.map(c=>[c.character_id,lifeContext(s,c.character_id)]));
 for(const c of single){if(currentMarriage(s,c.character_id)||random(s)>=s.config.npc_annual_marriage_rate)continue;const targets=single.filter(t=>t.sex!==c.sex&&sameLocality(s,c.character_id,t.character_id,localities)&&Math.abs(age(s,t)-age(s,c))<=s.config.npc_candidate_age_gap&&!marriageHardConditions(s,c.character_id,t.character_id));if(!targets.length)continue;const target=selectNPC(s,c.character_id,targets.map(t=>t.character_id),'candidate');const r=arrangeMarriage(s,c.character_id,target,'autonomous');results.push({character_id:c.character_id,target_id:target,status:r.status});}
 return results;
}
export function populationStats(s){const people=Object.values(s.characters),alive=people.filter(c=>c.alive),count=fn=>Object.fromEntries([...new Set(alive.map(fn))].map(k=>[k,alive.filter(c=>fn(c)===k).length]));return {total:people.length,alive:alive.length,households:Object.values(s.households).filter(h=>h.members.some(id=>s.characters[id].alive)).length,age_groups:count(c=>stageOf(age(s,c))),unmarried_eligible:alive.filter(c=>age(s,c)>=18&&age(s,c)<45&&!currentMarriage(s,c.character_id)).length,married:alive.filter(c=>currentMarriage(s,c.character_id)).length,careers:count(c=>s.careers[c.character_id]?.status==='active'?s.careers[c.character_id].name:'无固定职业'),education:count(c=>s.education[c.character_id]?.status||'无在读安排'),fidelity:count(c=>fullSimulationIds(s).has(c.character_id)?'full':c.simulation_fidelity==='full'?'simplified':c.simulation_fidelity||'旧版本未分级')};}
