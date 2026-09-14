import {contentFeasibility,contentImpact} from '../content/event_runtime.js';
import {id} from '../core/rng.js';
import {age} from '../core/state.js';
import {cooled,recordEvent} from './life_context.js';
import {marriageCandidates} from './marriage.js';
export const inPlayerFamily=(s,cid)=>{const control=s.characters[s.control.current_control_character_id];return !!control&&s.characters[cid]?.current_household_id===control.current_household_id;};
export function queuePlayerEvent(s,type,cid,payload={}){
 if(s.player_decision_events.some(e=>e.status==='pending'&&e.type===type&&e.character_id===cid))return null;
 const event={id:id(s,'player'),kind:'PLAYER_DECISION_EVENT',type,character_id:cid,month:s.current_world_month,payload:structuredClone(payload),status:'pending'};
 s.player_decision_events.push(event);return event;
}
export function pendingDecision(s){
 if(s.control.pending?.candidates.length)return {kind:'PLAYER_DECISION_EVENT',id:'succession:'+s.control.pending.deceased_id,type:'succession',payload:s.control.pending};
 const estate=Object.values(s.inheritances).find(p=>p.status==='awaiting_player');if(estate)return {kind:'PLAYER_DECISION_EVENT',id:'inheritance:'+estate.deceased_id,type:'inheritance',payload:estate};
 return (s.player_decision_events||[]).find(e=>e.status==='pending'&&s.characters[e.character_id]?.alive)||null;
}
export function needsPlayer(s,cid,event){
 if((event.type==='marriage'||event.content_template&&event.terminal_outcomes.some(o=>o.effects.some(e=>e.kind==='marriage')))&&!inPlayerFamily(s,cid)&&inPlayerFamily(s,event.target_id)){const initiator=cid;cid=event.target_id;event={...event,target_id:initiator,incoming_initiator_id:initiator};}
 if(!inPlayerFamily(s,cid))return false;
 if(event.content_template){if(event.importance!=='major')return false;if(!cooled(s,cid,'player:content',s.config.player_event_cooldown))return 'cooldown';queuePlayerEvent(s,'content',cid,{event});recordEvent(s,cid,'player:content');return true;}
 const major=['education','career','relocation','marriage','health','conflict','away_review'].includes(event.type);
 if(!major)return false;if(!cooled(s,cid,'player:'+event.type,s.config.player_event_cooldown))return 'cooldown';
 const hid=s.characters[cid].current_household_id,students=s.households[hid].members.filter(x=>s.education[x]?.status==='active');const type=event.type==='conflict'&&students.length>1&&s.resources.households[hid].household_resources<s.config.opportunity_cost*2?'resource':event.type;queuePlayerEvent(s,type,cid,{event});recordEvent(s,cid,'player:'+event.type);return true;
}
export const windowAvailable=s=>s.current_world_month-s.player.window_last_month>=s.config.player_window_months;
export function openPlayerWindow(s,direction,cid){
 if(pendingDecision(s))throw Error('请先完成当前玩家决定');
 if(!windowAvailable(s))throw Error('主动介入窗口尚未到来');
 if(!inPlayerFamily(s,cid)||!s.characters[cid].alive)throw Error('请选择当前家庭的存活成员');
 if(!['education','career','relocation','marriage','resource','care'].includes(direction))throw Error('未知介入方向');
 s.player.window_last_month=s.current_world_month;
 return queuePlayerEvent(s,direction,cid,{proactive:true});
}
const names=(s,cid)=>s.characters[cid].surname+s.characters[cid].given_name;
export function playerChoices(s,e){
 const c=s.characters[e.character_id],hid=c?.current_household_id,funds=s.resources.households[hid]?.household_resources||0,cost=s.config.opportunity_cost;
 const choice=(id,label,impact,extra={})=>({id,label,impact,feasible:true,...extra});
 if(e.type==='content')return e.payload.event.mock_actions.filter(a=>a.conditions.action_type==='terminal_action'&&a.id!=='leave_current').map(a=>choice(a.id,'支持：'+a.name,contentImpact(a),{feasible:!contentFeasibility(s,e.character_id,e.payload.event,{action_id:a.id}),reason:contentFeasibility(s,e.character_id,e.payload.event,{action_id:a.id})})).concat(choice('skip','保留现有安排','不投入本次资源；不启动该机会'));
 if(e.type==='succession')return e.payload.candidates.map(p=>choice(p.character_id,names(s,p.character_id),'直接切换下一位控制角色；不决定财产分配'));
 if(e.type==='inheritance')return e.payload.eligible.map(cid=>choice(cid,names(s,cid),'指定主财产继承人；多子女60/40，单子女100%'));
 if(e.type==='force')return [choice('force','使用一次强制干预','只覆盖本人对当前安排的拒绝；消耗一次机会，可能增加压力和关系损伤',{feasible:s.player.force_credits>0,reason:'强制机会不足'}),choice('respect','尊重此次拒绝','本次不执行安排；保留之后的自主生活')];
 if(e.type==='marriage')return marriageCandidates(s,e.character_id).filter(x=>!x.reason&&s.characters[x.character_id].sex!==c.sex).sort((a,b)=>Number(b.character_id===e.payload.event?.target_id)-Number(a.character_id===e.payload.event?.target_id)).slice(0,s.config.marriage_candidate_count).map(x=>choice(x.character_id,'重点推动与'+names(s,x.character_id)+'议亲','提供具体婚配机会；本人、对象及家庭继续独立回应',{target_id:x.character_id})).concat(choice('skip','暂不推动婚配','保留人物与关系，暂不支付婚配费用'));
 if(e.type==='resource')return Object.values(s.characters).filter(x=>x.alive&&x.current_household_id===hid&&age(s,x)>=6).map(x=>choice(x.character_id,'优先支持'+names(s,x.character_id)+'学习','投入 '+cost+' 家庭资源；其他成员降低额外教育投入，为此人提供教育机会',{feasible:funds>=cost,reason:'家庭资源不足',target_id:x.character_id})).concat([choice('share','所有人降低额外投入','降低现有教育时间和费用，保留基础学习'),choice('skip','暂停额外教育投入','现有额外教育暂停，资源留在家庭')]);
 if(e.type==='care'||e.type==='conflict')return [choice('redistribute','重新分配家庭照护','优先寻找可承担责任的同住成年人；无接替者时减少工作时间'),choice('reduce','降低工作时间，优先照护','工作时间与收入下降，缓解职责冲突'),choice('work','优先稳定家庭收入','为适龄成员提供职业机会，随后由本人回应'),choice('skip','暂时保持安排','不改变职责，问题继续按实际状态发展')];
 if(e.type==='health')return [choice('treat','投入家庭资源医治','支付 '+s.config.major_treatment_cost+'；健康恢复 '+s.config.major_treatment_gain+'（Mock），不保证未来健康',{feasible:funds>=s.config.major_treatment_cost,reason:'家庭资金不足'}),choice('rest','承担照护，支持休养','减少当前工作与教育时间，家计收入可能下降')];
 if(e.type==='away_review')return [choice('support','支持本人重新选择去留','提供返回、续期、定居、转换道路的可行机会；人物自主决定'),choice('return_offer','重点支持返回家庭','提供回乡支持；普通推动不会覆盖拒绝')];
 return [choice('support','投入家庭资源支持'+names(s,e.character_id),'支付 '+cost+'；提供'+(e.type==='education'?'长期教育':e.type==='relocation'?'离乡发展':'职业发展')+'机会，人物随后仍可拒绝',{feasible:funds>=cost,reason:'家庭资金不足'}),choice('skip','不提供本次额外支持','不支付资源、不启动该机会；保留现有生活')];
}
