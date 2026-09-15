import {coResident,lifeContext} from './life_context.js';
import {id,random,bound} from '../core/rng.js';
import {age} from '../core/state.js';
import {createCharacter} from './character_generation.js';
import {currentMarriage} from './marriage.js';
import {addLongTerm} from './long_term_state.js';
export function reproductionConditions(s,a,b){
 if(!s.characters[a]?.alive||!s.characters[b]?.alive)return '父母未存活';
 if(!coResident(s,a,b))return '当前分隔两地，不能开始共同生育安排';
 const mother=[a,b].find(id=>s.characters[id].sex==='女'),father=[a,b].find(id=>s.characters[id].sex==='男');if(!mother||!father)return 'Mock 生物学条件不满足';
 if([a,b].some(id=>age(s,s.characters[id])<s.config.birth_age_min)||age(s,s.characters[mother])>=Math.min(45,s.config.birth_age_max))return '怀孕年龄不符合：45岁及以上不能怀孕';
 const last=s.characters[mother].last_birth_month;if(last!==undefined&&s.current_world_month-last<=12)return '产后第1～12个月不可再次怀孕';
 if([a,b].some(id=>s.health[id].value<s.config.birth_health_min||s.characters[id].physiology.fertility_basis===0))return '健康或生育基础不满足';
 if(Object.values(s.reproduction).some(r=>r.status==='active'&&r.mother_id===mother))return '已有持续生育状态';
 if(!currentMarriage(s,a)?.people.includes(b))return '本轮 Mock 场景要求有效婚姻';return null;
}
// MOCK_TUNABLE: willingness and capacity are separate, fertility_basis remains innate.
export function reproductionPriority(s,a,b){
 const m=currentMarriage(s,a);if(!m?.people.includes(b)||!s.characters[a].alive||!s.characters[b].alive)return {value:0,reasons:['没有有效共同婚姻']};
 const mother=[a,b].find(id=>s.characters[id].sex==='女');if(!mother)return {value:0,reasons:['未满足生育条件']};const children=Object.values(s.characters).filter(c=>c.alive&&c.biological_parent_ids.includes(mother)),cfg=s.config,lc=lifeContext(s,mother),base=s.world_id==='ancient'?cfg.reproduction_priority_ancient:cfg.reproduction_priority_modern;
 const childFactor=[1,cfg.children_decay_1??.6,cfg.children_decay_2??.3,cfg.children_decay_3??.08][Math.min(children.length,3)]*(children.length>=4?(cfg.children_decay_4??.025)/(cfg.children_decay_3??.08):1);
 const resources=bound(s.resources.households[s.characters[mother].current_household_id].household_resources/Math.max(1,cfg.living_cost*6),.03,1),care=1/(1+lc.care_time+children.filter(c=>age(s,c)<3).length*.2),r=Object.values(s.relationships).find(r=>[a,b].every(id=>r.people.includes(id))),relation=bound(((r?.attitude??0)+100)/100,.05,1),terms=lc.terms.some(t=>['health_recovery','away_from_home_assignment','temporary_distance'].includes(t.type))?.5:1;
 return {value:bound(base*childFactor*resources*care*relation*terms,0,1),base,children:children.length,children_factor:childFactor,resources,care,relationship_factor:relation,long_term_state_factor:terms,source:'MOCK_TUNABLE',reasons:['有效婚姻形成生育倾向','当前子女、家计、照护、关系和长期安排共同修正']};
}
export function fertilityCapacity(s,a,b){
 const mother=[a,b].find(id=>s.characters[id]?.sex==='女'),years=mother?age(s,s.characters[mother]):45,cfg=s.config,blocker=reproductionConditions(s,a,b);
 const partner_fertility_factor=Math.sqrt(Math.max(0,s.characters[a]?.physiology.fertility_basis||0)*Math.max(0,s.characters[b]?.physiology.fertility_basis||0))/100;
 const health_factor=Math.min(cfg.fertility_health_cap??.95,Math.min(s.health[a]?.value||0,s.health[b]?.value||0)/100*(cfg.fertility_health_cap??.95)),age_factor=years<30?1:bound(1-(years-30)*.055,0,1);
 return {eligible:!blocker,blocker,partner_fertility_factor,health_factor,age_factor,value:blocker?0:partner_fertility_factor*health_factor*age_factor,source:'MOCK_TUNABLE',fertility_base_field:'physiology.fertility_basis'};
}
export function conceptionChance(s,a,b){const priority=reproductionPriority(s,a,b),capacity=fertilityCapacity(s,a,b);return {priority,capacity,chance:s.config.reproduction_frequency===0?0:(s.config.conception_base??.26)*priority.value*capacity.value};}
function notice(s,type,mother,extra={}){const entry={type,month:s.current_world_month,mother_id:mother,health:s.health[mother].value,...extra};(s.life_notices||(s.life_notices=[])).push(entry);return entry;}
export function startReproduction(s,a,b){const reason=reproductionConditions(s,a,b);if(reason)return {started:false,reason};const mother=[a,b].find(id=>s.characters[id].sex==='女'),father=[a,b].find(id=>s.characters[id].sex==='男'),key=id(s,'pregnancy');s.reproduction[key]={id:key,mother_id:mother,father_id:father,start_month:s.current_world_month,due_month:s.current_world_month+s.config.gestation_months,status:'active'};addLongTerm(s,mother,'pregnancy',{system:'reproduction',id:key},s.config.gestation_months,90,['减少外出']);return {started:true,id:key,notice:notice(s,'pregnancy',mother,{father_id:father,pregnancy_month:1,due_month:s.reproduction[key].due_month})};}
export function checkConception(s,a,b){const facts=conceptionChance(s,a,b);if(!facts.capacity.eligible||s.config.reproduction_frequency===0)return {...facts,started:false};return {...facts,...(random(s)<facts.chance?startReproduction(s,a,b):{started:false})};}
export function monthlyConception(s){const results=[];for(const m of Object.values(s.marriages)){if(m.status!=='active')continue;const [a,b]=m.people,r=checkConception(s,a,b);m.reproduction_priority=r.priority;m.fertility_capacity=r.capacity;m.conception_chance=r.chance;if(r.started)results.push({marriage_id:m.id,...r});}return results;}
export function updateReproduction(s){const results=[];for(const r of Object.values(s.reproduction)){if(r.status!=='active')continue;if(!s.characters[r.mother_id].alive){r.status='ended';continue;}
 if(s.health[r.mother_id].value<s.config.birth_health_min&&!r.risk_notified){notice(s,'pregnancy_health',r.mother_id,{pregnancy_id:r.id});r.risk_notified=true;}
 if(s.current_world_month===r.due_month-1)notice(s,'birth_approaching',r.mother_id,{due_month:r.due_month});
 if(s.current_world_month<r.due_month)continue;const mother=s.characters[r.mother_id],child=createCharacter(s,{parents:[r.father_id,r.mother_id],household_id:mother.current_household_id,lineage_id:mother.lineage_id,fidelity:mother.simulation_fidelity||'full'});r.status='completed';r.child_id=child.character_id;mother.last_birth_month=s.current_world_month;s.health[mother.character_id].value=bound(s.health[mother.character_id].value-(s.config.birth_health_loss??12));s.health[mother.character_id].history.push({month:s.current_world_month,type:'childbirth',after:s.health[mother.character_id].value});
 s.households[mother.current_household_id].responsibilities[mother.character_id]={type:'care',until:s.current_world_month+s.config.care_months,mandatory:false};addLongTerm(s,mother.character_id,'infant_care',null,s.config.care_months,90,['照护']);notice(s,'birth',mother.character_id,{child_id:child.character_id,father_id:r.father_id});const m=currentMarriage(s,mother.character_id);if(m)m.reproduction_priority=reproductionPriority(s,r.mother_id,r.father_id);results.push({type:'birth',child_id:child.character_id,mother_id:r.mother_id,father_id:r.father_id});}return results;}
