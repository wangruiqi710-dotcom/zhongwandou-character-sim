import {age} from '../core/state.js';
import {id,integer} from '../core/rng.js';
import {createCharacter} from './character_generation.js';
import {createHousehold} from './household.js';
import {employ} from './education_career.js';
import {ensureSituation} from './ongoing_situations.js';
import {recordEvent} from './life_context.js';
import {available,spend} from './resources.js';
import {relationship,changeRelationship} from './relationships.js';
import {joinHousehold} from './household.js';
import {addLongTerm} from './long_term_state.js';
import {resolveDecision,chosen} from './behavior.js';
import {applyForce} from './player_intent.js';
export const currentMarriage=(s,cid)=>Object.values(s.marriages).find(m=>m.status==='active'&&m.people.includes(cid));
export function marriageHardConditions(s,a,b){
 if(!a||!b||a===b||!s.characters[a]?.alive||!s.characters[b]?.alive)return '双方必须是不同的存活人物';
 if([a,b].some(id=>age(s,s.characters[id])<s.config.marriage_min_age))return '未达到 Mock 婚配年龄';
 if([a,b].some(id=>s.health[id].value<s.config.marriage_health_min))return '健康不允许当前安排';
 if(currentMarriage(s,a)||currentMarriage(s,b))return '已有有效婚姻';
 const pa=s.characters[a].biological_parent_ids,pb=s.characters[b].biological_parent_ids;
 if(pa.includes(b)||pb.includes(a)||pa.some(id=>pb.includes(id)))return 'Mock 排除直接亲子与同父母婚配';
 if(available(s,a)<s.config.marriage_cost)return '必要资源不足';
 return null;
}
export function marriageCandidates(s,cid){return Object.values(s.characters).filter(c=>c.character_id!==cid&&c.alive).map(c=>({character_id:c.character_id,reason:marriageHardConditions(s,cid,c.character_id)}));}
export function establishMarriage(s,a,b,origin='autonomous'){
 const reason=marriageHardConditions(s,a,b);if(reason)throw Error(reason);
 if(!spend(s,a,s.config.marriage_cost))throw Error('资源发生变化，婚配暂缓');
 const mid=id(s,'marriage');s.marriages[mid]={id:mid,people:[a,b],status:'active',start_month:s.current_world_month,origin,history:[]};
 // MOCK_ONLY household placement: join proposer's existing household, no asset transfer.
 joinHousehold(s,b,s.characters[a].current_household_id);
 for(const cid of [a,b]){addLongTerm(s,cid,'marriage',{system:'marriages',id:mid},null,60,['共同生活']);s.characters[cid].marriage_id=mid;s.characters[cid].spouse_character_id=cid===a?b:a;s.characters[cid].experiences.push({month:s.current_world_month,type:'marriage',marriage_id:mid});}
 changeRelationship(s,a,b,2,'建立婚姻，关系不等于婚姻状态');return mid;
}
export function arrangeMarriage(s,cid,target,mode='ordinary',actor=null,previous=null){
 const hard=marriageHardConditions(s,cid,target);const event={type:'marriage',title:'家庭安排婚配',description:'家人推动双方正式议亲，商议结婚与长期家庭责任。',category:'婚配',goal_tags:['marriage'],tags:['family','long_term'],target_id:target,conditions:{contract_terms_known:true},cost:s.config.marriage_cost,hard_block:hard};
 if(!s.characters[target])return {status:'blocked',reason:hard};
 relationship(s,cid,target);
 const child=previous?.child||resolveDecision(s,cid,event,{intervention:{mode,action_id:'commit_terms'}});
 const otherEvent={...event,target_id:cid,cost:0,hard_block:hard};
 const other=previous?.other||resolveDecision(s,target,otherEvent);
 const familyActor=s.households[s.characters[target].current_household_id].members.find(id=>id!==target&&age(s,s.characters[id])>=18)||target;
 const family=previous?.family||resolveDecision(s,familyActor,{...otherEvent,title:'对方家庭议亲',target_id:cid,cost:0});
 const opposed=[other,family].some(r=>r.chosen_action_id==='decline_terms');
 const ready=[other,family].every(r=>!['defer_terms','check_terms'].includes(r.chosen_action_id));
 let force=null,status=hard?'blocked':opposed?'other_refused':!ready?'delayed':'child_response';
 if(!hard&&!opposed&&ready){
  if(mode==='force'){force=applyForce(s,cid,child,'commit_terms',actor||s.characters[cid].biological_parent_ids[0]);status=force.executed?'married':'force_failed';}
  else status=child.chosen_action_id==='commit_terms'?'married':child.chosen_action_id==='decline_terms'?'refused':'delayed';
 }
 let marriage_id=null;if(status==='married')marriage_id=establishMarriage(s,cid,target,mode);
 const negotiation=ensureSituation(s,'marriage_negotiation',[cid,target],['具体候选议亲']);negotiation.last_development_month=s.current_world_month;negotiation.development_history.push({month:s.current_world_month,kind:status,severity:negotiation.severity});negotiation.status=status==='delayed'?'active':status==='married'?'resolved':'paused';negotiation.next_review_month=s.current_world_month+s.config.event_cooldown;
 for(const [stage,response] of [['本人',child],['候选本人',other],['候选家庭',family]])s.marriage_proposal_history.push({initiator_character_id:cid,candidate_character_id:target,month:s.current_world_month,stage,result:response.chosen_action_id,reason_tags:[status,...event.goal_tags]});recordEvent(s,cid,'marriage');recordEvent(s,target,'marriage');
 return {kind:'marriage_arrangement',initiator_character_id:cid,candidate_character_id:target,family_actor_id:familyActor,status,reason:hard,stages:['家庭需求','候选筛选','指定重点对象','推动议亲','子女反应','对方反应','对方家庭反应','硬条件检查','安排执行'],child,other,family,force,marriage_id,systems:['relationships','marriages','households','resources','long_term_states','characters']};
}

export function ensureMarriageCandidates(s,cid){let candidates=marriageCandidates(s,cid).filter(x=>!x.reason&&s.characters[x.character_id].sex!==s.characters[cid].sex);while(candidates.length<s.config.marriage_candidate_count&&Object.values(s.characters).filter(c=>c.alive).length<s.config.contact_population_limit){const c=s.characters[cid];if(currentMarriage(s,cid)||age(s,c)<s.config.marriage_min_age||available(s,cid)<s.config.marriage_cost)break;const hid=createHousehold(s,'新接触的家庭'),person=createCharacter(s,{household_id:hid,age_years:Math.max(s.config.marriage_min_age,age(s,c)+integer(s,-s.config.contact_age_spread,s.config.contact_age_spread)),sex:c.sex==='女'?'男':'女'});s.resources.households[hid].household_resources=s.config.marriage_cost*2;employ(s,person.character_id,1);relationship(s,cid,person.character_id);candidates=marriageCandidates(s,cid).filter(x=>!x.reason&&s.characters[x.character_id].sex!==s.characters[cid].sex);}return candidates;}
