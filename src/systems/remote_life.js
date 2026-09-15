import {sameLocation,locationDue,syncRemoteThreads,locationOf,remoteFacts} from './location_context.js';
import {changeRelationship} from './relationships.js';
import {createCharacter} from './character_generation.js';
import {createHousehold} from './household.js';
import {employ} from './education_career.js';
export function importantRemote(s,cid){const id=s.control.current_control_character_id,c=s.characters[id],t=s.characters[cid];return !!c&&!!t&&(c.current_household_id===t.current_household_id||c.spouse_character_id===cid||c.biological_parent_ids.includes(cid)||t.biological_parent_ids.includes(id)||c.mentor_character_id===cid||Object.values(s.relationships).some(r=>r.people.includes(cid)&&r.people.includes(id)&&r.attitude>=70));}
export function ensureLocalContacts(s,cid){
 // ponytail: a few existing-generator contacts, no regional population model.
 const c=s.characters[cid];if(!c?.alive)return;
 const l=locationOf(s,cid),count=Object.values(s.characters).filter(x=>x.alive&&x.character_id!==cid&&sameLocation(s,cid,x.character_id)&&s.current_world_month-x.birth_month>=216).length;
 for(let n=count;n<(s.config.location_contact_min??2);n++){const hid=createHousehold(s,'新认识的当地人家',l.ref),contact=createCharacter(s,{age_years:30+n*4,sex:n%2?'女':'男',household_id:hid,fidelity:'simplified'});s.resources.households[hid].household_resources=s.config.opportunity_cost*3;employ(s,contact.character_id,s.careers[cid]?.id==='service'?1:s.careers[cid]?.id==='craft'?2:0);changeRelationship(s,cid,contact.character_id,0,'在当前生活环境建立联系');}
}
const statusLabel=x=>({active:'进行中',completed:'已完成',paused:'暂停',ended:'已结束',none:'暂无安排'})[x]||x;
export function remoteFollowups(s){
 syncRemoteThreads(s);const visible=[];
 for(const t of Object.values(s.remote_life_threads||{})){
  if(!['active','deceased'].includes(t.status))continue;
  const cid=t.character_id,c=s.characters[cid],now=remoteFacts(s,cid),old=t.last_observed||t.baseline||now,baseline=t.baseline||now;
  const urgent=old.alive&&!now.alive?'死亡消息':old.health>=30&&now.health<30?'严重健康求助':old.marriage!==now.marriage&&now.marriage?'婚姻消息':old.education!==now.education?'学习安排变化':old.career_status!==now.career_status||old.career!==now.career?'职业安排变化':!old.due&&now.due?'异地安排到期':Math.abs(now.resources-old.resources)>=(s.config.remote_resource_notice??120)?'异地收支明显变化':null;
  const periodic=c.alive&&s.current_world_month-t.last_followup_month>=(s.config.remote_followup_months??6),reasons=[];
  if(t.status==='deceased'&&t.death_reported)continue;
  if(periodic&&now.alive){const family=t.important_participants.find(x=>s.characters[x]?.alive&&!sameLocation(s,cid,x));if(family){changeRelationship(s,cid,family,s.config.remote_relation_delta??.4,'通过来信维持异地联系');reasons.push('与'+s.characters[family].surname+s.characters[family].given_name+'通过来信保持联系');now.relation_total=remoteFacts(s,cid).relation_total;}}
  if(periodic||urgent){
   if(now.career!==baseline.career||now.career_status!==baseline.career_status)reasons.push('职业安排：'+baseline.career+'（'+statusLabel(baseline.career_status)+'） → '+now.career+'（'+statusLabel(now.career_status)+'）');
   if(now.work_progress>baseline.work_progress)reasons.push(now.career+'继续进行，累计完成 '+(now.work_progress-baseline.work_progress).toFixed(1)+' 月投入');
   if(now.education!==baseline.education||now.learning_progress>baseline.learning_progress)reasons.push('学习状态 '+statusLabel(now.education)+'，进度 '+now.learning_progress.toFixed(1));
   if(now.health!==baseline.health)reasons.push('健康 '+baseline.health.toFixed(1)+' → '+now.health.toFixed(1));
   if(now.resources!==baseline.resources)reasons.push('个人备用资源 '+baseline.resources.toFixed(1)+' → '+now.resources.toFixed(1));
   if(now.marriage!==baseline.marriage)reasons.push(now.marriage?'已建立真实婚姻':'婚姻状态发生变化');
   if(now.due)reasons.push('预计期限已到，当前位置保留，等待去留决定');
   if(!now.alive)reasons.push('已经记录死亡事实');
   if(reasons.length){const row={type:'cross_location_event',location_scope:'remote_only',remote_thread_id:t.remote_thread_id,character_id:cid,month:s.current_world_month,title:urgent||'异地来信',reasons,before:structuredClone(baseline),after:structuredClone(now),important:!!urgent};t.followups.push(row);t.last_followup_month=s.current_world_month;t.current_phase=!now.alive?'人生结束':now.due?'等待去留决定':now.health<30?'异地休养':now.education==='active'?'异地学习':now.career_status==='active'?'异地工作':'异地生活';t.baseline=now;if(importantRemote(s,cid))visible.push(row);if(!now.alive)t.death_reported=true;}
  }
  t.baseline=t.baseline||now;t.last_observed=now;
 }
 return visible;
}
