import {random,pick,bound,integer} from '../core/rng.js';
import {age} from '../core/state.js';
import {changeRelationship} from './relationships.js';
import {currentMarriage,marriageCandidates} from './marriage.js';
import {reproductionConditions} from './reproduction.js';
import {createCharacter} from './character_generation.js';
import {createHousehold} from './household.js';
import {employ} from './education_career.js';
export function backgroundCandidates(s,cid){const c=s.characters[cid],h=s.households[c.current_household_id],out=[];if(s.education[cid]?.status==='active')out.push({id:'education',title:'学习中掌握了一个小窍门',tags:['education'],system:'education'});if(s.careers[cid]?.status==='active')out.push({id:'work',title:'日常工作得到一点肯定',tags:['career'],system:'careers'});if(h.members.filter(id=>id!==cid&&s.characters[id].alive).length)out.push({id:'family',title:'共同生活中的一次分担',tags:['family'],system:'households'});const r=Object.values(s.relationships).find(r=>r.people.includes(cid)&&r.people.every(id=>s.characters[id].alive));if(r)out.push({id:'relationship',title:'与熟人有了一次简短交流',tags:['social'],system:'relationships',target_id:r.people.find(id=>id!==cid)});return out;}
export function triggerBackground(s,cid,candidates){const roll=random(s);if(!candidates.length||roll>=s.config.background_event_frequency)return {roll,event:null};const e=pick(s,candidates),delta=(random(s)<.7?1:-1)*s.config.background_delta;const c=s.characters[cid];c.dynamic.mood=bound(c.dynamic.mood+delta);if(e.target_id)changeRelationship(s,cid,e.target_id,delta,e.title);return {roll,event:e,delta};}
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
};const [title,description,category,goal_tags,cost]=table[type]||table.learning;const event={type,title,description,category,goal_tags,tags:[type],cost,target_id,world_id:s.world_id,source:'MOCK_ONLY',conditions:{contract_terms_known:true,information_verified:true}};
 if(type==='strain')event.mock_actions=[
 {id:'discuss',name:'留在家中协商共同生活分工',traits:{relationship_care:1,planning_need:.6,time_cost:.4},tags:['family_priority','participate'],conditions:{}},
 {id:'seek_support',name:'向可信赖的亲友寻求调解',traits:{social_exposure:.7,relationship_care:.7,time_cost:.3},tags:['social','verify'],conditions:{requires_companion:true}},
 {id:'distance',name:'暂时减少共同活动，保持一段距离',traits:{novelty:.5,uncertainty:.6,risk:.3,time_cost:.6},tags:['participate'],conditions:{outdoors:true}},
 {id:'endure',name:'暂时维持安排，继续观察',traits:{long_term_commitment:.3},tags:['preserve_stability'],conditions:{}}
 ];return event;}
export function decisionEvent(s,cid,defaults){const c=s.characters[cid],h=s.resources.households[c.current_household_id];if(age(s,c)<6)return null;
 if(s.health[cid].value<30)return eventFor(s,'health');
 if(defaults.conflict||h.unfunded_months>=s.config.household_conflict_months)return eventFor(s,'conflict');
 const m=currentMarriage(s,cid),r=m&&Object.values(s.relationships).find(r=>m.people.every(id=>r.people.includes(id)));
 if(m&&c.dynamic.stress>s.config.stress_trigger&&r?.attitude<s.config.relationship_conflict_trigger)return eventFor(s,'strain',m.people.find(id=>id!==cid));
 if(!m&&age(s,c)>=s.config.marriage_min_age&&random(s)<s.config.marriage_opportunity_frequency){let targets=marriageCandidates(s,cid).filter(x=>!x.reason&&s.characters[x.character_id].sex!==c.sex);
 if(!targets.length&&cid===s.control.current_control_character_id&&Object.values(s.characters).filter(c=>c.alive).length<s.config.contact_population_limit){const hid=createHousehold(s,'新接触的家庭'),contact=createCharacter(s,{age_years:Math.max(s.config.marriage_min_age,age(s,c)+integer(s,-s.config.contact_age_spread,s.config.contact_age_spread)),sex:c.sex==='女'?'男':'女',household_id:hid});s.resources.households[hid].household_resources=s.config.marriage_cost*2;employ(s,contact.character_id,1);targets=marriageCandidates(s,cid).filter(x=>x.character_id===contact.character_id&&!x.reason);}
 if(targets.length)return {...eventFor(s,'strain',pick(s,targets).character_id),type:'marriage',title:'接触到新的婚配机会',description:'现实生活中出现可商议的长期婚配机会。',category:'婚配',goal_tags:['marriage']};}
 if(m){const other=m.people.find(id=>id!==cid);if(!reproductionConditions(s,cid,other)&&random(s)<s.config.reproduction_frequency)return eventFor(s,'birth',other);}
 if(random(s)>=s.config.decision_event_frequency)return null;
 return eventFor(s,age(s,c)<18?'learning':s.careers[cid]?.status==='active'?'career':pick(s,['learning','career','music','safety']));
}
