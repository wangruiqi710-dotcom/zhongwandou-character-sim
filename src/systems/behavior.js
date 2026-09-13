import {age} from '../core/state.js';
import {random} from '../core/rng.js';
import {available} from './resources.js';
import {reproductionConditions} from './reproduction.js';
export const engine=()=>globalThis.PeaDecision;
export function legacyPerson(s,cid){const c=s.characters[cid],keys=['extraversion','intuition','thinking','planning'],names=['外向性','直觉性','思考性','计划性'],tk=['intelligence','social','athletic','stress_resistance','curiosity'],tn=['智力','社交','运动','抗压','好奇心'];return {...c,age:age(s,c),gender:c.sex,simple_identity:s.world_id==='ancient'?(s.education[cid]?.status==='active'?'读书人':s.careers[cid]?.status==='active'?'工匠 / 学徒':'农户家庭成员'):s.education[cid]?.status==='active'?'学生':'工作',personality:Object.fromEntries(keys.map((k,i)=>[names[i],c.personality[k]])),talents:Object.fromEntries(tk.map((k,i)=>[tn[i],c.talents[k]]))};}
export function decide(s,cid,event,{noise=true,intervention=null,draw=null}={}){
 const e=engine(),c=s.characters[cid],p=legacyPerson(s,cid),cfg=s.config;
 const rel=Object.values(s.relationships).find(r=>r.people.includes(cid)&&r.people.includes(event.target_id));
 const context={...e.decisionContext(p,event,s.world_id),stress:c.dynamic.stress,relationship_attitude:rel?.attitude||0,severe_illness:s.health[cid].value<30,mandatory_family_care:!!s.households[c.current_household_id]?.responsibilities[cid]?.mandatory,
 resources:available(s,cid),education:s.education[cid]||null,career:s.careers[cid]||null,marriage:Object.values(s.marriages).find(m=>m.status==='active'&&m.people.includes(cid))||null,
 preferred_action:intervention?.mode==='ordinary'?intervention.action_id:null,
 v2:{stress_cap:cfg.stress_cap,relationship_cap:cfg.relationship_cap,ordinary_push:cfg.ordinary_push},
 mock_rules:{caps:{personality_dimension:cfg.personality_dimension,personality_total:cfg.personality_total,interest:cfg.interest_cap,goal:cfg.goal_cap,talent:cfg.talent_cap},jitter_scale:cfg.jitter_scale,temperature_scale:cfg.temperature_scale}};
 if(event.type==='birth')event={...event,hard_block:reproductionConditions(s,cid,event.target_id)};
 if(['music','learning'].includes(event.type)){
 const care=s.households[c.current_household_id]?.responsibilities[cid];
 const committed=(s.careers[cid]?.status==='active'?s.careers[cid].time:0)+(s.education[cid]?.status==='active'?s.education[cid].time:0)+(care?.until>s.current_world_month?s.config.care_time:0);
 context.time_available=Math.max(0,1-committed);
 }
 let generated=e.generateCandidateActions(event,context).map(a=>({...a,resource_cost:event.cost&&a.action_tags.includes('participate')?event.cost:0}));
 // System-specific feasibility is a hard filter ahead of the shared legacy filter.
 const denied=[],allowed=[];
 for(const a of generated){let reason=!c.alive?'人物已死亡':a.resource_cost>context.resources?'可支配资源与可用家庭支持不足':event.hard_block&&a.action_tags.includes('participate')?event.hard_block:null;if(reason)denied.push({...a,feasible:false,probability:0,probability_units:0,exclusion_reason:reason});else allowed.push(a);}
 const filtered=e.filterFeasibleActions(allowed,event,context);const actions=e.calculateActionProbabilities(p,event,filtered.actions,context,noise?()=>random(s):()=>.5).map(a=>({...a,probability_fraction:a.probability_units/1000}));
 const roll=draw===null?random(s):draw,chosen=e.sampleAction(actions,roll);
 return {event,context,probability_scale:'probability is percent; probability_fraction sums to 1',generated_actions:generated,excluded_actions:[...denied,...filtered.excluded],candidate_actions:actions,chosen_action:chosen.action,chosen_action_id:chosen.action_id,sampling:{seed:s.seed,draw:roll,method:'weighted_random'},intervention};
}
export const chosen=result=>result.candidate_actions.find(a=>a.action_id===result.chosen_action_id);
