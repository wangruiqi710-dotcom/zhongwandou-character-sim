import {locationOf,activeLocationContext,moveLocation,locationDue,syncRemoteThreads,locationAllows} from '../systems/location_context.js';
import {remoteFollowups,importantRemote,ensureLocalContacts} from '../systems/remote_life.js';
import {fullSimulationIds,simplifiedDefaults,updateNPCMarriages,selectNPC,sameLocality} from '../systems/npc_world.js';
import {routineRelations,routineSummary} from '../systems/monthly_routine.js';
import {applyContent,applyRoutineContent,FOCUS} from '../content/event_runtime.js';
import {createCharacter} from '../systems/character_generation.js';
import {createHousehold} from '../systems/household.js';
import {clone,snapshot,diff,age,auditSnapshot} from './state.js';
import {bound} from './rng.js';
import {assignGoal} from '../systems/character_generation.js';
import {updateHealth} from '../systems/health.js';
import {die} from '../systems/death.js';
import {defaultBehaviors,executeDefaults} from '../systems/default_behavior.js';
import {settleResources,spend} from '../systems/resources.js';
import {updateLongTerms,addLongTerm} from '../systems/long_term_state.js';
import {backgroundCandidates,triggerBackground,specialEvents,eventFor} from '../systems/events.js';
import {resolveDecision,chosen,preparePlayerDecision} from '../systems/behavior.js';
import {enroll,employ} from '../systems/education_career.js';
import {updateReproduction,checkConception,monthlyConception} from '../systems/reproduction.js';
import {arrangeMarriage,ensureMarriageCandidates} from '../systems/marriage.js';
import {changeRelationship} from '../systems/relationships.js';
import {applyForce,fulfillWish} from '../systems/player_intent.js';
import {selectSuccessor,inheritEstate} from '../systems/succession_inheritance.js';
import {lifeContext,coResident,startAway,recordEvent} from '../systems/life_context.js';
import {updateSituations} from '../systems/ongoing_situations.js';
import {pendingDecision,queuePlayerEvent,needsPlayer,playerChoices,openPlayerWindow,inPlayerFamily} from '../systems/player_decisions.js';

