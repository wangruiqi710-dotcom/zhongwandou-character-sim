import {age,date} from '../core/state.js';
import {lifeContext,coResident} from '../systems/life_context.js';
import {defaultBehaviors} from '../systems/default_behavior.js';
import {currentMarriage} from '../systems/marriage.js';
export const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const personName=(s,id)=>{const c=s.characters[id];return c?c.surname+c.given_name:'暂无';};
const link=(s,id)=>s.characters[id]?'<button class="person-link" data-person="'+esc(id)+'">'+esc(personName(s,id))+'</button>':'暂无';
const section=(title,body)=>'<details><summary>'+title+'</summary>'+body+'</details>';
const p=(key,value)=>'<p><strong>'+key+'：</strong>'+value+'</p>';
export const STATE_NAMES={education:'学习安排',career:'职业安排',short_trial:'短期试学',away_from_home_assignment:'离乡工作',local_settlement:'当地定居',marriage:'婚姻共同生活',infant_care:'幼儿照护',pregnancy:'孕育',forced_adjustment:'强制安排后的适应',temporary_distance:'暂时减少共同活动',family_support:'家庭支持',health_recovery:'休养',safe_route:'安全路线'};
export const ISSUE_NAMES={financial_strain:'家庭经济困难',family_conflict:'责任与家计冲突',relationship_strain:'关系持续紧张',marriage_negotiation:'议亲'};
const statusName=x=>({active:'进行中',ended:'已结束',resolved:'已解决',paused:'已暂停',completed:'已完成',refused:'本人拒绝',other_refused:'对方拒绝',delayed:'暂缓议亲',married:'婚姻成立',blocked:'现实条件不满足',force_failed:'强制未执行',started:'开始',worsened:'明显恶化',improved:'有所改善',unchanged:'本月无明显变化',decision:'已作出回应'})[x]||'已有记录';
export function characterCard(s,cid,controlled){
 const c=s.characters[cid];if(!c)return '<p>控制线暂停，等待接班选择。</p>';
 const lc=lifeContext(s,cid),h=s.households[c.current_household_id],m=currentMarriage(s,cid),spouse=m?.people.find(x=>x!==cid);
 const children=Object.values(s.characters).filter(x=>x.biological_parent_ids.includes(cid)||x.adoptive_parent_ids.includes(cid)),parents=[...c.biological_parent_ids,...c.adoptive_parent_ids];
 const proposals=s.marriage_proposal_history.filter(x=>x.initiator_character_id===cid||x.candidate_character_id===cid),d=defaultBehaviors(s,cid),num=x=>Number(x||0).toFixed(1);
 const fields=(obj,labels)=>Object.entries(labels).map(([k,label])=>p(label,esc(obj[k]??'暂无'))).join('');
 return (cid!==controlled?'<p>正在查看家庭或关系人物，不会切换控制角色。</p><button data-return-person>返回控制人物</button>':'')+
 '<h3>'+esc(personName(s,cid))+' · '+age(s,c)+'岁 · '+esc(c.sex)+' · '+(c.alive?'存活':'已故')+'</h3>'+
 p('当前地点',esc(lc.location.name))+p('家庭',esc(h?.name||'暂无'))+p('家族谱系',parents.length?parents.map(x=>link(s,x)).join('、'):'本测试中的创始人物')+
 p('教育',esc(s.education[cid]?s.education[cid].name+' · '+statusName(s.education[cid].status):'无'))+p('职业',esc(s.careers[cid]?s.careers[cid].name+' · '+statusName(s.careers[cid].status):'无'))+
 p('婚姻',m?'已婚 · 配偶 '+link(s,spouse):'未婚 / 当前无有效婚姻')+p('子女',children.length+'人 '+children.map(x=>link(s,x.character_id)).join('、'))+
 p('家庭资源 / 个人可继承财产',num(s.resources.households[c.current_household_id]?.household_resources)+' / '+num(s.resources.personal[cid]?.personal_inheritable_estate))+
 p('体质（先天基础）',num(c.physiology.constitution))+p('先天生育基础 fertility_base',num(c.physiology.fertility_basis))+p('健康 / 压力 / 心情 / 疲劳',[s.health[cid].value,c.dynamic.stress,c.dynamic.mood,c.dynamic.fatigue].map(num).join(' / '))+
 section('人物属性',fields(c.talents,{intelligence:'智力',social:'社交',athletic:'运动',stress_resistance:'抗压',curiosity:'好奇心'})+fields(c.personality,{extraversion:'外向性',intuition:'直觉性',thinking:'思考性',planning:'计划性',risk_orientation:'谨慎 ←→ 大胆（MOCK_DESIGN_CANDIDATE）'})+p('MBTI（仅展示）',(c.personality.extraversion>=50?'E':'I')+(c.personality.intuition>=50?'N':'S')+(c.personality.thinking>=50?'T':'F')+(c.personality.planning>=50?'J':'P'))+p('兴趣',c.interests.map(i=>esc(i.name)+' '+i.intensity).join('、'))+p('人生目标',esc(c.life_goal||'尚未生成'))+p('技能',c.skills.map(i=>esc(i.name)+' '+i.level.toFixed(1)).join('、')||'暂无'))+
 section('教育与职业',p('教育状态',s.education[cid]?esc(s.education[cid].name)+' · '+statusName(s.education[cid].status)+' · '+date(s.education[cid].start_month)+'开始':'无')+p('教育长期安排',lc.terms.filter(t=>t.source?.system==='education').map(t=>date(t.start_month)+'开始 / '+t.expected_duration+'个月预期').join('、')||'无')+p('职业开始',s.careers[cid]?date(s.careers[cid].start_month):'无')+p('主要默认行为',esc(d.primary?.name||'无'))+p('次要默认行为',d.secondary.map(a=>esc(a.name)).join('、')||'无')+p('技能',c.skills.map(k=>esc(k.name)+' '+num(k.level)).join('、')||'暂无'))+
 section('家庭与婚姻',p('父亲',link(s,c.biological_parent_ids[0]))+p('母亲',link(s,c.biological_parent_ids[1]))+p('养父母',c.adoptive_parent_ids.map(x=>link(s,x)).join('、')||'暂无')+p('子女',children.map(x=>link(s,x.character_id)+' · '+age(s,x)+'岁 · '+esc(x.sex)+' · '+(x.alive?'存活':'已故')).join('<br>')||'暂无')+p('当前议亲状态',Object.values(s.ongoing_situations).filter(x=>x.type==='marriage_negotiation'&&x.participants.includes(cid)&&x.status==='active').map(x=>'与'+link(s,x.participants.find(y=>y!==cid))+'继续议亲').join('、')||'暂无')+p('父母',parents.map(x=>link(s,x)).join('、')||'暂无')+p('同家庭成员',h.members.filter(x=>x!==cid).map(x=>link(s,x)).join('、')||'暂无')+
 p('持续指导者',c.mentor_character_id?link(s,c.mentor_character_id):'暂无')+p('近期议亲对象',[...new Set(proposals.map(x=>x.initiator_character_id===cid?x.candidate_character_id:x.initiator_character_id))].map(x=>link(s,x)).join('、')||'暂无')+
 '')+
 section('关系',Object.values(s.relationships).filter(r=>r.people.includes(cid)).map(r=>{const other=r.people.find(x=>x!==cid),kin=parents.includes(other)||children.some(x=>x.character_id===other);return p('关系',link(s,other)+' · '+(other===spouse?'配偶':kin?'亲子':other===c.mentor_character_id?'指导关系':'熟人')+' · 态度 '+num(r.attitude)+' / 强度 '+num(r.strength)+' · '+(coResident(s,cid,other)?'同住':'不同住'));}).join('')||'<p>暂无</p>')+
 section('长期状态',Object.values(s.long_term_states).filter(t=>t.character_id===cid).map(t=>p(STATE_NAMES[t.type]||'生活安排',date(t.start_month)+'起 / '+(t.expected_duration===null?'持续':t.expected_duration+'个月')+' / '+statusName(t.status)+'；'+esc(t.default_behavior_effects.join('、')))).join('')||'<p>暂无</p>')+
 section('持续问题',Object.values(s.ongoing_situations).filter(x=>x.participants.includes(cid)).map(x=>p(ISSUE_NAMES[x.type]||'持续处境',date(x.start_month)+'起 / 严重程度 '+x.severity+' / '+statusName(x.status)+'；最近：'+statusName(x.development_history.at(-1)?.kind)+(x.needs_decision?'；需要重新决定':''))).join('')||'<p>暂无</p>')+
 section('当前现实状态',p('是否与家庭共同生活',lc.co_resident?'是':'否；家庭联系改为远程')+p('主要默认行为',esc(d.primary?.name||'无'))+p('其他默认行为',d.secondary.map(a=>esc(a.name)).join('、')||'无')+p('教育 / 工作 / 照护占用',[lc.education_time,lc.career_time,lc.care_time].map(x=>(x*100).toFixed(0)+'%').join(' / '))+p('可用时间',(lc.available_time*100).toFixed(0)+'%')+p('资源限制',s.resources.households[c.current_household_id]?.household_resources<0?'家庭已出现资金缺口':'需要逐项检查机会成本'))+
 section('高级调试信息','<pre>'+esc(JSON.stringify(c,null,2))+'</pre>');
}
export function decisionText(d){
 if(!d?.candidate_actions||d.event?.decision_owner==='player')return '';
 if(d.player_direct)return p('执行方式','玩家权限范围内直接执行，不进行普通接受或拒绝抽样')+p('人物反应',esc(d.character_response))+p('为什么',(d.decision_reasons||[]).map(r=>esc(r.reason)).join('；'));
 const stages=d.stages||[d];
 return p('这次要决定什么',esc(d.event?.decision_goal||d.event?.description||'处理当前机会'))+
 stages.map((stage,i)=>'<div class="decision-stage"><h4>第'+(i+1)+'阶段</h4>'+p('人物考虑过',stage.candidate_actions.map(a=>esc(a.action)+'：'+a.probability+'%').join('<br>'))+
 p('哪些选择不可行',stage.excluded_actions.map(a=>esc(a.action)+'：'+esc(a.exclusion_reason)).join('<br>')||'无')+
 p('人物更倾向哪些选择',stage.candidate_actions.slice().sort((a,b)=>b.probability-a.probability).slice(0,2).map(a=>esc(a.action)+'（'+a.probability+'%）').join('、'))+
 p('支持这个选择的原因',(stage.candidate_actions.find(a=>a.action_id===stage.chosen_action_id)?.supporting_reasons||[]).map(r=>esc(r.reason)).join('；')||'没有明显支持理由')+p('阻碍这个选择的原因',(stage.candidate_actions.find(a=>a.action_id===stage.chosen_action_id)?.opposing_reasons||[]).map(r=>esc(r.reason)).join('；')||'没有明显阻碍因素')+p('本阶段抽取',esc(stage.chosen_action))+(stage.candidate_actions.find(a=>a.action_id===stage.chosen_action_id)?.action_type==='transition_action'?p('取得的事实','已核实费用 '+d.facts?.cost+'，预计 '+d.facts?.duration+'个月，时间占用 '+Math.round((d.facts?.time||0)*100)+'%'):'')+'</div>').join('')+
 (d.force?.executed?p('强制当前安排','本次由玩家覆盖当前安排；压力 '+Number(d.force.before.stress).toFixed(1)+' → '+Number(d.force.after.stress).toFixed(1)+'。之后仍继续自主生活。'):'')+p('人物最终决定',esc(d.force&&!d.force.executed?'强制未执行：'+d.force.reason:d.chosen_action))+p('这件事真正改变了什么',(d.actual_changes||['具体系统结果见下方安排记录']).map(esc).join('；'));
}
export function explainEntry(s,e){
 const reports=e.reports||[],r=reports.find(x=>x.character_id===e.control_character_id)||reports[0],result=e.result||{},arr=result.arrangement||r?.arrangement||(result.kind==='marriage_arrangement'?result:null);
 const decision=arr?.child||result.decision||r?.decision||result.child||(result.event?result:null);
 return p('这个月发生了什么',esc(decision?.event?.title||r?.player_opportunity?.event?.title||result.player_choice||r?.defaults?.primary?.name||'处理家庭与人生状态'))+
 p('为什么会发生',r?.player_opportunity?'当前机会需要家庭决定资源或长期安排':r?.developments?.some(x=>x.needs_decision)?'持续问题达到重新安排的条件':decision?esc(decision.event.description):'根据已保存的月度状态或玩家操作执行')+
 (r?.defaults?p('人物原本在做什么',esc(r.defaults.primary?.name||'无')):'')+
 (result.player_choice?p('你的决定',esc(result.player_choice))+p('预计立即影响',esc(result.immediate_effect)):'')+
 decisionText(decision)+(arr?.responses?arr.responses.map(r=>p(r.role+' · '+esc(personName(s,r.actor_id)),esc(r.result.character_response||r.result.chosen_action))+p('为什么',r.decision_reasons.map(x=>esc(x.reason)).join('；')||'没有明显阻碍因素')+'<details><summary>查看该主体的支持与阻碍</summary>'+decisionText(r.result)+'</details>').join(''):'')+
 (arr?p('具体婚配双方',link(s,arr.initiator_character_id)+' 与 '+link(s,arr.candidate_character_id))+p('婚配结果',esc(arr.final_outcome||statusName(arr.status))+(arr.reason?'：'+esc(arr.reason):''))+p('本人回应',esc(arr.child?.chosen_action||'无'))+p('候选本人回应',esc(arr.other?.chosen_action||'无'))+p('候选家庭回应',esc(arr.family?.chosen_action||'无')):'')+
 (e.kind==='death'||r?.death?p('死亡事实',esc(r?.death?.reason||result.reason||'已确认死亡；停止活动并处理接班和继承')):'')+(result.inheritance?p('实际遗产分配',Object.entries(result.inheritance.distribution||{}).map(([id,v])=>link(s,id)+'：'+v).join('、')):'')+(result.selected?p('新的控制角色',link(s,result.selected)):'')+(result.resource_change?p('实际资源变化',result.resource_change.before+' → '+result.resource_change.after):'')+
 (r?.developments||[]).map(x=>p(ISSUE_NAMES[x.type]||'持续处境',statusName(x.kind)+'；严重程度 '+x.severity)).join('')+
 (e.births||[]).map(b=>p('新人物出生',link(s,b.child_id)+'；父母 '+link(s,b.father_id)+'、'+link(s,b.mother_id))).join('')+
 (e.resource_changes||[]).filter(x=>x.household_id===r?.after?.character?.current_household_id).map(x=>p('家庭资源',x.before.toFixed(1)+' → '+x.after.toFixed(1)+'；本月收入 '+x.income.toFixed(1)+'，支出 '+x.expenses.toFixed(1))).join('');
}
