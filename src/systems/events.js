import {selectNPC} from './npc_world.js';
import {pickContent} from '../content/event_runtime.js';
import {completeEvent} from './action_catalog.js';
import {lifeContext,coResident,cooled,recordEvent} from './life_context.js';
import {random,pick,bound,integer} from '../core/rng.js';
import {age} from '../core/state.js';
import {changeRelationship} from './relationships.js';
import {currentMarriage,marriageCandidates,ensureMarriageCandidates} from './marriage.js';

import {createCharacter} from './character_generation.js';
import {createHousehold} from './household.js';
import {employ} from './education_career.js';
export function backgroundCandidates(s,cid){const c=s.characters[cid],lc=lifeContext(s,cid),h=s.households[c.current_household_id],out=[];if(s.education[cid]?.status==='active'||lc.terms.some(t=>t.type==='short_trial'))out.push({id:'education',title:'学习中掌握了一个小窍门',tags:['education'],system:'education'});if(s.careers[cid]?.status==='active')out.push({id:lc.away?'away_work':'work',title:lc.away?'逐渐熟悉外地的工作安排':'日常工作得到一点肯定',tags:['career'],system:'careers'});if(lc.away)out.push({id:'away_life',title:'逐渐熟悉外地生活的作息与开销',tags:['location'],system:'long_term_states'});if(lc.co_resident&&h.members.some(id=>id!==cid&&s.characters[id].alive&&coResident(s,cid,id)))out.push({id:'family',title:'共同生活中的一次分担',tags:['family'],system:'households'});const r=Object.values(s.relationships).find(r=>r.people.includes(cid)&&r.people.every(id=>s.characters[id].alive));if(r){const target=r.people.find(id=>id!==cid);out.push({id:coResident(s,cid,target)?'relationship':'remote_contact',title:coResident(s,cid,target)?'与熟人有了一次简短交流':'通过传信了解远方亲友近况',tags:['social'],system:'relationships',target_id:target});}return out.filter(e=>cooled(s,cid,'background:'+e.id,s.config.background_cooldown));}
export function triggerBackground(s,cid,candidates){
 if(s.world_id==='ancient'&&s.config.content_enabled!==false){const roll=random(s);if(roll>=s.config.background_event_frequency)return {roll,event:null};const event=pickContent(s,cid,true);if(!event)return {roll,event:null};return {roll,event,content_pending:true};}
 const roll=random(s);if(!candidates.length||roll>=s.config.background_event_frequency)return {roll,event:null};const e=pick(s,candidates),delta=(random(s)<.7?1:-1)*s.config.background_delta;const c=s.characters[cid];c.dynamic.mood=bound(c.dynamic.mood+delta);if(e.target_id)changeRelationship(s,cid,e.target_id,delta,e.title);recordEvent(s,cid,'background:'+e.id);return {roll,event:e,delta};}