export function reassignCare(s,cid){
 const c=s.characters[cid],h=s.households[c.current_household_id],care=h.responsibilities[cid];
 const replacement=h.members.find(x=>x!==cid&&s.characters[x].alive&&age(s,s.characters[x])>=18&&coResident(s,cid,x)&&!h.responsibilities[x]);
 if(care&&replacement){h.responsibilities[replacement]={...care,reassigned_from:cid};delete h.responsibilities[cid];return {from:cid,to:replacement};}
 if(s.careers[cid]?.status==='active'){s.careers[cid].time=Math.max(s.config.minimum_work_time,s.careers[cid].time-s.config.work_reduction_fraction);s.careers[cid].wage*=1-s.config.work_reduction_fraction;}
 return {reduced_work:true};
}
function mentorFor(s,cid){const c=s.characters[cid];if(s.characters[c.mentor_character_id]?.alive&&sameLocality(s,cid,c.mentor_character_id))return c.mentor_character_id;const skill=s.education[cid]?.skill||s.careers[cid]?.skill||(s.world_id==='ancient'?'手工':'编程'),pool=Object.values(s.characters).filter(x=>x.character_id!==cid&&x.alive&&age(s,x)>=25&&sameLocality(s,cid,x.character_id)&&(s.careers[x.character_id]?.skill===skill||x.skills.some(k=>k.name===skill&&k.level>=15))),existing=s.characters[selectNPC(s,cid,pool.map(x=>x.character_id),'mentor')];if(existing){c.mentor_character_id=existing.character_id;changeRelationship(s,cid,existing.character_id,0,'建立持续指导关系');return existing.character_id;}const hid=createHousehold(s,'指导者家庭',locationOf(s,cid).ref),mentor=createCharacter(s,{age_years:s.config.mentor_age,household_id:hid});employ(s,mentor.character_id,0);c.mentor_character_id=mentor.character_id;changeRelationship(s,cid,mentor.character_id,0,'建立持续指导关系');return mentor.character_id;}
export function executeDecision(s,cid,result){
 if(!locationAllows(s,cid,result.event))throw Error('无法执行：地点条件已经改变');
 if(result.event.content_template)return applyContent(s,cid,result);
 const c=s.characters[cid],a=chosen(result),type=result.event.type,systems=[],changes=[];
 if(!a||a.action_type==='transition_action')throw Error('只有终局行为可以写回结果');
 if(a.resource_cost&&!spend(s,cid,a.resource_cost))throw Error('可行性与执行资源不一致');
 const effect=a.effects?.[0];if(['learning','education','career'].includes(effect))result.mentor_character_id=mentorFor(s,cid);
 if(effect==='career'||effect==='relocation'){if(effect==='relocation')startAway(s,cid,result.event.destination||{});employ(s,cid,result.event.career_index||0);systems.push('careers');changes.push('已进入新的职业安排');if(effect==='relocation'){ensureLocalContacts(s,cid);changes.push('进入外地生活；重新计算家庭责任、外地收入与生活支出');systems.push('long_term_states','households','resources');}}
 if(effect==='education'){if(result.event.destination){startAway(s,cid,{purpose:'study',...result.event.destination});ensureLocalContacts(s,cid);}enroll(s,cid,1);if(result.event.destination)result.mentor_character_id=mentorFor(s,cid);systems.push('education','long_term_states');changes.push('建立长期教育状态，之后按月学习');}
 if(effect==='learning'){const key=addLongTerm(s,cid,'short_trial',null,s.config.trial_months,75,['短期试学']);Object.assign(s.long_term_states[key],{time_cost:a.action_id==='partial'?s.config.trial_time/2:s.config.trial_time,skill:s.world_id==='ancient'?'手工':'音乐'});systems.push('long_term_states');changes.push('进入'+s.config.trial_months+'个月试学；之后按实际投入增长技能');}
 if(effect==='birth'){result.reproduction_result=checkConception(s,cid,result.event.target_id);systems.push('reproduction');changes.push(result.reproduction_result.started?'确认怀孕，开始孕期安排':result.reproduction_result.capacity?.blocker||'已支持生育计划，本月尚未怀孕，后续继续按现实条件检查');}
 if(['return','extend','settle','change_path'].includes(effect)){
  if(!locationDue(s,cid))throw Error('地点安排尚未到期或已经完成去留决定');
  const old=locationOf(s,cid);for(const t of lifeContext(s,cid).terms.filter(t=>t.type==='away_from_home_assignment'))t.status='ended';
  if(effect==='return'){moveLocation(s,cid,{context:'home',purpose:'family',return_expected:false});employ(s,cid,2);changes.push('返回家庭驻地，重新建立当地日常安排');}
  if(effect==='extend'){startAway(s,cid,{context:old.context,purpose:old.purpose,duration:old.expected_duration||s.config.relocation_months,shared_context_ref:old.ref});changes.push('保持当前位置，续留一个安排期限');}
  if(effect==='settle'){moveLocation(s,cid,{context:old.context,purpose:'migration',duration:null,return_expected:false,shared_context_ref:old.ref});const k=addLongTerm(s,cid,'local_settlement',null,null,85,['在当前位置长期生活']);s.long_term_states[k].location_context_ref=old.ref;changes.push('在当前位置长期生活；家庭归属不自动改变');}
  if(effect==='change_path'){if(s.careers[cid])s.careers[cid].status='ended';startAway(s,cid,{context:'away',purpose:'migration'});changes.push('结束原工作，转到另一个生活上下文寻找新道路');}
  ensureLocalContacts(s,cid);systems.push('characters','remote_life_threads','long_term_states','careers');
 }
 if(effect==='treatment'||effect==='rest'){s.health[cid].value=bound(s.health[cid].value+s.config.treatment_gain);addLongTerm(s,cid,'health_recovery',null,s.config.adjustment_months,100,['减少外出']);changes.push('进入休养安排');systems.push('health','long_term_states');}
 if(['reduce_work','redistribute','seek_work'].includes(effect)){
  if(effect==='redistribute')result.responsibility_change=reassignCare(s,cid);
  if(effect==='reduce_work'&&s.careers[cid]){s.careers[cid].time=Math.max(s.config.minimum_work_time,s.careers[cid].time-s.config.work_reduction_fraction);s.careers[cid].wage*=1-s.config.work_reduction_fraction;}
  if(effect==='seek_work'&&age(s,c)>=18){employ(s,cid,2);if(s.education[cid]?.status==='active'){s.education[cid].time*=s.config.education_reduced_fraction;s.education[cid].funding_fraction=s.config.education_reduced_fraction;}}
  changes.push(effect==='seek_work'?'调整学习时间，进入可持续工作安排':effect==='redistribute'?'已重新安排照护与工作':'减少工作占用与工资收入');systems.push('careers','households','education');
 }
 if(type==='strain'&&effect){
  const delta=effect==='distance'?-s.config.background_delta:s.config.background_delta;
  if(result.event.target_id)changeRelationship(s,cid,result.event.target_id,delta,'共同生活冲突后的自主回应');
  c.dynamic.stress=bound(c.dynamic.stress-s.config.decision_stress_relief);
  if(effect==='distance'){if(lifeContext(s,cid).care_time)reassignCare(s,cid);startAway(s,cid,{context:'nearby',purpose:'family',duration:s.config.temporary_distance_months});}
  else if(effect==='discuss')reassignCare(s,cid);
  changes.push(effect==='distance'?'建立暂时减少共同活动的状态':'关系态度已更新，继续观察共同生活');systems.push('relationships','long_term_states','households');
 }
 if(effect==='music'){c.dynamic.mood=bound(c.dynamic.mood+s.config.background_delta);changes.push('参加音乐活动，心情发生变化');systems.push('characters');}
 if(effect==='safe_route'){addLongTerm(s,cid,'safe_route',null,s.config.event_cooldown,50,['采用安全路线']);changes.push('在消息有效期间采用安全路线');systems.push('long_term_states');}
 if(!changes.length)changes.push(a.outcome==='reject'?'本次明确拒绝，保留现有安排':a.outcome==='defer'?'本次暂缓；保留现有安排并记录冷却':'已采用安全的保底处理');
 const issue=s.ongoing_situations[result.event.situation_id];if(issue){issue.last_decision_month=s.current_world_month;issue.needs_decision=false;issue.development_history.push({month:s.current_world_month,kind:'decision',action:a.action,severity:issue.severity});}
 result.actual_changes=changes;result.systems=[...new Set(systems)];recordEvent(s,cid,type);
 c.experiences.push({month:s.current_world_month,type:'decision',event:result.event.title,action:a.action});return result.systems;
}
function autonomous(s,cid,event,options={}){
 const result=resolveDecision(s,cid,event,options.previous?{noise:false,draw:0}:options);if(options.previous){result.chosen_action_id=options.previous.chosen_action_id;result.chosen_action=options.previous.chosen_action;result.prior_refusal=clone(options.previous);result.stages=clone(options.previous.stages||[options.previous]);result.sampling.method='prior_refusal_revalidated';}
 if(options.intervention?.mode==='force'){result.force=applyForce(s,cid,result,options.intervention.action_id);if(!result.force.executed){result.actual_changes=['强制未执行：'+result.force.reason];result.systems=[];return result;}if(result.force.executed){result.autonomous_action_id=result.chosen_action_id;result.chosen_action_id=result.force.action.action_id;result.chosen_action=result.force.action.action;}}
 executeDecision(s,cid,result);
 if(chosen(result).outcome==='reject'&&inPlayerFamily(s,cid)&&['career','education','relocation','birth'].includes(event.type)&&options.intervention?.mode==='ordinary')queuePlayerEvent(s,'force',cid,{event,previous:result});
 return result;
}
function playerExecute(s,cid,event,action_id='commit_terms',force=false){
 const result=preparePlayerDecision(s,cid,event,action_id);
 if(result.player_conflict&&!force){queuePlayerEvent(s,'force',cid,{event,previous:result,action_id,reasons:result.decision_reasons});result.actual_changes=['等待玩家进一步决定：'+result.character_response];return result;}
 if(force&&!event.force_recipient){result.force=applyForce(s,cid,result,action_id);if(!result.force.executed){result.actual_changes=['无法执行：'+result.force.reason];return result;}result.chosen_action_id=action_id;result.chosen_action=result.force.action.action;result.character_response='当前安排强制执行；人物之后仍保留自主反应';}
 executeDecision(s,cid,result);const recipient=result.recipient_decision;if(recipient?.player_conflict&&!recipient.force?.executed){queuePlayerEvent(s,'force',cid,{event,previous:recipient,action_id,recipient_target:event.target_id,reasons:recipient.decision_reasons});result.actual_changes.push('人物存在明确强冲突，等待玩家进一步决定');}return result;
}
function marriage(s,cid,target,mode,previous=null){
 const r=arrangeMarriage(s,cid,target,mode,null,previous);
 if(r.status==='refused'&&inPlayerFamily(s,cid)&&mode!=='force')queuePlayerEvent(s,'force',cid,{marriage:true,target_id:target,previous:r,reasons:r.child.decision_reasons});
 return r;
}
// Remember ownership before death/succession can change the controlled household.
function deathAndRoute(s,cid,reason){const owned=inPlayerFamily(s,cid)||s.control.current_control_character_id===cid,result=die(s,cid,reason);if(owned&&s.inheritances[cid])s.inheritances[cid].player_family_decision=true;return result;}
function drainMonthQueue(s,log){
 while(s.month_queue?.items.length&&!pendingDecision(s)){
  const {cid,event}=s.month_queue.items.shift();if(!s.characters[cid]?.alive||!locationAllows(s,cid,event)){(log.location_skipped||(log.location_skipped=[])).push({cid,event:event.title,reason:'人物或参与者地点已改变'});continue;}
  let r=log.reports.find(r=>r.character_id===cid);if(!r){r={character_id:cid,before:snapshot(s,cid),defaults:defaultBehaviors(s,cid),developments:[],special_events:[]};log.reports.push(r);}
  const issue=s.ongoing_situations[event.situation_id];if(issue){issue.last_decision_month=s.current_world_month;issue.needs_decision=false;}const item={event},gate=needsPlayer(s,cid,event);(r.special_events||(r.special_events=[])).push(item);
  if(gate){item.waiting=gate===true;item.status=gate===true?'awaiting_player':'cooldown';r.player_opportunity={event,waiting:item.waiting};}
  else if(event.type==='marriage'){item.arrangement=marriage(s,cid,event.target_id,'autonomous');item.decision=item.arrangement.child;r.arrangement=item.arrangement;r.decision=item.decision;}
  else{item.decision=autonomous(s,cid,event);r.decision=item.decision;r.systems=item.decision.systems;}
  r.important=true;
 }
 updateLongTerms(s);log.remaining_events=s.month_queue?.items.length||0;
 for(const r of log.reports){r.after=auditSnapshot(snapshot(s,r.character_id),s.current_world_month);r.before=auditSnapshot(r.before,s.current_world_month);r.diff=diff(r.before,r.after);}
 log.rng_state=s.rng_state;
}
export function month(s){
 if(pendingDecision(s))throw Error('需要你的决定：时间已暂停');
 syncRemoteThreads(s);
 const controlled=s.control.current_control_character_id;
 if(s.month_queue?.items.length){const log={kind:'month',continuation:true,month:s.current_world_month,control_character_id:controlled,reports:[],resource_changes:[],births:[],notices:[]};drainMonthQueue(s,log);s.history.push(log);return log;}
 s.current_world_month++;const full=fullSimulationIds(s),active=Object.values(s.characters).filter(c=>c.alive&&c.active_simulation),reports=[],work={};updateLongTerms(s);
 for(const c of active){
  const cid=c.character_id,isFull=full.has(cid),before=isFull?snapshot(s,cid):null,goal=assignGoal(s,c);
  if(updateHealth(s,c)){const death=deathAndRoute(s,cid,'MOCK_TUNABLE 健康过程确认死亡');if(isFull)reports.push({character_id:cid,before,after:snapshot(s,cid),death,important:true});continue;}
  const defaults=isFull?defaultBehaviors(s,cid):simplifiedDefaults(s,cid);executeDefaults(s,cid,defaults);work[cid]=defaults.work_fraction;
  if(!isFull){if(s.remote_life_threads[c.remote_thread_id]?.status==='active')updateSituations(s,cid,defaults);continue;}
  const developments=updateSituations(s,cid,defaults),candidates=backgroundCandidates(s,cid),background=triggerBackground(s,cid,candidates);
  if(background?.content_pending){background.routine=applyRoutineContent(s,cid,background.event);delete background.content_pending;}
  reports.push({character_id:cid,before,defaults,developments,background_candidates:candidates,background,goal_generated:goal,special_events:[]});
 }
 const relations=routineRelations(s,full),resource_changes=settleResources(s,work),allBirths=updateReproduction(s),births=allBirths.filter(b=>full.has(b.mother_id)||full.has(b.father_id)).map(b=>({...b,newborn:snapshot(s,b.child_id)})),conceptions=monthlyConception(s),npc_updates=updateNPCMarriages(s,full);updateLongTerms(s);
 const remote_followups=remoteFollowups(s);
 const items=[],queuedIssues=new Set();for(const r of reports){if(r.death)continue;r.routine=routineSummary(s,r.character_id,r.defaults,r.before,relations,resource_changes);r.important=!!(r.goal_generated||r.developments.some(x=>x.kind!=='unchanged'));for(const event of specialEvents(s,r.character_id,r.defaults)){if(event.situation_id&&queuedIssues.has(event.situation_id))continue;if(event.situation_id)queuedIssues.add(event.situation_id);items.push({cid:r.character_id,event});}}
 for(const c of active.filter(c=>c.alive&&!full.has(c.character_id))){
  const cid=c.character_id,t=s.remote_life_threads[c.remote_thread_id];
  if(locationDue(s,cid))items.push({cid,event:eventFor(s,'away_review')});
  else if(importantRemote(s,cid)&&s.health[cid].value<30&&!(s.recent_history[cid]||[]).some(x=>x.type==='health'&&s.current_world_month-x.month<s.config.event_cooldown))items.push({cid,event:eventFor(s,'health')});
  else if(t?.status==='active'&&t.last_followup_month===s.current_world_month&&importantRemote(s,cid))for(const event of specialEvents(s,cid,defaultBehaviors(s,cid)))if(!event.situation_id||!queuedIssues.has(event.situation_id)){if(event.situation_id)queuedIssues.add(event.situation_id);items.push({cid,event:{...event,cross_location_event:true,remote_thread_id:t.remote_thread_id}});}
 }

 items.sort((a,b)=>Number(b.event.type==='health')-Number(a.event.type==='health'));s.month_queue={month:s.current_world_month,items};
 const notices=(s.life_notices||[]).filter(n=>n.month===s.current_world_month&&full.has(n.mother_id));
 const log={kind:'month',active_location_context:activeLocationContext(s),remote_followups,month:s.current_world_month,control_character_id:controlled,reports,resource_changes,births,conceptions:conceptions.filter(x=>full.has(x.notice?.mother_id)),notices,npc_updates,npc_birth_count:allBirths.length-births.length};
 drainMonthQueue(s,log);s.history.push(log);return log;
}
function playerResolve(s,cmd){
 const e=pendingDecision(s);if(!e||cmd.event_id!==e.id)throw Error('该玩家决定已结束或不是当前等待项');
 const option=playerChoices(s,e).find(x=>x.id===cmd.option_id);if(!option||!option.feasible)throw Error('无法执行：'+(option?.reason||'无效的玩家选择'));
 const cid=e.character_id,c=s.characters[cid],h=c&&s.resources.households[c.current_household_id];
 let result={player_event_id:e.id,player_event_type:e.type,player_choice:option.label,immediate_effect:option.impact};
 if(e.type==='succession'){selectSuccessor(s,option.id);return {...result,selected:option.id};}
 if(e.type==='inheritance')return {...result,inheritance:inheritEstate(s,e.payload.deceased_id,option.id)};
 e.status='resolved';e.choice=option.id;e.resolved_month=s.current_world_month;recordEvent(s,cid,e.type,'player_decision');
 if(e.type==='content'){if(option.id==='skip')return {...result,content_declined:true};const offered=clone(e.payload.event);const allocation=offered.mock_actions.find(a=>a.id===option.id)?.conditions.content_effects?.some(e=>['fundeducation','reduceeducation','reassign','care'].includes(e.kind));offered.decision_owner=allocation?'player':'character';offered.mock_actions=offered.mock_actions.filter(a=>a.id===option.id||!allocation&&(a.id==='leave_current'||a.conditions.action_type==='transition_action'));offered.player_authority=true;result.decision=playerExecute(s,cid,offered,option.id);return result;}
 if((e.type==='marriage'||e.payload.marriage)&&['skip','defer','reject','respect'].includes(option.id)){const target=e.payload.target_id||e.payload.event?.target_id;for(const issue of Object.values(s.ongoing_situations).filter(x=>x.type==='marriage_negotiation'&&['active','paused'].includes(x.status)&&x.participants.includes(cid)&&(!target||x.participants.includes(target)))){issue.status=['reject','respect'].includes(option.id)?'ended':'paused';issue.end_month=s.current_world_month;issue.needs_decision=false;issue.development_history.push({month:s.current_world_month,kind:issue.status,action:option.label,severity:issue.severity});}}
 if(option.id==='skip'){
  if(e.type==='resource')for(const x of Object.values(s.characters).filter(x=>x.current_household_id===c.current_household_id&&s.education[x.character_id]?.status==='active'))s.education[x.character_id].status='paused';
  return result;
 }
 if(['respect','defer','reject'].includes(option.id)){result.final_outcome=option.id==='defer'?'本次暂时搁置，未继续执行安排':option.id==='reject'?'本次家庭提议已拒绝，未执行婚配':'尊重本人拒绝，本次不执行安排';return result;}
 if(e.type==='force'){
  if(option.id==='persuade'){result.arrangement=marriage(s,cid,e.payload.target_id,'ordinary');return result;}
  if(option.id==='force'){if(e.payload.marriage)result.arrangement=marriage(s,cid,e.payload.target_id,'force',e.payload.previous);
   else{result.decision=playerExecute(s,cid,{...e.payload.event,force_recipient:!!e.payload.recipient_target},e.payload.action_id||'commit_terms',true);result.decision.prior_refusal=clone(e.payload.previous);}}
  return result;
 }
 if(e.type==='marriage'){if(e.payload.event?.content_template){const event={...clone(e.payload.event),target_id:option.target_id,decision_owner:'player'},action=event.mock_actions.find(a=>a.conditions.content_effects?.some(x=>x.kind==='marriage'));result.decision={event,chosen_action_id:action.id,chosen_action:option.label,candidate_actions:[]};applyContent(s,cid,result.decision,marriage);result.arrangement=result.decision.content_arrangement;}else result.arrangement=marriage(s,cid,option.target_id,'ordinary');return result;}
 if(e.type==='health'){
  if(option.id==='treat'){h.household_resources-=s.config.major_treatment_cost;s.health[cid].value=bound(s.health[cid].value+s.config.major_treatment_gain);}
  else{for(const group of ['education','careers'])if(s[group][cid]?.status==='active'){s[group][cid].time*=s.config.education_reduced_fraction;if(group==='careers')s[group][cid].wage*=s.config.education_reduced_fraction;}}
  addLongTerm(s,cid,'health_recovery',null,s.config.adjustment_months,100,['减少外出']);return result;
 }
 if(e.type==='care'||e.type==='conflict'){
  if(option.id==='redistribute')result.responsibility_change=reassignCare(s,cid);
  if(option.id==='reduce'&&s.careers[cid]){s.careers[cid].time=Math.max(s.config.minimum_work_time,s.careers[cid].time-s.config.work_reduction_fraction);s.careers[cid].wage*=1-s.config.work_reduction_fraction;}
  if(option.id==='work')result.decision=playerExecute(s,cid,{...eventFor(s,'career'),description:'寻找不需先交费用的基础工作机会。',cost:0,career_index:2});
  return result;
 }
 if(e.type==='away_review'){const event=e.payload.event||eventFor(s,'away_review');result.decision=option.id==='support'?autonomous(s,cid,event):playerExecute(s,cid,event,option.id==='return_offer'?'return':option.id);return result;}
 let target=cid,type=e.type;
 if(e.type==='resource'){
  for(const x of Object.values(s.characters).filter(x=>x.current_household_id===c.current_household_id&&s.education[x.character_id]?.status==='active')){s.education[x.character_id].time*=s.config.education_reduced_fraction;s.education[x.character_id].funding_fraction=s.config.education_reduced_fraction;}
  if(option.id==='share')return result;target=option.target_id;type='education';
 }
 const before=h.household_resources;h.household_resources-=s.config.opportunity_cost;
 const key=addLongTerm(s,target,'family_support',null,s.config.family_support_months,60,['家庭支持的机会']);s.long_term_states[key].investment=s.config.opportunity_cost;
 const event={...(e.type==='resource'?eventFor(s,type):e.payload.event||eventFor(s,type)),cost:0};result.decision=playerExecute(s,target,event);
 if(result.decision.player_conflict){
  h.household_resources=before;s.long_term_states[key].status='ended';result.immediate_effect+='；本人未接受，预留投入已退回家庭';
  const force=s.player_decision_events.find(x=>x.type==='force'&&x.status==='pending'&&x.character_id===target);if(force)force.payload.event.cost=s.config.opportunity_cost;
 }else result.resource_change={before,after:h.household_resources};
 return result;
}
export function command(s,cmd){
 if(pendingDecision(s)&&!['player_choice','succession','inheritance'].includes(cmd.type))throw Error('需要你的决定：先完成当前选择');
 const waiting=pendingDecision(s);const cid=cmd.character_id||(cmd.type==='player_choice'?(waiting?.character_id||waiting?.payload?.deceased_id):null)||s.control.current_control_character_id,before=cid?snapshot(s,cid):null;let result;
 if(['event','marriage','wish','enroll','employ','player_window'].includes(cmd.type)&&!s.characters[cid]?.alive)throw Error('需要存活人物');
 switch(cmd.type){
 case 'month':return month(s);
 case 'focus':if(!FOCUS.includes(cmd.value))throw Error('未知重点领域');s.test_focus_mode=cmd.value;result={focus:cmd.value};break;
 case 'player_choice':result=playerResolve(s,cmd);break;
 case 'player_window':if(cmd.direction==='marriage')ensureMarriageCandidates(s,cid);result=openPlayerWindow(s,cmd.direction,cid);break;
 case 'event':result=autonomous(s,cid,eventFor(s,cmd.event_type,cmd.target_id),{intervention:cmd.intervention});break;
 case 'marriage':result=marriage(s,cid,cmd.target_id,cmd.mode);break;
 case 'death':result=deathAndRoute(s,cid);break;
 case 'succession':selectSuccessor(s,cmd.target_id);result={type:'succession',selected:cmd.target_id};break;
 case 'inheritance':result=inheritEstate(s,cmd.deceased_id,cmd.target_id);break;
 case 'wish':fulfillWish(s,cid);result={type:'wish',credits:s.player.force_credits};break;
 case 'enroll':enroll(s,cid,cmd.index||0);result={type:'education_started'};break;
 case 'employ':employ(s,cid,cmd.index||0);result={type:'career_started'};break;
 default:throw Error('未知测试命令');
 }
 if(cmd.type==='player_choice'){const arrangement=result.arrangement,decision=arrangement?.child||result.decision?.recipient_decision||result.decision;result.decision_reasons=decision?.decision_reasons||waiting?.payload?.reasons||[];result.character_choice=decision?.event?.decision_owner==='player'?null:decision?.character_response||decision?.chosen_action||waiting?.payload?.previous?.child?.chosen_action||waiting?.payload?.previous?.chosen_action||null;result.final_outcome=result.final_outcome||(arrangement?arrangement.final_outcome||({married:'双方接受，婚姻已成立',refused:'本人拒绝，婚姻未成立',other_refused:'对方拒绝，婚姻未成立',delayed:'议亲继续，尚未建立婚姻',blocked:'现实条件不满足，婚姻未成立',force_failed:'强制未执行'}[arrangement.status]||arrangement.status):result.decision?.content_result?.outcome||decision?.actual_changes?.join('；')||result.immediate_effect);}
 syncRemoteThreads(s);if(['succession','player_choice'].includes(cmd.type)&&s.control.current_control_character_id)ensureLocalContacts(s,s.control.current_control_character_id);
 if(result)result.remote_followups=remoteFollowups(s);
 const after=cid?snapshot(s,cid):null,entry={kind:cmd.type,month:s.current_world_month,character_id:cid,before,after,result:clone(result),diff:diff(before,after),important:true};s.history.push(entry);return entry;
}
