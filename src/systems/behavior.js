import {locationAllows} from './location_context.js';
import {riskPreference} from './risk_preference.js';
import {DATASETS} from '../config/worlds.js';
import {withReasonSupport,majorDecision} from './decision_reasons.js';
import {contentFeasibility} from '../content/event_runtime.js';
import {lifeContext,coResident} from './life_context.js';
import {completeEvent} from './action_catalog.js';
import {age} from '../core/state.js';
import {random} from '../core/rng.js';
import {available} from './resources.js';
import {reproductionConditions} from './reproduction.js';
export const engine=()=>globalThis.PeaDecision;
export function legacyPerson(s,cid){const c=s.characters[cid],keys=['extraversion','intuition','thinking','planning'],names=['外向性','直觉性','思考性','计划性'],tk=['intelligence','social','athletic','stress_resistance','curiosity'],tn=['智力','社交','运动','抗压','好奇心'];return {...c,age:age(s,c),gender:c.sex,simple_identity:s.world_id==='ancient'?(s.education[cid]?.status==='active'?'读书人':s.careers[cid]?.status==='active'?'工匠 / 学徒':'农户家庭成员'):s.education[cid]?.status==='active'?'学生':'工作',personality:Object.fromEntries(keys.map((k,i)=>[names[i],c.personality[k]])),talents:Object.fromEntries(tk.map((k,i)=>[tn[i],c.talents[k]]))};}
export function decide(s,cid,event,{noise=true,intervention=null,draw=null,direct_action=null}={}){
 if(!locationAllows(s,cid,event))throw Error('无法执行：人物或参与者不在事件要求的地点');
 const lc=lifeContext(s,cid);const e=engine(),c=s.characters[cid],p=legacyPerson(s,cid),cfg=s.config;
 const rel=Object.values(s.relationships).find(r=>r.people.includes(cid)&&r.people.includes(event.target_id));
 const context={...e.decisionContext(p,event,s.world_id),stress:c.dynamic.stress,relationship_attitude:rel?.attitude||0,severe_illness:s.health[cid].value<30,mandatory_family_care:!!s.households[c.current_household_id]?.responsibilities[cid]?.mandatory,
 life_context:lc,resources:available(s,cid),education:s.education[cid]||null,career:s.careers[cid]||null,marriage:Object.values(s.marriages).find(m=>m.status==='active'&&m.people.includes(cid))||null,
 preferred_action:intervention?.mode==='ordinary'?intervention.action_id:null,
 v2:{stress_cap:cfg.stress_cap,relationship_cap:cfg.relationship_cap,ordinary_push:cfg.ordinary_push},
 mock_rules:{caps:{personality_dimension:cfg.personality_dimension,personality_total:cfg.personality_total,interest:cfg.interest_cap,goal:cfg.goal_cap,talent:cfg.talent_cap},jitter_scale:cfg.jitter_scale,temperature_scale:cfg.temperature_scale}};
 if(event.type==='birth')event={...event,hard_block:reproductionConditions(s,cid,event.target_id)};
 if(['music','learning'].includes(event.type)){
 const care=lc.co_resident?s.households[c.current_household_id]?.responsibilities[cid]:null;
 const committed=(s.careers[cid]?.status==='active'?s.careers[cid].time:0)+(s.education[cid]?.status==='active'?s.education[cid].time:0)+(care?.until>s.current_world_month?s.config.care_time:0);
 context.time_available=Math.max(0,1-committed);
 }
 let generated=e.generateCandidateActions(event,context).map(a=>({...a,resource_cost:event.cost&&a.action_tags.includes('participate')?event.cost:0}));
 // System-specific feasibility is a hard filter ahead of the shared legacy filter.
 const denied=[],allowed=[];
 for(const a of generated){const incoming=a.outcome==='accept'&&(event.type==='education'?DATASETS[s.world_id].education[1].time:['career','relocation'].includes(event.type)?DATASETS[s.world_id].careers[event.career_index||0].time:0),otherTime=event.type==='education'?lc.career_time+lc.care_time:event.type==='career'?lc.education_time+lc.care_time:event.type==='relocation'?lc.education_time:0;let reason=event.available===false||event.expires_month!==undefined&&event.expires_month<s.current_world_month?'该机会已经不存在或已经过期':incoming&&incoming+otherTime>1?'现有职责与新安排超过可用时间':event.content_template?contentFeasibility(s,cid,event,a):['education','learning'].includes(event.type)&&a.action_tags.includes('participate')&&age(s,c)<cfg.education_min_age?'未达到 Mock 学习年龄':(event.type==='relocation'&&a.action_id==='commit_terms'||event.type==='strain'&&a.action_id==='distance')&&lc.care_time>0&&!s.households[c.current_household_id].members.some(x=>x!==cid&&s.characters[x].alive&&age(s,s.characters[x])>=18&&coResident(s,cid,x)&&!s.households[c.current_household_id].responsibilities[x])?'离乡照护无人接替':event.type==='conflict'&&a.action_id==='redistribute'&&!s.households[c.current_household_id].members.some(x=>x!==cid&&s.characters[x].alive&&age(s,s.characters[x])>=18&&coResident(s,cid,x)&&!s.households[c.current_household_id].responsibilities[x])?'没有可接替照护的同住成年人':!c.alive?'人物已死亡':a.resource_cost>context.resources?'可支配资源与可用家庭支持不足':event.hard_block&&a.action_tags.includes('participate')?event.hard_block:majorDecision(event)&&!(event.type==='away_review'&&['extend','settle'].includes(a.action_id))&&!['marriage','birth'].includes(event.type)&&event.response_role!=='candidate_family'&&a.outcome==='accept'&&s.health[cid].value<30?'当前健康无法承担这项长期安排':null;if(reason)denied.push({...a,feasible:false,probability:0,probability_units:0,exclusion_reason:reason});else allowed.push(a);}
 const filtered=e.filterFeasibleActions(allowed,event,context);filtered.actions=withReasonSupport(s,cid,event,filtered.actions,[...denied,...filtered.excluded]);filtered.actions=riskPreference(s,cid,event,filtered.actions);if(event.match_evidence){const m=event.match_evidence;filtered.actions=filtered.actions.map(a=>{const negative=["reject","defer"].includes(a.outcome),support=negative?m.obstacles:m.support,opposition=negative?m.support:m.obstacles;const base=m.obstacles.length&&negative?a.base_weight/a.reason_weight_multiplier:a.base_weight;return {...a,supporting_reasons:[...a.supporting_reasons,...support],opposing_reasons:[...a.opposing_reasons,...opposition],reason_support:a.reason_support+support.length,base_weight:base*Math.exp(Math.max(-1.2,Math.min(1.2,(m.support.length*.15-m.obstacles.length*.7)*s.config.marriage_match_weight*(negative?-1:1))))};});}const actions=e.calculateActionProbabilities(p,event,filtered.actions,context,noise?()=>random(s):()=>.5).map(a=>({...a,probability_fraction:a.probability_units/1000}));
 const roll=direct_action?null:draw===null?random(s):draw,chosen=direct_action?actions.find(a=>a.action_id===direct_action):e.sampleAction(actions,roll);if(!chosen)throw Error('无法执行：'+([...denied,...filtered.excluded].find(a=>a.action_id===direct_action)?.exclusion_reason||'当前机会中没有该可行安排'));
 const decision_reasons=chosen.supporting_reasons?.length?chosen.supporting_reasons:[{actor_id:cid,code:'low_probability_deviation',reason:'没有明确反对理由，本次为低概率偏离，未据此生成强烈冲突',strong:false}];
 return {actor_id:cid,event:structuredClone(event),context:structuredClone(context),probability_scale:'probability is percent; probability_fraction sums to 1',generated_actions:generated,excluded_actions:[...denied,...filtered.excluded],candidate_actions:actions,chosen_action:chosen.action,chosen_action_id:chosen.action_id,decision_reasons,sampling:{seed:s.seed,draw:roll,method:direct_action?'player_direct':'weighted_random'},intervention};
}
export const chosen=result=>result.candidate_actions.find(a=>a.action_id===result.chosen_action_id);

