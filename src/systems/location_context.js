import {id} from '../core/rng.js';
// MOCK context cohorts, not places on a map. Only Person owns current position.
export const LOCATION_LABELS={home:'家中',local:'本地',suburb:'郊区',nearby:'附近',away:'外地',far_away:'远方',traveling:'旅途中'};
export const PURPOSE_LABELS={work:'工作',study:'学习',marriage:'婚姻安排',family:'家庭',visit:'探访',temporary_task:'临时事务',migration:'迁移',other:'生活'};
export function initLocation(s,c){
 const mother=c.biological_parent_ids.map(x=>s.characters[x]).find(x=>x?.sex==='女'),h=s.households[c.current_household_id];
 Object.assign(c,{current_location_context:mother?.current_location_context||'home',location_context_ref:mother?.location_context_ref||h?.home_context_ref||'origin',location_purpose:c.biological_parent_ids.length?'family':'other',location_start_month:s.current_world_month,expected_location_duration:null,return_expected:false,remote_thread_id:null});
}
export function locationOf(s,cid){
 const c=s.characters[cid];if(!c)return null;
 if(c.current_location_context)return {context:c.current_location_context,ref:c.location_context_ref,name:LOCATION_LABELS[c.current_location_context],purpose:c.location_purpose,start_month:c.location_start_month,expected_duration:c.expected_location_duration,return_expected:c.return_expected};
 // Read-only display of old saves; never migrate or overwrite their history.
 const t=Object.values(s.long_term_states).find(t=>t.character_id===cid&&t.status==='active'&&['away_from_home_assignment','local_settlement','temporary_distance'].includes(t.type));
 return {context:t?'away':'home',ref:t?.location_context?.id||'origin',name:t?.location_context?.name||'家中',purpose:'other',legacy:true};
}
export const activeLocationContext=s=>locationOf(s,s.control.current_control_character_id);
export const sameLocation=(s,a,b)=>!!s.characters[a]&&!!s.characters[b]&&locationOf(s,a).context!=='traveling'&&locationOf(s,b).context!=='traveling'&&locationOf(s,a).ref===locationOf(s,b).ref;
export const isSameLocationAsHousehold=(s,cid)=>{const c=s.characters[cid],l=locationOf(s,cid);return !!c&&l.context!=='traveling'&&l.ref===(s.households[c.current_household_id]?.home_context_ref||'origin');};
export const coResident=(s,a,b)=>sameLocation(s,a,b)&&s.characters[a].current_household_id===s.characters[b].current_household_id;
export const canProvideCare=(s,cid)=>{const c=s.characters[cid],r=s.households[c.current_household_id]?.responsibilities[cid];return !!r&&r.until>s.current_world_month&&(r.target_id?sameLocation(s,cid,r.target_id):isSameLocationAsHousehold(s,cid));};
export const remoteFacts=(s,cid)=>{const c=s.characters[cid];return {alive:c.alive,health:s.health[cid].value,career:s.careers[cid]?.name||'无固定工作',career_status:s.careers[cid]?.status||'none',work_progress:s.careers[cid]?.progress||0,education:s.education[cid]?.status||'none',learning_progress:s.education[cid]?.progress||0,marriage:c.marriage_id,resources:s.resources.personal[cid].personal_inheritable_estate,relation_total:Object.values(s.relationships).filter(r=>r.people.includes(cid)).reduce((v,r)=>v+r.attitude,0),due:locationDue(s,cid)};};
export function locationAllows(s,cid,event,target=event.target_id){
 const l=locationOf(s,cid),scope=event.location_scope||'anywhere';if(!l)return false;
 if(scope==='anywhere')return true;
 if(scope==='traveling')return l.context==='traveling';
 if(scope==='remote_only')return target?!!s.characters[target]&&!sameLocation(s,cid,target):!isSameLocationAsHousehold(s,cid);
 if(scope==='same_household')return target?coResident(s,cid,target):s.households[s.characters[cid].current_household_id].members.some(x=>x!==cid&&s.characters[x].alive&&coResident(s,cid,x));
 return l.context!=='traveling'&&(!target||sameLocation(s,cid,target));
}
export function moveLocation(s,cid,{context='away',purpose='migration',duration=null,return_expected=true,shared_context_ref=null}={}){
 const c=s.characters[cid];if(!c?.alive||!c.current_location_context)throw Error('地点状态缺失或人物已死亡；旧存档只能读取');
 if(!LOCATION_LABELS[context]||!PURPOSE_LABELS[purpose]||duration!==null&&(!Number.isInteger(duration)||duration<1))throw Error('无效的地点安排');
 const h=s.households[c.current_household_id],ref=shared_context_ref||(['home','local'].includes(context)?h.home_context_ref:id(s,'context')),care=h.responsibilities[cid];
 if(care?.until>s.current_world_month&&ref!==(care.target_id?locationOf(s,care.target_id)?.ref:h.home_context_ref)){
  const replacement=h.members.find(x=>x!==cid&&s.characters[x].alive&&(care.target_id?sameLocation(s,x,care.target_id):isSameLocationAsHousehold(s,x))&&s.current_world_month-s.characters[x].birth_month>=216&&!h.responsibilities[x]);
  if(!replacement)throw Error('原家庭照护没有可接替的人，无法离开');
  h.responsibilities[replacement]={...care,reassigned_from:cid};delete h.responsibilities[cid];h.history.push({month:s.current_world_month,type:'location_care_reassignment',from:cid,to:replacement});
 }
 const before=locationOf(s,cid);Object.assign(c,{current_location_context:context,location_context_ref:ref,location_purpose:purpose,location_start_month:s.current_world_month,expected_location_duration:duration,return_expected,location_review_resolved:false});
 c.experiences.push({month:s.current_world_month,type:'location_changed',before,after:locationOf(s,cid)});syncRemoteThreads(s);return locationOf(s,cid);
}
export function locationDue(s,cid){const c=s.characters[cid];return c?.alive&&c.expected_location_duration!==null&&!c.location_review_resolved&&s.current_world_month-c.location_start_month>=c.expected_location_duration;}
export function syncRemoteThreads(s){
 if(!s.remote_life_threads)return;const active=activeLocationContext(s);
 for(const c of Object.values(s.characters)){
  let t=s.remote_life_threads[c.remote_thread_id];const l=locationOf(s,c.character_id);
  if(t&&(!c.alive||t.context_ref!==l.ref)){t.status=c.alive?'ended':'deceased';t.end_month=s.current_world_month;t=null;}
  if(!c.alive||!active)continue;
  if(c.character_id===s.control.current_control_character_id||l.ref===active.ref){if(t)t.status='active_scene';continue;}
  if(!t){const key=id(s,'remote');t=s.remote_life_threads[key]={remote_thread_id:key,character_id:c.character_id,context_ref:l.ref,location_context:l.context,purpose:l.purpose,start_month:l.start_month,expected_duration:l.expected_duration,status:'active',current_phase:'异地生活',last_followup_month:s.current_world_month,important_participants:[...new Set([c.spouse_character_id,...c.biological_parent_ids,...s.households[c.current_household_id].members].filter(x=>x&&x!==c.character_id))],followup_tags:[l.purpose,'cross_location'],return_expected:l.return_expected,baseline:remoteFacts(s,c.character_id),last_observed:remoteFacts(s,c.character_id),followups:[]};c.remote_thread_id=key;}
  t.important_participants=[...new Set([...t.important_participants,c.spouse_character_id,...c.biological_parent_ids,...s.households[c.current_household_id].members].filter(x=>x&&x!==c.character_id))];
  t.status='active';t.location_context=l.context;t.purpose=l.purpose;t.expected_duration=l.expected_duration;t.return_expected=l.return_expected;
 }
}
