import {clone,snapshot,diff,age,auditSnapshot} from './state.js';
import {random,bound} from './rng.js';
import {assignGoal} from '../systems/character_generation.js';
import {updateHealth} from '../systems/health.js';
import {die} from '../systems/death.js';
import {defaultBehaviors,executeDefaults} from '../systems/default_behavior.js';
import {settleResources,spend} from '../systems/resources.js';
import {updateLongTerms,addLongTerm} from '../systems/long_term_state.js';
import {backgroundCandidates,triggerBackground,decisionEvent,eventFor} from '../systems/events.js';
import {decide,chosen} from '../systems/behavior.js';
import {enroll,employ,learn} from '../systems/education_career.js';
import {updateReproduction,startReproduction} from '../systems/reproduction.js';
import {arrangeMarriage} from '../systems/marriage.js';
import {changeRelationship} from '../systems/relationships.js';
import {applyForce,fulfillWish} from '../systems/player_intent.js';
import {selectSuccessor,inheritEstate} from '../systems/succession_inheritance.js';
export function executeDecision(s,cid,result){const c=s.characters[cid],a=chosen(result),type=result.event.type;const systems=[];if(!a)return systems;
 if(a.resource_cost&&!spend(s,cid,a.resource_cost))throw Error('可行性与执行资源不一致');
 if(a.action_tags.includes('participate')){
 if(type==='career'||type==='relocation'){employ(s,cid);if(type==='relocation')addLongTerm(s,cid,'away_for_work',null,s.config.relocation_months,85,['异地工作']);systems.push('careers','long_term_states');}
 if(type==='learning'){learn(s,cid,s.world_id==='ancient'?'手工':'音乐',s.config.skill_growth);systems.push('characters');}
 if(type==='birth'&&a.action_id==='commit_terms'){const r=startReproduction(s,cid,result.event.target_id);result.reproduction_result=r;systems.push('reproduction');}
 }
 if(type==='health'){s.health[cid].value=bound(s.health[cid].value+s.config.treatment_gain);systems.push('health');}
 if(type==='conflict'){c.dynamic.stress=bound(c.dynamic.stress-s.config.decision_stress_relief);if(!s.careers[cid]&&age(s,c)>=18&&a.action_tags.includes('participate')){employ(s,cid,2);systems.push('careers');}systems.push('characters');}
 if(type==='strain'){const change=a.action_id==='discuss'?s.config.background_delta:a.action_id==='distance'?-s.config.background_delta:1;changeRelationship(s,cid,result.event.target_id,change,'共同生活冲突后的自主回应');c.dynamic.stress=bound(c.dynamic.stress-s.config.decision_stress_relief);c.dynamic.mood=bound(c.dynamic.mood+change);if(a.action_id==='distance')addLongTerm(s,cid,'temporary_distance',null,s.config.temporary_distance_months,75,['减少共同活动']);systems.push('relationships','characters','long_term_states');}
 if(result.event.cost)systems.push('resources');c.experiences.push({month:s.current_world_month,type:'decision',event:result.event.title,action:a.action});return [...new Set(systems)];
}
export function month(s){
 const controlled=s.control.current_control_character_id;
 s.current_world_month++;const active=Object.values(s.characters).filter(c=>c.alive&&c.active_simulation),reports=[],work={};
 updateLongTerms(s);
 for(const c of active){const cid=c.character_id,before=snapshot(s,cid),goal=assignGoal(s,c);if(updateHealth(s,c)){const death=die(s,cid,'MOCK_TUNABLE 健康过程确认死亡');reports.push({character_id:cid,before,after:snapshot(s,cid),death,important:true});continue;}
 const defaults=defaultBehaviors(s,cid);executeDefaults(s,cid,defaults);work[cid]=defaults.work_fraction;
 const candidates=backgroundCandidates(s,cid),background=triggerBackground(s,cid,candidates);
 reports.push({character_id:cid,before,defaults,background_candidates:candidates,background,goal_generated:goal});
 }
 const resource_changes=settleResources(s,work);
 for(const r of reports){if(r.death)continue;const c=s.characters[r.character_id],event=decisionEvent(s,r.character_id,r.defaults);if(event){if(event.type==='marriage'){r.arrangement=arrangeMarriage(s,r.character_id,event.target_id,'ordinary');r.decision=r.arrangement.child;r.systems=r.arrangement.systems;}else{r.decision=decide(s,r.character_id,event);r.systems=executeDecision(s,r.character_id,r.decision);}}
 r.important=!!(r.decision||r.goal_generated);r.after=snapshot(s,r.character_id);r.diff=diff(r.before,r.after);
 }
 const births=updateReproduction(s).map(b=>({...b,newborn:snapshot(s,b.child_id)}));updateLongTerms(s);
 for(const r of reports){r.after=snapshot(s,r.character_id);r.before=auditSnapshot(r.before,s.current_world_month);r.after=auditSnapshot(r.after,s.current_world_month);r.diff=diff(r.before,r.after);}
 const log={kind:'month',month:s.current_world_month,control_character_id:controlled,reports,resource_changes,births,rng_state:s.rng_state};
 s.history.push(log);return log;
}
export function command(s,cmd){
 const cid=cmd.character_id||s.control.current_control_character_id,before=cid?snapshot(s,cid):null;let result;
 if(['event','marriage','wish','enroll','employ'].includes(cmd.type)&&!s.characters[cid]?.alive)throw Error('需要存活的当前人物');
 switch(cmd.type){
 case 'month':return month(s);
 case 'event':{const event=eventFor(s,cmd.event_type,cmd.target_id);result=decide(s,cid,event,{intervention:cmd.intervention});
 if(cmd.intervention?.mode==='force'){result.force=applyForce(s,cid,result,cmd.intervention.action_id);if(result.force.executed){result.autonomous_action_id=result.chosen_action_id;result.chosen_action_id=result.force.action.action_id;result.chosen_action=result.force.action.action;}}
 result.systems=executeDecision(s,cid,result);break;}
 case 'marriage':result=arrangeMarriage(s,cid,cmd.target_id,cmd.mode,cmd.actor_id);break;
 case 'death':result=die(s,cid);break;
 case 'succession':selectSuccessor(s,cmd.target_id);result={type:'succession',selected:cmd.target_id};break;
 case 'inheritance':result=inheritEstate(s,cmd.deceased_id,cmd.target_id);break;
 case 'wish':fulfillWish(s,cid);result={type:'wish',credits:s.player.force_credits};break;
 case 'enroll':enroll(s,cid,cmd.index||0);result={type:'education_started'};break;
 case 'employ':employ(s,cid,cmd.index||0);result={type:'career_started'};break;
 default:throw Error('未知测试命令');
 }
 const after=cid?snapshot(s,cid):null,entry={kind:cmd.type,month:s.current_world_month,character_id:cid,before,after,result,diff:diff(before,after),important:true};s.history.push(entry);return entry;
}
