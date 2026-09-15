import {clone} from '../core/state.js';
import {decide,engine} from '../systems/behavior.js';
import {eventFor} from '../systems/events.js';
import {random} from '../core/rng.js';
import {GOALS} from '../config/mock_tunables.js';
export const ATTRIBUTES={extraversion:'外向性',intuition:'直觉性',thinking:'思考性',planning:'计划性',risk_orientation:'谨慎 ←→ 大胆（Mock候选）',interest:'音乐兴趣',goal:'人生目标类别',resources:'资源水平',stress:'压力',relationship:'关系态度'};
export function point(state,cid,type,attribute,value){const s=clone(state),c=s.characters[cid];if(Object.hasOwn(c.personality,attribute))c.personality[attribute]=value;
 else if(attribute==='interest')c.interests=[{name:'音乐',intensity:value,source:'MOCK_ONLY'}];
 else if(attribute==='goal')c.life_goal=value;
 else if(attribute==='resources')s.resources.households[c.current_household_id].household_resources=value*10;
 else if(attribute==='stress')c.dynamic.stress=value;
 else if(attribute==='relationship')for(const r of Object.values(s.relationships).filter(r=>r.people.includes(cid)))r.attitude=value*2-100;
 const target=Object.values(s.relationships).find(r=>r.people.includes(cid))?.people.find(x=>x!==cid);const event=eventFor(s,type,target);return {value,...decide(s,cid,event,{noise:false,draw:0})};}
export function scan(s,cid,type,attribute){return (attribute==='goal'?GOALS:Array.from({length:11},(_,i)=>i*10)).map(v=>point(s,cid,type,attribute,v));}
export async function samples(actions,count,seed){const s={rng_state:seed>>>0},counts=Object.fromEntries(actions.map(a=>[a.action_id,0]));for(let i=0;i<count;i++){counts[engine().sampleAction(actions,random(s)).action_id]++;if(i%250===249)await new Promise(r=>setTimeout(r,0));}return actions.map(a=>({action:a.action,theory:a.probability,actual:counts[a.action_id]/count*100,error:counts[a.action_id]/count*100-a.probability}));}
export function healthChecks(rows){const peak=Math.max(...rows.flatMap(r=>r.candidate_actions.map(a=>a.probability))),first=rows[0],last=rows.at(-1),map=r=>Object.fromEntries(r.candidate_actions.map(a=>[a.action_id,a.probability]));const a=map(first),b=map(last),span=Math.max(...Object.keys(a).map(k=>Math.abs(a[k]-(b[k]||0))));return [rows.every(r=>r.candidate_actions.reduce((s,a)=>s+a.probability_units,0)===1000)?'通过：概率合计100%':'错误：概率和不正确',peak>85?'警告：单属性支配过强':'通过：没有超过85%',span<3?'观察：属性影响可能过弱或与事件无关':'可观察差异：'+span.toFixed(1)+'个百分点','可行性阈值变化允许不连续；纯偏好扫描应平滑。'];}
