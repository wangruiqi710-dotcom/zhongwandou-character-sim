import {id} from '../core/rng.js';
export const activeTerms=(s,cid)=>Object.values(s.long_term_states).filter(t=>t.character_id===cid&&t.status==='active');
export function lifeContext(s,cid){
 const c=s.characters[cid],terms=activeTerms(s,cid),away=terms.find(t=>t.type==='away_from_home_assignment'),local=terms.find(t=>t.type==='local_settlement');
 const distance=terms.find(t=>t.type==='temporary_distance');const location=distance?{id:'distance:'+distance.id,name:'附近暂住处',source:'MOCK_ONLY'}:away?.location_context||local?.location_context||{id:'home:'+c.current_household_id,name:'家乡',source:'MOCK_ONLY'};
 const home=location.id==='home:'+c.current_household_id,care=s.households[c.current_household_id]?.responsibilities[cid];
 const education=s.education[cid]?.status==='active'?s.education[cid].time:0,career=s.careers[cid]?.status==='active'?s.careers[cid].time:0;
 const careTime=home&&care?.until>s.current_world_month?(care.time??s.config.care_time):0;
 const trial=terms.find(t=>t.type==='short_trial'),routeTime=terms.some(t=>t.type==='safe_route')?s.config.safe_route_time:0;
 return {location,co_resident:home,away:away||local,terms,education_time:education,career_time:career,care_time:careTime,trial_time:trial?.time_cost||0,route_time:routeTime,available_time:Math.max(0,1-education-career-careTime-(trial?.time_cost||0)-routeTime),recent_history:s.recent_history[cid]||[],situations:Object.values(s.ongoing_situations).filter(x=>x.status==='active'&&x.participants.includes(cid))};
}
export const coResident=(s,a,b)=>lifeContext(s,a).location.id===lifeContext(s,b).location.id;
export function recordEvent(s,cid,type,phase='event'){const list=s.recent_history[cid]||(s.recent_history[cid]=[]);list.push({type,phase,month:s.current_world_month});if(list.length>s.config.recent_history_limit)list.splice(0,list.length-s.config.recent_history_limit);}
export function cooled(s,cid,type,months=s.config.event_cooldown){return !(s.recent_history[cid]||[]).some(x=>x.type===type&&s.current_world_month-x.month<months);}
export function startAway(s,cid){
 const c=s.characters[cid],h=s.households[c.current_household_id],care=h.responsibilities[cid],changes=[];
 if(care?.until>s.current_world_month){const replacement=h.members.find(x=>x!==cid&&s.characters[x].alive&&lifeContext(s,x).co_resident&&(s.current_world_month-s.characters[x].birth_month)>=18*12&&!h.responsibilities[x]);
  if(!replacement)throw Error('原家庭照护没有可接替的人，无法离乡');
  h.responsibilities[replacement]={...care,reassigned_from:cid};delete h.responsibilities[cid];changes.push({from:cid,to:replacement,reason:'离乡期间重新分配照护'});
 }
 const key=id(s,'long');s.long_term_states[key]={id:key,character_id:cid,type:'away_from_home_assignment',source:null,start_month:s.current_world_month,expected_duration:s.config.relocation_months,status:'active',priority:85,location_context:{id:'away:'+key,name:s.world_id==='ancient'?'外地市镇':'外地工作地',source:'MOCK_ONLY'},work_or_training_context:{name:'外地工作',career_id:cid},family_responsibility_changes:changes,default_behavior_effects:['外地工作','远程家庭联系'],end_conditions:['去留决策','死亡'],due_decision:false};
 return key;
}
