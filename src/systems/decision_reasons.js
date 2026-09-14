// MOCK_TUNABLE reason support. Evidence always points to current or recorded facts.
import {lifeContext} from './life_context.js';
export const majorDecision=e=>['education','career','relocation','marriage','birth'].includes(e.type)||e.importance==='major'||e.mock_actions?.some(a=>a.conditions.content_effects?.some(x=>['education','career','targeteducation','targetcareer','relocation','marriage','birth'].includes(x.kind)));
export function reasonsFor(s,cid,event,action){
 const c=s.characters[cid],lc=lifeContext(s,cid),cfg=s.config,negative=[],positive=[];
 const add=(list,code,reason,strong=false)=>list.push({actor_id:cid,code,reason,strong});
 const domains=action.interest_domains||event.interest_examples||[],matches=c.interests.filter(i=>domains.includes(i.name));
 if(matches.some(i=>i.intensity<=(cfg.reason_low_interest??20)))add(negative,'low_interest','对本次涉及领域兴趣较低');
 if(matches.some(i=>i.intensity>=70))add(positive,'interest','对本次涉及领域兴趣较高');
 if(s.health[cid].value<60)add(negative,'health','当前健康低于60，需要减少额外负担');
 if(c.dynamic.stress>=(cfg.reason_stress??65))add(negative,'stress','当前压力较高');
 if(majorDecision(event)&&lc.care_time>0){const care=s.households[c.current_household_id].responsibilities[cid];add(negative,'care','已有实际家庭照护责任，与新增长期投入存在冲突',event.type==='relocation'&&(c.life_goal==='家庭生活'||care?.mandatory===true));}
 if(['education','career','relocation'].includes(event.type)&&s.education[cid]?.status==='active')add(negative,'unfinished_education','当前教育安排尚未结束');
 if(event.conditions?.contract_terms_known===false||event.conditions?.information_verified===false)add(negative,'information','安排的关键条件尚未核实');
 if(c.personality.planning>=85&&!event.context_facts?.information_acquired)add(negative,'caution','人物计划性较高，倾向先确认重大安排');
 const target=event.target_id,rel=Object.values(s.relationships).find(r=>r.people.includes(cid)&&r.people.includes(target));
 if(rel?.attitude<=(cfg.reason_bad_relation??-60))add(negative,'relationship','与相关人物的真实关系极差',true);
 if(rel?.attitude>=30)add(positive,'relationship','与相关人物关系较好');
 const history=c.experiences.filter(x=>x.event_id===event.event_id&&event.event_id||x.decision_type===event.type);
 if(history.some(x=>x.strong_conflict===true&&x.target_id===target))add(negative,'recorded_refusal','此前已记录对同一安排的明确强烈反对',true);
 if(history.filter(x=>x.failed).length>=2)add(negative,'past_failure','同类经历中已记录多次挫折');
 if(event.response_role==='candidate_family'){
  const member=event.family_subject_id,job=s.careers[member],house=s.households[c.current_household_id],working=house.members.filter(id=>s.characters[id].alive&&s.careers[id]?.status==='active');
  if(job?.status==='active'&&working.length===1&&working[0]===member&&s.resources.households[c.current_household_id].household_resources<(cfg.reason_family_reserve??150))add(negative,'family_livelihood','候选承担家庭唯一稳定谋生责任，当前家庭储备不足，成婚离家会影响家计',true);
 }
 if(event.cost>0&&event.cost>s.resources.households[c.current_household_id].household_resources*.5)add(negative,'resource_concern','本次费用占家庭现有资源一半以上');
 if(['career','education'].includes(event.type)&&c.life_goal==='职业成就')add(positive,'goal','专业发展与职业成就目标一致');
 if(event.type==='marriage'&&c.life_goal==='家庭生活')add(positive,'goal','建立家庭与家庭生活目标一致');
 if(event.type==='career'&&c.life_goal==='财富积累')add(positive,'goal','本次谋生机会与财富积累方向相关');
 if(!negative.length)add(positive,'feasible_opportunity','当前已核实的安排可行，没有明显阻碍因素');
 const opposing=['reject','defer'].includes(action.outcome);
 return {supporting_reasons:opposing?negative:positive,opposing_reasons:opposing?positive:negative,reason_support:(opposing?negative:positive).length,strong_conflicts:negative.filter(r=>r.strong)};
}
export function withReasonSupport(s,cid,event,actions,blocked=[]){return actions.map(a=>{
 const reasons=reasonsFor(s,cid,event,a);if(['reject','defer'].includes(a.outcome)){for(const reason of new Set(blocked.filter(x=>x.outcome==='accept').map(x=>x.exclusion_reason)))reasons.supporting_reasons.push({actor_id:cid,code:'feasibility',reason,strong:false});reasons.reason_support=reasons.supporting_reasons.length;}let multiplier=1;
 if(majorDecision(event)&&['reject','defer'].includes(a.outcome)&&!reasons.reason_support)multiplier=a.outcome==='reject'?(s.config.reason_unmotivated_reject??.02):(s.config.reason_unmotivated_defer??.08);
 if(majorDecision(event)&&a.action_type==='transition_action'&&!reasons.opposing_reasons.length)multiplier=s.config.reason_unmotivated_transition??.2;
 return {...a,...reasons,base_weight:a.base_weight*multiplier,reason_weight_multiplier:multiplier};
});}
