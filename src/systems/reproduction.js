import {coResident,lifeContext as lifeContextForPriority} from './life_context.js';
import {id} from '../core/rng.js';
import {age} from '../core/state.js';
import {createCharacter} from './character_generation.js';
import {currentMarriage} from './marriage.js';
import {addLongTerm} from './long_term_state.js';
export function reproductionConditions(s,a,b){
 if(!s.characters[a]?.alive||!s.characters[b]?.alive)return '父母未存活';
 if(!coResident(s,a,b))return '当前分隔两地，不能开始共同生育安排';
 const mother=[a,b].find(id=>s.characters[id].sex==='女'),father=[a,b].find(id=>s.characters[id].sex==='男');if(!mother||!father)return 'Mock 生物学条件不满足';
 if([a,b].some(id=>age(s,s.characters[id])<s.config.birth_age_min)||age(s,s.characters[mother])>s.config.birth_age_max)return 'Mock 生育年龄条件不满足';
 if([a,b].some(id=>s.health[id].value<s.config.birth_health_min||s.characters[id].physiology.fertility_basis===0))return '健康或生育基础不满足';
 if(Object.values(s.reproduction).some(r=>r.status==='active'&&r.mother_id===mother))return '已有持续生育状态';
 if(!currentMarriage(s,a)?.people.includes(b))return '本轮 Mock 场景要求有效婚姻';
 return null;
}
// MOCK_TUNABLE: derived each month, not a fixed birth schedule or a genetic rule.
export function reproductionPriority(s,a,b){
 if(reproductionConditions(s,a,b))return {value:0,reasons:['当前现实生育条件未满足']};
 const ids=[a,b],mother=ids.find(id=>s.characters[id].sex==='女'),children=Object.values(s.characters).filter(c=>c.biological_parent_ids.includes(mother)),lc=lifeContextForPriority(s,mother),cfg=s.config;
 const base=s.world_id==='ancient'?(cfg.reproduction_priority_ancient??.32):(cfg.reproduction_priority_modern??.16),health=Math.min(...ids.map(id=>s.health[id].value))/100,fertility=ids.reduce((n,id)=>n+s.characters[id].physiology.fertility_basis,0)/200;
 const rel=Object.values(s.relationships).find(r=>ids.every(id=>r.people.includes(id))),relation=Math.max(.05,Math.min(1,((rel?.attitude||0)+100)/100));
 const youngest=children.length?Math.max(...children.map(c=>c.birth_month)):null,spacing=youngest===null?1:Math.max(0,Math.min(1,(s.current_world_month-youngest)/(cfg.reproduction_priority_spacing??18)));
 const funds=s.resources.households[s.characters[mother].current_household_id].household_resources,resources=Math.max(.05,Math.min(1,funds/Math.max(1,cfg.living_cost*6))),care=1/(1+lc.care_time*2+children.filter(c=>c.alive&&age(s,c)<3).length),ageFactor=Math.max(.1,Math.min(1,(cfg.birth_age_max-age(s,s.characters[mother])+1)/12));
 const terms=lc.terms.some(t=>['health_recovery','away_from_home_assignment'].includes(t.type))?.5:1;
 return {value:(cfg.reproduction_frequency===0?0:1)*base*health*fertility*relation*resources*spacing*care*ageFactor*terms/(1+children.length*(cfg.reproduction_priority_child_penalty??.55)),base,health,fertility,relation,resources,spacing,care,age_factor:ageFactor,children:children.length,source:'MOCK_TUNABLE',reasons:['有效婚姻提高生育优先级','按年龄、健康、生育基础、关系、资源、子女、生产间隔和照护重新计算']};
}
export function startReproduction(s,a,b){const reason=reproductionConditions(s,a,b);if(reason)return {started:false,reason};const mother=[a,b].find(id=>s.characters[id].sex==='女'),father=[a,b].find(id=>s.characters[id].sex==='男');const key=id(s,'pregnancy');s.reproduction[key]={id:key,mother_id:mother,father_id:father,start_month:s.current_world_month,due_month:s.current_world_month+s.config.gestation_months,status:'active'};addLongTerm(s,mother,'pregnancy',{system:'reproduction',id:key},s.config.gestation_months,90,['减少外出']);return {started:true,id:key};}
export function updateReproduction(s){const results=[];for(const r of Object.values(s.reproduction)){if(r.status!=='active')continue;if(!s.characters[r.mother_id].alive){r.status='ended';continue;}if(s.current_world_month<r.due_month)continue;const mother=s.characters[r.mother_id];const child=createCharacter(s,{parents:[r.father_id,r.mother_id],household_id:mother.current_household_id,lineage_id:mother.lineage_id});r.status='completed';r.child_id=child.character_id;s.households[mother.current_household_id].responsibilities[mother.character_id]={type:'care',until:s.current_world_month+s.config.care_months,mandatory:false};addLongTerm(s,mother.character_id,'infant_care',null,s.config.care_months,90,['照护']);const m=currentMarriage(s,mother.character_id);if(m)m.reproduction_priority=reproductionPriority(s,r.mother_id,r.father_id);results.push({type:'birth',child_id:child.character_id,mother_id:r.mother_id,father_id:r.father_id});}return results;}