export function eventFor(s,type,target_id=null){const ancient=s.world_id==='ancient',table={
 music:['音乐邀请',ancient?'朋友邀请参加听曲与演奏活动。':'朋友邀请参加音乐活动。','社交',[],0],
 safety:['道路治安消息','听说某条道路近期不太安全，需要核实路线。','治安问题',[],0],
 learning:['短期试学机会',ancient?'作坊提供一次手工短期试学。':'附近提供一次音乐短期试学。','学习',['short_learning'],s.config.opportunity_cost],
 career:['发展机会',ancient?'获得长期作坊学徒训练机会，条件已核实。':'获得长期职业训练工作机会，条件已核实。','工作机会',['career_opportunity'],s.config.opportunity_cost],
 relocation:['离乡三年机会','获得需要长期离乡三年的发展机会。','工作机会',['long_absence','career_opportunity'],s.config.opportunity_cost],
 health:['健康打断生活','本人身体不适，需要休息与求医。','疾病',[],0],
 conflict:['责任与家计冲突','已有生活安排出现时间或资源冲突，需要协调家庭分工。','家庭安排',[],0],
 birth:['生育与照护安排','讨论是否尝试生育并承担长期照护。','生育',['parenthood'],0],
 strain:['共同生活发生明显冲突','关系紧张与持续压力使共同生活受到打断，可以协商、求助或寻求暂时离开。','家庭安排',['major_family_conflict'],0]
};table.education=['长期教育机会','家庭支持的长期教育路线，需要投入学习时间与资源。','学习',['career_opportunity'],s.config.opportunity_cost];table.away_review=['离乡安排到期','原定期限已到，需要决定返回、延长、定居或转换道路。','工作机会',['long_absence'],0];table.marriage=['具体婚配机会','双方开始商量共同生活。','婚配',['marriage'],s.config.marriage_cost];const [title,description,category,goal_tags,cost]=table[type]||table.learning;const event={type,title,description,category,goal_tags,tags:[type],cost,target_id,world_id:s.world_id,source:'MOCK_ONLY',conditions:{contract_terms_known:true,information_verified:true}};
 if(type==='strain')event.mock_actions=[
 {id:'discuss',name:'留在家中协商共同生活分工',traits:{relationship_care:1,planning_need:.6,time_cost:.4},tags:['family_priority','participate'],conditions:{}},
 {id:'seek_support',name:'向可信赖的亲友寻求调解',traits:{social_exposure:.7,relationship_care:.7,time_cost:.3},tags:['social','verify'],conditions:{requires_companion:true}},
 {id:'distance',name:'暂时减少共同活动，保持一段距离',traits:{novelty:.5,uncertainty:.6,risk:.3,time_cost:.6},tags:['participate'],conditions:{outdoors:true}},
 {id:'endure',name:'暂时维持安排，继续观察',traits:{long_term_commitment:.3},tags:['preserve_stability'],conditions:{}}
 ];return completeEvent(s,event);}
export function specialEvents(s,cid,defaults){
 const c=s.characters[cid],lc=lifeContext(s,cid),out=[];if(age(s,c)<6)return out;
 const due=lc.terms.find(t=>t.type==='away_from_home_assignment'&&t.due_decision);if(due)out.push({...eventFor(s,'away_review'),long_term_id:due.id});
 if(s.health[cid].value<30&&cooled(s,cid,'health'))out.push(eventFor(s,'health'));
 for(const issue of lc.situations.filter(x=>x.needs_decision))out.push({...eventFor(s,issue.type==='relationship_strain'?'strain':'conflict',issue.participants.find(p=>p!==cid)),situation_id:issue.id});
 if(!currentMarriage(s,cid)&&age(s,c)>=s.config.marriage_min_age&&cooled(s,cid,'marriage')&&random(s)<s.config.marriage_opportunity_frequency){const targets=ensureMarriageCandidates(s,cid);if(targets.length)out.push(eventFor(s,'marriage',selectNPC(s,cid,targets.map(x=>x.character_id),'candidate')));}
 for(let i=0;i<(s.config.special_attempts??2);i++){if(random(s)>=s.config.decision_event_frequency)continue;const content=s.world_id==='ancient'&&s.config.content_enabled!==false?pickContent(s,cid,false):null;if(content){out.push(content);continue;}
 const types=age(s,c)<18?['learning','education']:lc.away?['career','safety','learning']:['learning','career','music','safety','relocation'],pool=types.filter(t=>cooled(s,cid,t));if(pool.length)out.push(eventFor(s,pick(s,pool)));}
 const seen=new Set();return out.filter(e=>{const key=e.event_id||e.situation_id||e.type;if(seen.has(key))return false;seen.add(key);return true;}).map(e=>({...e,event_kind:'SPECIAL_EVENT'}));
}
export const decisionEvent=(s,cid,defaults)=>specialEvents(s,cid,defaults)[0]||null;