export function resolveDecision(s,cid,event,options={}){
 let current=completeEvent(s,event),stages=[],result;for(let n=0;n<s.config.decision_stage_limit;n++){result=decide(s,cid,current,options);stages.push(result);const action=chosen(result);if(action.action_type!=='transition_action')break;current=completeEvent(s,{...current,stage:current.stage+1,context_facts:{...current.context_facts,information_acquired:true},conditions:{...current.conditions,contract_terms_known:true,information_verified:true}});}
 if(chosen(result).action_type==='transition_action')throw Error('决策阶段超过限制，未执行半成品结果');
 return {...result,stages:stages.map(r=>({...r})),terminal:true,result_effects:chosen(result).effects||[],facts:current.context_facts};
}

// No draw is made for a player's granted authority. Force reuses the same feasible candidate.
export function preparePlayerDecision(s,cid,event,action_id='commit_terms'){
 const r=resolveDecision(s,cid,event,{noise:false,direct_action:action_id}),a=chosen(r);r.player_direct=true;
 if(a.outcome==='accept'&&a.strong_conflicts?.length){r.player_conflict=true;r.decision_reasons=a.strong_conflicts;r.character_response='因明确冲突反对：'+r.decision_reasons.map(x=>x.reason).join('；');const no=r.candidate_actions.find(x=>x.outcome==='reject');if(no){r.chosen_action_id=no.action_id;r.chosen_action=no.action;}}
 else{r.decision_reasons=[{actor_id:cid,code:'player_authority',reason:'玩家已决定提供这项安排，现实条件允许，人物没有明确强烈冲突',strong:false}];r.character_response='没有强烈反对，接受本次安排';}
 return r;
}
