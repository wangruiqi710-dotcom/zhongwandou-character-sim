import {id} from '../core/rng.js';
import {age} from '../core/state.js';
import {createCharacter} from './character_generation.js';
import {currentMarriage} from './marriage.js';
import {addLongTerm} from './long_term_state.js';
export function reproductionConditions(s,a,b){
 if(!s.characters[a]?.alive||!s.characters[b]?.alive)return '父母未存活';
 const mother=[a,b].find(id=>s.characters[id].sex==='女'),father=[a,b].find(id=>s.characters[id].sex==='男');if(!mother||!father)return 'Mock 生物学条件不满足';
 if([a,b].some(id=>age(s,s.characters[id])<s.config.birth_age_min)||age(s,s.characters[mother])>s.config.birth_age_max)return 'Mock 生育年龄条件不满足';
 if([a,b].some(id=>s.health[id].value<s.config.birth_health_min||s.characters[id].physiology.fertility_basis===0))return '健康或生育基础不满足';
 if(Object.values(s.reproduction).some(r=>r.status==='active'&&r.mother_id===mother))return '已有持续生育状态';
 if(!currentMarriage(s,a)?.people.includes(b))return '本轮 Mock 场景要求有效婚姻';
 return null;
}
export function startReproduction(s,a,b){const reason=reproductionConditions(s,a,b);if(reason)return {started:false,reason};const mother=[a,b].find(id=>s.characters[id].sex==='女'),father=[a,b].find(id=>s.characters[id].sex==='男');const key=id(s,'pregnancy');s.reproduction[key]={id:key,mother_id:mother,father_id:father,start_month:s.current_world_month,due_month:s.current_world_month+s.config.gestation_months,status:'active'};addLongTerm(s,mother,'pregnancy',{system:'reproduction',id:key},s.config.gestation_months,90,['减少外出']);return {started:true,id:key};}
export function updateReproduction(s){const results=[];for(const r of Object.values(s.reproduction)){if(r.status!=='active')continue;if(!s.characters[r.mother_id].alive){r.status='ended';continue;}if(s.current_world_month<r.due_month)continue;const mother=s.characters[r.mother_id];const child=createCharacter(s,{parents:[r.father_id,r.mother_id],household_id:mother.current_household_id,lineage_id:mother.lineage_id});r.status='completed';r.child_id=child.character_id;s.households[mother.current_household_id].responsibilities[mother.character_id]={type:'care',until:s.current_world_month+s.config.care_months,mandatory:false};addLongTerm(s,mother.character_id,'infant_care',null,s.config.care_months,90,['照护']);results.push({type:'birth',child_id:child.character_id,mother_id:r.mother_id,father_id:r.father_id});}return results;}
