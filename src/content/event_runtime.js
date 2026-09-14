import {resolveDecision,chosen} from '../systems/behavior.js';
import {eventFor} from '../systems/events.js';
import {ANCIENT_EVENTS,CONTENT_TUNABLES as CFG} from './ancient_events.js';
import {age,snapshot,clone,auditSnapshot} from '../core/state.js';
import {random,pick,bound} from '../core/rng.js';
import {lifeContext,coResident,startAway,recordEvent} from '../systems/life_context.js';
import {changeRelationship} from '../systems/relationships.js';
import {addLongTerm} from '../systems/long_term_state.js';
import {ensureSituation} from '../systems/ongoing_situations.js';
import {learn,enroll,employ} from '../systems/education_career.js';
import {currentMarriage,marriageCandidates,arrangeMarriage} from '../systems/marriage.js';
import {reproductionConditions,startReproduction} from '../systems/reproduction.js';
const active=x=>x?.status==='active';
const names=(s,id)=>{const c=s.characters[id];return c.surname+c.given_name;};
export function contentImpact(action){
 const labels={household:'家庭资源',personal:'个人备用钱',transfer:'个人转入家用',targethealth:'相关人物健康',health:'本人健康',relation:'关系',stress:'压力',mood:'心情',fatigue:'疲劳',fundeducation:'集中教育支持',reduceeducation:'降低额外教育投入',education:'开始教育',targeteducation:'为相关人物提供教育机会',career:'开始工作',targetcareer:'为相关人物提供职业机会',relocation:'开始离乡安排',care:'承担长期照护',reducework:'降低工作时间和收入',reassign:'交接照护',marriage:'进入双方正式议亲',birth:'尝试孕育',distance:'暂时减少共同生活',trial:'短期学习',skill:'技能练习',targetskill:'相关人物学习',wage:'工资倍率'};
 return '提供此项安排；预计立即影响：'+(action.conditions.content_effects||[]).map(e=>(labels[e.kind]||e.kind)+(e.skill?'（'+e.skill+'）':'')+(['household','personal','transfer'].includes(e.kind)?' '+(e.value>0?'+':'')+e.value:'')).join('、')+'。机会接收者仍可拒绝；收益和学习可能不如预期。';
}
export function contentContext(s,cid){
 const c=s.characters[cid],lc=lifeContext(s,cid),kin=s.households[c.current_household_id].members.filter(id=>id!==cid&&s.characters[id].alive),people=Object.values(s.characters).filter(x=>x.alive&&x.character_id!==cid),parents=c.biological_parent_ids.filter(id=>s.characters[id]?.alive),children=people.filter(x=>x.biological_parent_ids.includes(cid)),spouse=currentMarriage(s,cid)?.people.find(id=>id!==cid),relations=Object.values(s.relationships).filter(r=>r.people.includes(cid)),known=relations.map(r=>r.people.find(id=>id!==cid)).filter(id=>s.characters[id]?.alive);
 const sibling=kin.filter(id=>s.characters[id].biological_parent_ids.some(p=>parents.includes(p)));
 const roles={none:[null],family:kin.filter(id=>coResident(s,cid,id)),parent:parents,sibling,child:children.filter(x=>age(s,x)>=3&&age(s,x)<18).map(x=>x.character_id),adultkin:kin.filter(id=>age(s,s.characters[id])>=18),elder:kin.filter(id=>age(s,s.characters[id])>=55),spouse:spouse?[spouse]:[],mentor:s.characters[c.mentor_character_id]?.alive?[c.mentor_character_id]:people.filter(x=>age(s,x)>=25&&active(s.careers[x.character_id])).map(x=>x.character_id),peer:people.filter(x=>active(s.careers[x.character_id])&&age(s,x)>=16).map(x=>x.character_id),neighbor:people.filter(x=>!kin.includes(x.character_id)&&!lifeContext(s,x.character_id).away).map(x=>x.character_id),friend:known.filter(id=>!parents.includes(id)&&id!==spouse),sick:kin.filter(id=>s.health[id].value<80),candidate:marriageCandidates(s,cid).filter(x=>!x.reason).map(x=>x.character_id)};
 const funds=s.resources.households[c.current_household_id].household_resources,terms=lc.terms,skill=Math.max(0,...c.skills.map(k=>k.level));
 const conditions={any:true,youth:age(s,c)<25,adult:age(s,c)>=18,elder:age(s,c)>=55,learner:active(s.education[cid])||terms.some(t=>t.type==='short_trial'),apprentice:s.education[cid]?.id==='training'&&active(s.education[cid])||s.careers[cid]?.id==='workshop'&&active(s.careers[cid]),trained:skill>=12,student:active(s.education[cid]),worker:active(s.careers[cid]),craft:active(s.careers[cid])&&s.careers[cid].id==='workshop',merchant:active(s.careers[cid])&&s.careers[cid].id==='service',farmer:active(s.careers[cid])&&s.careers[cid].id==='craft',unemployed:age(s,c)>=16&&!active(s.careers[cid]),away:!!lc.away,poor:funds<150,funded:funds>=150,students:kin.filter(id=>active(s.education[id])).length+(active(s.education[cid])?1:0)>=2,carer:lc.care_time>0,stressed:c.dynamic.stress>=40,tense:relations.some(r=>r.attitude<10),parent:children.length>0,schoolchild:children.some(x=>active(s.education[x.character_id])),married:!!spouse,single:!spouse&&age(s,c)>=18,negotiating:lc.situations.some(x=>x.type==='marriage_negotiation'),refused:s.marriage_proposal_history.some(p=>(p.initiator_character_id===cid||p.candidate_character_id===cid)&&p.status!=='married'),strained:!!spouse&&relations.some(r=>r.people.includes(spouse)&&r.attitude<0),infant:children.some(x=>age(s,x)<3),fertile:!!spouse&&!reproductionConditions(s,cid,spouse),sickkin:roles.sick.length>0,seriouskin:roles.sick.some(id=>s.health[id].value<45),recoveringkin:roles.sick.some(id=>Object.values(s.long_term_states).some(t=>t.character_id===id&&active(t)&&t.type==='health_recovery')),tired:c.dynamic.fatigue>=35,sickself:s.health[cid].value<75};
 return {c,lc,roles,conditions,funds,skill,age:age(s,c),stage:age(s,c)<12?'儿童':age(s,c)<18?'青少年':age(s,c)<30?'青年':age(s,c)<45?'成年':age(s,c)<60?'中年':'老年'};
}
export function eligibleContent(s,cid,t,ctx=contentContext(s,cid)){
 if(s.world_id!=='ancient'||!ctx.c.alive||ctx.age<t.trigger_conditions.min_age||!ctx.conditions[t.trigger_conditions.condition]||!ctx.roles[t.participant_requirements.role]?.length)return false;
 const past=ctx.c.experiences.filter(x=>x.event_id===t.event_id);
 if(past.length>=t.repeat_rules.maximum||past.length&&s.current_world_month-past.at(-1).month<t.cooldown)return false;
 if(ctx.age>=55&&['education','firstwork','apprentice'].includes(t.theme))return false;
 if(ctx.lc.away&&!['away','skill','network','setback','growth','firstwork'].includes(t.theme))return false;
 if(t.trigger_conditions.history_or_state&&!ctx.c.experiences.some(x=>x.theme===t.theme)&&!ctx.lc.terms.some(x=>x.content_theme===t.theme)&&!ctx.lc.situations.some(x=>x.content_theme===t.theme)&&!['trained','apprentice','student','away','carer','married','strained','infant','schoolchild','seriouskin','students','merchant'].includes(t.trigger_conditions.condition))return false;
 return true;
}
export function pickContent(s,cid,daily=false){
 if(s.world_id!=='ancient')return null;
 const ctx=contentContext(s,cid),pool=ANCIENT_EVENTS.filter(t=>(t.importance==='daily')===daily&&eligibleContent(s,cid,t,ctx));
 if(!pool.length)return null;
 const focus=s.test_focus_mode||'正常人生',weights=pool.map(t=>(focus!=='正常人生'&&focusMatches(t,focus)?CFG.focus_multiplier:1)*(ctx.lc.terms.some(x=>x.content_theme===t.theme)?CFG.continuity_multiplier:1)*(1+CFG.interest_opportunity_multiplier*Math.max(0,...ctx.c.interests.filter(i=>t.interest_examples.includes(i.name)).map(i=>i.intensity/100)))),total=weights.reduce((a,b)=>a+b,0);let roll=random(s)*total,chosen=pool.at(-1);for(let i=0;i<pool.length;i++){roll-=weights[i];if(roll<0){chosen=pool[i];break;}}
 return instantiateContent(s,cid,chosen,ctx);
}
export const FOCUS=['正常人生','教育','职业','家庭','婚配','关系','资源','健康'];
export function focusMatches(t,focus){return ({教育:/教育|学徒|技能/,职业:/职业|谋生|工作|事业|迁移/,家庭:/家庭|父母|兄弟|子女|育儿|生育/,婚配:/婚|夫妻/,关系:/关系|社交|熟人|邻里|师徒/,资源:/资源|财富|事业|竞争/,健康:/健康|疾病|疲劳|压力|照护/}[focus]||/$a/).test(t.domain);}
export function instantiateContent(s,cid,t,ctx=contentContext(s,cid)){
 let candidates=ctx.roles[t.participant_requirements.role];
 if(t.trigger_conditions.condition==='seriouskin')candidates=candidates.filter(id=>s.health[id].value<45);
 if(t.trigger_conditions.condition==='schoolchild')candidates=candidates.filter(id=>active(s.education[id]));
 const target_id=candidates.length?pick(s,candidates):null;
 const event={id:t.event_id,event_id:t.event_id,content_template:true,type:'content',title:t.display_templates.title,description:t.display_templates.description.replace('{person}',names(s,cid)).replace('{context}',ctx.stage+'；'+(active(s.careers[cid])?s.careers[cid].name:active(s.education[cid])?s.education[cid].name:'目前没有固定课业或工作')+'；'+(ctx.lc.away?'正在外乡生活':'住在家中')+'；'+(target_id?'相关人物：'+names(s,target_id)+'。':'')+(ctx.lc.care_time?'还承担家庭照护。':'')),category:t.domain,tags:[t.theme,...t.interest_examples],goal_tags:[],world_id:s.world_id,cost:0,source:'MOCK_EVENT_CONTENT',target_id,importance:t.importance,theme:t.theme,decision_goal:t.decision_goal,terminal_outcomes:clone(t.terminal_outcomes),transition_actions:clone(t.transition_actions),context_facts:{duration:3,cost:0,time:.15,participant_id:target_id},conditions:{contract_terms_known:true,information_verified:true},interest_examples:t.interest_examples,interest_domains:t.interest_examples.filter(Boolean).map(x=>({读书:'阅读',经商:'商业',农事:'自然',社交往来:'交流'}[x]||x))};
 event.mock_actions=t.terminal_outcomes.map((o,i)=>({id:i===0?'commit_terms':'alternative',name:o.label,tags:[i===0?'participate':'preserve_stability',...goalTags(o.effects)],traits:{interest_match:i===0?1:.2,social_exposure:target_id?(i===0?.65:.3):0,planning_need:i===0?.4:.2,long_term_commitment:t.importance==='major'?.8:0,career_value:o.effects.some(e=>['career','education','targetcareer','trial'].includes(e.kind))?.8:0,financial_value:o.effects.some(e=>['personal','household','wage'].includes(e.kind)&&e.value>0)?.6:0,relationship_care:o.effects.some(e=>e.kind==='relation'&&e.value>0)?.7:0,time_cost:.1,novelty:i===0?.5:.2},conditions:{action_type:'terminal_action',outcome:i===0?'accept':'defer',effects:['content'],content_effects:clone(o.effects)}}));
 // Real opportunities, not personality, create these extra routes.
 if(t.theme==='education'&&ctx.funds<120&&ctx.skill>=5)event.mock_actions.push({id:'fee_relief',name:'凭现有课业争取免去一部分费用，短期旁听',tags:['participate','skill_practice'],traits:{planning_need:.6,interest_match:.7},conditions:{action_type:'terminal_action',outcome:'accept',effects:['content'],content_effects:[{kind:'trial',value:1},{kind:'stress',value:2}]}});
 if(ctx.lc.care_time&&['education','apprentice','away'].includes(t.theme))event.mock_actions.push({id:'coordinate',name:'先交接照护，本期只作短期接触',tags:['participate','skill_practice'],traits:{planning_need:.7,relationship_care:.7,interest_match:.5},conditions:{action_type:'terminal_action',outcome:'accept',effects:['content'],content_effects:[{kind:'reassign',value:1},{kind:'skill',skill:t.interest_examples[0],value:1}]}});
 event.mock_actions.push({id:'leave_current',name:'说明当前安排不足，本次暂不改变生活',tags:['decline'],traits:{},conditions:{action_type:'terminal_action',outcome:'reject',effects:['content'],content_effects:[]}});
 for(const a of t.transition_actions)event.mock_actions.push({id:a.id,name:a.label,traits:{planning_need:.8,time_cost:.02},tags:['verify'],conditions:{action_type:'transition_action',outcome:'inquire',information_required:a.information,effects:[]}});
 event.context_facts.cost=Math.max(0,-t.terminal_outcomes[0].effects.filter(e=>e.kind==='household').reduce((sum,e)=>sum+e.value,0));return event;
}
function goalTags(effects){const tags=[];if(effects.some(e=>['education','career','relocation','targetcareer'].includes(e.kind)))tags.push('pursue_opportunity');if(effects.some(e=>['care','birth','marriage'].includes(e.kind)))tags.push('family_priority');return tags;}
export function contentFeasibility(s,cid,event,action){
 const effects=event.mock_actions.find(a=>a.id===action.action_id)?.conditions.content_effects||[],c=s.characters[cid],lc=lifeContext(s,cid),target=event.target_id,hh=s.households[c.current_household_id];
 const replacement=hh.members.find(id=>id!==cid&&s.characters[id].alive&&age(s,s.characters[id])>=18&&coResident(s,cid,id)&&!hh.responsibilities[id]);
 const householdCost=-effects.filter(e=>e.kind==='household'&&e.value<0).reduce((n,e)=>n+e.value,0),personalCost=-effects.filter(e=>e.kind==='personal'&&e.value<0).reduce((n,e)=>n+e.value,0)+effects.filter(e=>e.kind==='transfer').reduce((n,e)=>n+e.value,0);
 if(householdCost>Math.max(0,s.resources.households[c.current_household_id].household_resources))return '本次家庭投入超出实际资源';
 if(personalCost>s.resources.personal[cid].personal_inheritable_estate)return '个人备用钱不足';
 for(const e of effects){if(s.health[cid].value<30&&(['career','relocation','education','trial'].includes(e.kind)||e.kind==='fatigue'&&e.value>0))return '本人严重不适，不能开始这项额外劳动或长期投入';if(['targetcareer','targeteducation'].includes(e.kind)&&s.health[target]?.value<30)return '相关人物需要先处理严重健康问题';if(e.kind.startsWith('target')&&!s.characters[target]?.alive)return '需要真实存活的相关人物';if(['relocation','distance','reassign'].includes(e.kind)&&lc.care_time&&!replacement)return '当前照护没有可接替的同住成年人';if(['career','relocation'].includes(e.kind)&&age(s,c)<18)return '尚未达到本次长期工作年龄';if(e.kind==='birth'&&reproductionConditions(s,cid,target))return '目前不满足双方生育条件';if(e.kind==='marriage'&&!marriageCandidates(s,cid).some(x=>x.character_id===target&&!x.reason))return '目前不满足双方婚配条件';if(e.kind==='targetcareer'&&age(s,s.characters[target])<18)return '相关人物尚未成年';}
 return null;
}
export function applyContent(s,cid,result){
 const event=result.event,t=ANCIENT_EVENTS.find(t=>t.event_id===event.event_id),selected=event.mock_actions.find(a=>a.id===result.chosen_action_id),effects=selected?.conditions.content_effects||[],c=s.characters[cid],target=event.target_id,hh=s.households[c.current_household_id],fund=s.resources.households[c.current_household_id],before=auditSnapshot(snapshot(s,cid),s.current_world_month),relatedBefore=target?auditSnapshot(snapshot(s,target),s.current_world_month):null;
 if(!selected)throw Error('内容终局选项不存在');
 let targetAccepted=true;
 if(effects.some(e=>['targeteducation','targetcareer'].includes(e.kind))){const offer=effects.find(e=>['targeteducation','targetcareer'].includes(e.kind));const opportunity={...eventFor(s,offer.kind==='targeteducation'?'education':'career'),cost:0};result.recipient_decision=resolveDecision(s,target,opportunity);targetAccepted=chosen(result.recipient_decision).outcome==='accept';s.characters[target].experiences.push({month:s.current_world_month,type:'decision',event:'家庭提供的'+opportunity.title,action:result.recipient_decision.chosen_action});}
 const reason=contentFeasibility(s,cid,event,{action_id:selected.id});if(reason)throw Error(reason);
 const demanding=effects.some(e=>['skill','targetskill','personal','household'].includes(e.kind)&&e.value>0),ability=(c.talents.intelligence+c.talents.stress_resistance)/200+Math.min(1,Math.max(0,...c.skills.filter(k=>t.interest_examples.includes(k.name)).map(k=>k.level))/100),fail=demanding&&random(s)<Math.max(.05,CFG.failure_base+c.dynamic.stress/500+(s.health[cid].value<50?.12:0)-ability*.1),changes=[];
 const reassign=()=>{const replacement=hh.members.find(id=>id!==cid&&s.characters[id].alive&&age(s,s.characters[id])>=18&&coResident(s,cid,id)&&!hh.responsibilities[id]);if(hh.responsibilities[cid]&&replacement){hh.responsibilities[replacement]={...hh.responsibilities[cid]};delete hh.responsibilities[cid];}};
 for(const e of effects){if(!targetAccepted&&['targeteducation','targetcareer','household'].includes(e.kind))continue;const v=fail&&['skill','targetskill','personal','household'].includes(e.kind)&&e.value>0?0:e.value;switch(e.kind){
 case 'skill':learn(s,cid,e.skill,v);break;case 'targetskill':learn(s,target,e.skill,v);break;
 case 'relation':if(target)changeRelationship(s,cid,target,v,event.title);break;
 case 'mood':case 'stress':case 'fatigue':c.dynamic[e.kind]=bound(c.dynamic[e.kind]+v);break;
 case 'health':s.health[cid].value=bound(s.health[cid].value+v);break;case 'targethealth':s.health[target].value=bound(s.health[target].value+v);if(v>0)addLongTerm(s,target,'health_recovery',null,3,80,['本次休养']);break;
 case 'personal':s.resources.personal[cid].personal_inheritable_estate+=v;break;case 'household':fund.household_resources+=v;break;case 'transfer':s.resources.personal[cid].personal_inheritable_estate-=v;fund.household_resources+=v;break;
 case 'progress':if(active(s.education[cid]))s.education[cid].progress=Math.max(0,s.education[cid].progress+v);break;
 case 'career':employ(s,cid,v);break;case 'education':enroll(s,cid,v);break;case 'targetcareer':employ(s,target,v);break;case 'targeteducation':enroll(s,target,v);break;
 case 'quit':if(s.careers[cid])s.careers[cid].status='ended';break;
 case 'wage':if(active(s.careers[cid]))s.careers[cid].wage=Math.max(.1,s.careers[cid].wage+v);break;
 case 'reducework':if(active(s.careers[cid])){s.careers[cid].time=Math.max(.2,s.careers[cid].time-.15);s.careers[cid].wage*=.85;}break;
 case 'reassign':reassign();break;
 case 'relocation':employ(s,cid,v);startAway(s,cid);break;
 case 'care':hh.responsibilities[cid]={type:'family_care',target_id:target,mandatory:true,until:s.current_world_month+12};break;
 case 'distance':reassign();addLongTerm(s,cid,'temporary_distance',null,3,75,['暂时减少共同活动']);break;
 case 'trial':{const k=addLongTerm(s,cid,'short_trial',null,2,75,['本次短期接触']);Object.assign(s.long_term_states[k],{time_cost:.15,skill:t.interest_examples[0]});break;}
 case 'stoptrial':for(const x of lifeContext(s,cid).terms.filter(x=>x.type==='short_trial'))x.status='ended';break;
 case 'fundeducation':for(const id of hh.members)if(active(s.education[id])){s.education[id].funding_fraction=id===cid?1:.5;s.education[id].time=id===cid?.65:.325;}break;
 case 'reduceeducation':for(const id of hh.members)if(active(s.education[id])){s.education[id].funding_fraction=.5;s.education[id].time=.325;}break;
 case 'marriage':result.content_arrangement=arrangeMarriage(s,cid,target,'ordinary');break;case 'birth':result.content_birth=startReproduction(s,cid,target);break;
 default:throw Error('未定义内容效果 '+e.kind);
 }}
 const meaningful=effects.length>0;
 if(meaningful&&t.developmental){let term=lifeContext(s,cid).terms.find(x=>x.content_theme===t.theme);if(!term){const k=addLongTerm(s,cid,'content_theme',null,CFG.theme_duration,20,[t.domain+' 的已有经历影响后续机会']);term=s.long_term_states[k];term.content_theme=t.theme;}term.last_event_id=t.event_id;term.development_count=(term.development_count||0)+1;
  if(t.possible_ongoing_situations.length){const issue=ensureSituation(s,'content_'+t.theme,[cid,...(target?[target]:[])],[event.title],20);issue.content_theme=t.theme;issue.last_event_id=t.event_id;}
  for(const issue of Object.values(s.ongoing_situations).filter(x=>active(x)&&x.content_theme===t.theme&&x.participants.includes(cid)&&(!target||x.participants.includes(target)))){const severityBefore=issue.severity;issue.severity=bound(issue.severity+(fail?8:-10));issue.development_history.push({month:s.current_world_month,kind:fail?'worsened':'improved',event_id:t.event_id,severity:issue.severity});if(issue.severity===0){issue.status='resolved';issue.end_month=s.current_world_month;}changes.push('持续处境：'+severityBefore+' → '+issue.severity);}
 }
 if(t.participant_requirements.role==='mentor'&&target&&meaningful)c.mentor_character_id=target;
 const outcome=result.content_arrangement?'本次正式议亲：'+({married:'双方接受，婚姻已经成立',refused:'本人拒绝，未成立婚姻',other_refused:'对方拒绝，未成立婚姻',delayed:'暂缓，继续保留议亲状态',blocked:'现实条件不满足，未成立婚姻'}[result.content_arrangement.status]||result.content_arrangement.status):result.content_birth?(result.content_birth.started?'双方开始孕育与照护安排。':'本次没有开始孕育：'+result.content_birth.reason):!targetAccepted?'家庭提供了具体机会，但当事人本次没有接受；未启动安排，预留费用未支出。':!meaningful?'说明了当前限制，本次没有改变既有安排。':fail?'投入了时间或资源，但受到当前压力、健康与熟练程度限制，预期的学习或收益没有实现。':selected.name+'。'+(effects.some(e=>e.kind==='relation'&&e.value>0)?'这次共同经历让双方更亲近。':effects.some(e=>e.kind==='relation'&&e.value<0)?'双方留下了一些不满，之后的互动会带着这段经历。':'')+(effects.some(e=>['skill','targetskill'].includes(e.kind))?'这次实际练习留下了可继续积累的经验。':'')+(effects.some(e=>e.kind==='household'&&e.value<0)?'家庭支付了这次安排所需的费用。':'');
 const after=auditSnapshot(snapshot(s,cid),s.current_world_month);result.content_result={outcome,failed:fail,before,after,related_before:relatedBefore,related_after:target?auditSnapshot(snapshot(s,target),s.current_world_month):null};result.actual_changes=[outcome,...changes];result.systems=[...new Set(effects.map(e=>e.kind))];
 c.experiences.push({month:s.current_world_month,type:'content',event_id:t.event_id,theme:t.theme,domain:t.domain,importance:t.importance,event:event.title,action:selected.name,outcome,related_person_id:target,failed:fail});recordEvent(s,cid,'content:'+t.event_id);return result.systems;
}
