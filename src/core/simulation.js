import {applyContent,FOCUS} from '../content/event_runtime.js';
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
import {backgroundCandidates,triggerBackground,decisionEvent,eventFor} from '../systems/events.js';
import {resolveDecision,chosen,preparePlayerDecision} from '../systems/behavior.js';
import {enroll,employ} from '../systems/education_career.js';
import {updateReproduction,startReproduction} from '../systems/reproduction.js';
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
function mentorFor(s,cid){const c=s.characters[cid];if(s.characters[c.mentor_character_id]?.alive)return c.mentor_character_id;const existing=Object.values(s.characters).find(x=>x.character_id!==cid&&x.alive&&age(s,x)>=18&&s.careers[x.character_id]?.status==='active');if(existing){c.mentor_character_id=existing.character_id;changeRelationship(s,cid,existing.character_id,0,'建立持续指导关系');return existing.character_id;}const hid=createHousehold(s,'指导者家庭'),mentor=createCharacter(s,{age_years:s.config.mentor_age,household_id:hid});employ(s,mentor.character_id,0);c.mentor_character_id=mentor.character_id;changeRelationship(s,cid,mentor.character_id,0,'建立持续指导关系');return mentor.character_id;}
export function executeDecision(s,cid,result){
 if(result.event.content_template)return applyContent(s,cid,result);
 const c=s.characters[cid],a=chosen(result),type=result.event.type,systems=[],changes=[];
 if(!a||a.action_type==='transition_action')throw Error('只有终局行为可以写回结果');
 if(a.resource_cost&&!spend(s,cid,a.resource_cost))throw Error('可行性与执行资源不一致');
 const effect=a.effects?.[0];if(['learning','education','career'].includes(effect))result.mentor_character_id=mentorFor(s,cid);
 if(effect==='career'||effect==='relocation'){employ(s,cid,result.event.career_index||0);systems.push('careers');changes.push('已进入新的职业安排');if(effect==='relocation'){startAway(s,cid);changes.push('进入外地生活；重新计算家庭责任、外地收入与生活支出');systems.push('long_term_states','households','resources');}}
 if(effect==='education'){enroll(s,cid,1);systems.push('education','long_term_states');changes.push('建立长期教育状态，之后按月学习');}
 if(effect==='learning'){const key=addLongTerm(s,cid,'short_trial',null,s.config.trial_months,75,['短期试学']);Object.assign(s.long_term_states[key],{time_cost:a.action_id==='partial'?s.config.trial_time/2:s.config.trial_time,skill:s.world_id==='ancient'?'手工':'音乐'});systems.push('long_term_states');changes.push('进入'+s.config.trial_months+'个月试学；之后按实际投入增长技能');}
 if(effect==='birth'){result.reproduction_result=startReproduction(s,cid,result.event.target_id);systems.push('reproduction');changes.push(result.reproduction_result.started?'建立孕育与照护安排':result.reproduction_result.reason);}
 if(['return','extend','settle','change_path'].includes(effect)){
  const t=s.long_term_states[result.event.long_term_id]||lifeContext(s,cid).terms.find(t=>t.type==='away_from_home_assignment');
  if(!t)throw Error('找不到需处理的离乡安排');
  if(effect==='extend'){t.start_month=s.current_world_month;t.due_decision=false;changes.push('延长外地安排'+t.expected_duration+'个月');}
  else if(effect==='settle'){t.status='ended';const k=addLongTerm(s,cid,'local_settlement',null,null,85,['当地工作','远程家庭联系']);s.long_term_states[k].location_context=clone(t.location_context);changes.push('转为当地长期生活');}
  else{t.status='ended';if(effect==='change_path'){if(s.careers[cid])s.careers[cid].status='ended';changes.push('结束原工作，返回家乡寻找新道路');}else{employ(s,cid,2);changes.push('返回家乡，转入家乡工作');}}
  systems.push('long_term_states','careers');
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
  if(effect==='distance'){if(lifeContext(s,cid).care_time)reassignCare(s,cid);addLongTerm(s,cid,'temporary_distance',null,s.config.temporary_distance_months,75,['减少共同活动']);}
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
export function month(s){
 if(pendingDecision(s))throw Error('需要你的决定：时间已暂停');
 const controlled=s.control.current_control_character_id;s.current_world_month++;
 const active=Object.values(s.characters).filter(c=>c.alive&&c.active_simulation),reports=[],work={};updateLongTerms(s);
 for(const c of active){
  const cid=c.character_id,before=snapshot(s,cid),goal=assignGoal(s,c);
  if(updateHealth(s,c)){const death=die(s,cid,'MOCK_TUNABLE 健康过程确认死亡');reports.push({character_id:cid,before,after:snapshot(s,cid),death,important:true});continue;}
  const defaults=defaultBehaviors(s,cid);executeDefaults(s,cid,defaults);work[cid]=defaults.work_fraction;
  const developments=updateSituations(s,cid,defaults),candidates=backgroundCandidates(s,cid),background=triggerBackground(s,cid,candidates);
  reports.push({character_id:cid,before,defaults,developments,background_candidates:candidates,background,goal_generated:goal});
 }
 const resource_changes=settleResources(s,work);
 for(const r of reports){if(r.death)continue;if(r.background?.content_pending){const gate=needsPlayer(s,r.character_id,r.background.event);if(gate)r.player_opportunity={event:r.background.event,waiting:gate===true};else r.background.decision=autonomous(s,r.character_id,r.background.event);delete r.background.content_pending;}const event=decisionEvent(s,r.character_id,r.defaults);
  if(event){const gate=needsPlayer(s,r.character_id,event);if(gate){r.player_opportunity={event,waiting:gate===true};}
   else if(event.type==='marriage'){r.arrangement=marriage(s,r.character_id,event.target_id,'autonomous');r.decision=r.arrangement.child;r.systems=r.arrangement.systems;}
   else{r.decision=autonomous(s,r.character_id,event);r.systems=r.decision.systems;}}
  r.important=!!(r.decision||r.player_opportunity?.waiting||r.goal_generated||r.developments.some(x=>x.kind!=='unchanged'));
 }
 const births=updateReproduction(s).map(b=>({...b,newborn:snapshot(s,b.child_id)}));updateLongTerms(s);
 for(const r of reports){r.after=auditSnapshot(snapshot(s,r.character_id),s.current_world_month);r.before=auditSnapshot(r.before,s.current_world_month);r.diff=diff(r.before,r.after);}
 const log={kind:'month',month:s.current_world_month,control_character_id:controlled,reports,resource_changes,births,rng_state:s.rng_state};s.history.push(log);return log;
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
 if(e.type==='away_review'){const event=e.payload.event||eventFor(s,'away_review');result.decision=option.id==='return_offer'?playerExecute(s,cid,event,'return'):autonomous(s,cid,event);return result;}
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
 case 'death':result=die(s,cid);break;
 case 'succession':selectSuccessor(s,cmd.target_id);result={type:'succession',selected:cmd.target_id};break;
 case 'inheritance':result=inheritEstate(s,cmd.deceased_id,cmd.target_id);break;
 case 'wish':fulfillWish(s,cid);result={type:'wish',credits:s.player.force_credits};break;
 case 'enroll':enroll(s,cid,cmd.index||0);result={type:'education_started'};break;
 case 'employ':employ(s,cid,cmd.index||0);result={type:'career_started'};break;
 default:throw Error('未知测试命令');
 }
 if(cmd.type==='player_choice'){const arrangement=result.arrangement,decision=arrangement?.child||result.decision?.recipient_decision||result.decision;result.decision_reasons=decision?.decision_reasons||waiting?.payload?.reasons||[];result.character_choice=decision?.event?.decision_owner==='player'?null:decision?.character_response||decision?.chosen_action||waiting?.payload?.previous?.child?.chosen_action||waiting?.payload?.previous?.chosen_action||null;result.final_outcome=result.final_outcome||(arrangement?arrangement.final_outcome||({married:'双方接受，婚姻已成立',refused:'本人拒绝，婚姻未成立',other_refused:'对方拒绝，婚姻未成立',delayed:'议亲继续，尚未建立婚姻',blocked:'现实条件不满足，婚姻未成立',force_failed:'强制未执行'}[arrangement.status]||arrangement.status):result.decision?.content_result?.outcome||decision?.actual_changes?.join('；')||result.immediate_effect);}
 const after=cid?snapshot(s,cid):null,entry={kind:cmd.type,month:s.current_world_month,character_id:cid,before,after,result:clone(result),diff:diff(before,after),important:true};s.history.push(entry);return entry;
}
