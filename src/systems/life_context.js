import {locationOf,isSameLocationAsHousehold,canProvideCare,moveLocation} from './location_context.js';
export {coResident} from './location_context.js';
import {id} from '../core/rng.js';
export const activeTerms=(s,cid)=>Object.values(s.long_term_states).filter(t=>t.character_id===cid&&t.status==='active');
export function lifeContext(s,cid){
 const c=s.characters[cid],terms=activeTerms(s,cid),l=locationOf(s,cid),home=isSameLocationAsHousehold(s,cid),away=!home,location={...l,id:l.ref};
 const care=s.households[c.current_household_id]?.responsibilities[cid];
 const education=s.education[cid]?.status==='active'&&(!s.education[cid].location_context_ref||s.education[cid].location_context_ref===l.ref)?s.education[cid].time:0,career=s.careers[cid]?.status==='active'&&(!s.careers[cid].location_context_ref||s.careers[cid].location_context_ref===l.ref)?s.careers[cid].time:0;
 const careTime=canProvideCare(s,cid)?(care.time??s.config.care_time):0;
 const trial=terms.find(t=>t.type==='short_trial'&&(!t.location_context_ref||t.location_context_ref===l.ref)),routeTime=terms.some(t=>t.type==='safe_route')?s.config.safe_route_time:0;
 return {location,co_resident:home,away,terms,education_time:education,career_time:career,care_time:careTime,trial_time:trial?.time_cost||0,route_time:routeTime,available_time:Math.max(0,1-education-career-careTime-(trial?.time_cost||0)-routeTime),recent_history:s.recent_history[cid]||[],situations:Object.values(s.ongoing_situations).filter(x=>x.status==='active'&&x.participants.includes(cid))};
}
export function recordEvent(s,cid,type,phase='event'){const list=s.recent_history[cid]||(s.recent_history[cid]=[]);list.push({type,phase,month:s.current_world_month});if(list.length>s.config.recent_history_limit)list.splice(0,list.length-s.config.recent_history_limit);}
export function cooled(s,cid,type,months=s.config.event_cooldown){return !(s.recent_history[cid]||[]).some(x=>x.type===type&&s.current_world_month-x.month<months);}
export function startAway(s,cid,options={}){
 const duration=options.duration??s.config.relocation_months,l=moveLocation(s,cid,{context:'away',purpose:'work',duration,...options});
 for(const t of activeTerms(s,cid))if(['away_from_home_assignment','local_settlement','temporary_distance'].includes(t.type))t.status='ended';
 const key=id(s,'long');s.long_term_states[key]={id:key,character_id:cid,type:'away_from_home_assignment',source:null,start_month:s.current_world_month,expected_duration:duration,status:'active',priority:85,location_context_ref:l.ref,location_context:l.context,family_responsibility_changes:s.households[s.characters[cid].current_household_id].history.filter(x=>x.month===s.current_world_month&&x.type==='location_care_reassignment'&&x.from===cid),default_behavior_effects:[l.name+'生活','远程家庭联系'],end_conditions:['去留决策','死亡'],due_decision:false};
 for(const group of [l.purpose==='study'?'education':'careers'])if(s[group][cid]?.status==='active')Object.assign(s[group][cid],{location_context_ref:l.ref,location_context:l.context});
 return key;
}
