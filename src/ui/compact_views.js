import {pregnancyView,routineLines} from './monthly_views.js';
// Presentation only: no writes, random draws, or changes to stored history.
import {age,date} from '../core/state.js';
import {lifeContext} from '../systems/life_context.js';
import {changedFacts} from '../content/life_records.js';
import {esc,personName,STATE_NAMES,ISSUE_NAMES} from './presentation.js';
const num=x=>typeof x==='number'?Number(x.toFixed(1)):x;
export function characterSummary(s,cid,controlled,full){
 const c=s.characters[cid];if(!c)return full;
 const job=s.careers[cid]?.status==='active'?s.careers[cid].name:s.education[cid]?.status==='active'?s.education[cid].name:'家庭生活',children=Object.values(s.characters).filter(x=>x.biological_parent_ids.includes(cid)).length,m=Object.values(s.marriages).find(x=>x.status==='active'&&x.people.includes(cid)),lc=lifeContext(s,cid),rel=Object.values(s.relationships).find(r=>r.people.includes(cid)&&r.people.includes(controlled));
 return '<div class="person-summary"><h3>'+esc(personName(s,cid))+' · '+age(s,c)+'岁 · '+esc(job)+'</h3><p>'+(m?'已婚':'未婚')+' · '+children+'子女 · '+esc(lc.location.name)+' · '+esc(s.households[c.current_household_id]?.name)+'</p><p>健康 '+num(s.health[cid].value)+' · 压力 '+num(c.dynamic.stress)+' · 家庭资源 '+num(s.resources.households[c.current_household_id]?.household_resources)+'</p>'+pregnancyView(s,cid)+(cid!==controlled?'<p>与你的关系 '+num(rel?.attitude||0)+'</p><button data-return-person>返回控制人物</button>':'')+'<details class="full-person"><summary>'+(cid===controlled?'展开人物':'查看完整人物')+'</summary>'+full+'</details></div>';
}
export function choiceLayers(result){
 if(!result?.player_choice)return '';
 const arr=result.arrangement,decision=result.decision||arr?.child,character=Object.hasOwn(result,'character_choice')?result.character_choice:decision?.chosen_action;
 const final=result.final_outcome||decision?.content_result?.outcome||decision?.actual_changes?.join('；')||result.immediate_effect||'已执行安排';
 return '<div class="choice-layers"><p><strong>你的决定：</strong>'+esc(result.player_choice)+'</p><p><strong>人物反应：</strong>'+esc(character||'此项为家庭直接安排，没有额外的人物决定')+'</p><p><strong>最终结果：</strong>'+esc(final)+'</p>'+((result.arrangement?.responses||[]).map(r=>'<p><strong>'+esc(r.role+' · '+(r.actor_name||''))+'：</strong>'+esc(r.result.character_response||r.result.chosen_action)+'<br>'+r.decision_reasons.map(x=>esc(x.reason)).join('；')+'</p>').join(''))+(result.decision_reasons?.length?'<p><strong>为什么：</strong>'+result.decision_reasons.map(x=>esc(x.reason)).join('；')+'</p>':'')+'</div>';
}
const primary=e=>e.reports?.find(r=>r.character_id===e.control_character_id)||e.reports?.[0];
export function featuredReport(e){const main=primary(e);return e.reports?.find(r=>r.death)||(main?.important?main:e.reports?.find(r=>r.important))||main;}

export function importantEntry(e){return e.kind!=='month'||e.notices?.length||e.births?.length||e.reports?.some(r=>r.death||r.player_opportunity?.waiting||r.decision||r.developments?.some(d=>d.kind!=='unchanged')||r.diff?.some(d=>['education.status','career.status','career.id'].includes(d.path)));}
function summaryFacts(e){const r=featuredReport(e),facts=e.result?.decision?.content_result||r?.decision?.content_result||r?.background?.decision?.content_result;return changedFacts(facts?.before||e.before||r?.before,facts?.after||e.after||r?.after);}
function shortChanges(s,rows){return rows.slice(0,3).map(r=>{let label=r.name;Object.keys(s.characters).forEach(id=>label=label.replace(id,personName(s,id)));return esc(label)+' '+(typeof r.before==='number'&&typeof r.after==='number'?((r.after-r.before>=0?'+':'')+num(r.after-r.before)):esc(num(r.before))+' → '+esc(num(r.after)));}).join(' · ');}
export function timelineView(s,history,offset,details,title){
 const years=new Map();history.forEach((e,i)=>{const y=Math.floor(e.month/12);if(!years.has(y))years.set(y,[]);years.get(y).push({e,index:offset+i});});
 const card=({e,index})=>{const r=featuredReport(e),result=e.result?.final_outcome||e.result?.decision?.content_result?.outcome||e.result?.chosen_action||r?.decision?.chosen_action||r?.background?.decision?.chosen_action||e.result?.player_choice||routineLines(r).slice(0,3).join(' · ')||r?.defaults?.primary?.name||'',important=importantEntry(e);return '<details class="timeline-node '+(important?'important-node':'ordinary-node')+'" data-entry-index="'+index+'"><summary><small>'+date(e.month)+'</small> <strong>'+esc((e.kind==='month'&&r?.character_id!==e.control_character_id?personName(s,r.character_id)+' · ':'')+title(e))+'</strong><span class="node-result">'+(e.kind==='player_choice'?'最终结果：':r?.decision||r?.background?.decision?'人物最终决定：':'')+esc(result)+'</span><span class="node-changes">'+shortChanges(s,summaryFacts(e))+'</span><span class="expand-label">展开</span></summary>'+details(e,index)+'</details>';};
 return [...years].reverse().map(([year,rows])=>{
  const groups=[];for(const row of rows){const last=groups.at(-1);if(!importantEntry(row.e)&&last?.ordinary&&row.e.month===last.rows.at(-1).e.month+1)last.rows.push(row);else groups.push({ordinary:!importantEntry(row.e),rows:[row]});}
  const body=groups.reverse().map(g=>{if(g.rows.length===1)return card(g.rows[0]);const first=primary(g.rows[0].e),last=primary(g.rows.at(-1).e),changes=changedFacts(first?.before,last?.after);return '<details class="month-run"><summary><strong>'+date(g.rows[0].e.month)+'～'+date(g.rows.at(-1).e.month)+'</strong> · 生活整体稳定<span class="node-changes">'+shortChanges(s,changes)+'</span><small>'+g.rows.length+'个月 · 展开逐月原始记录</small></summary>'+g.rows.slice().reverse().map(card).join('')+'</details>';}).join('');
  return '<details class="timeline-year" data-year="'+year+'" '+(year===Math.floor(s.current_world_month/12)?'open':'')+'><summary>'+year+'年 · '+rows.filter(x=>importantEntry(x.e)).length+'件重要经历'+(year===Math.floor(s.current_world_month/12)?' · 当前':'')+'</summary>'+body+'</details>';
 }).join('')||'<p>推进生活，开始记录人生。</p>';
}
export function storyThreads(s,cid){
 if(!cid)return '';
 const issues=Object.values(s.ongoing_situations||{}).filter(x=>x.participants.includes(cid)),terms=Object.values(s.long_term_states||{}).filter(x=>x.character_id===cid&&x.type!=='content_theme');
 const stateLabel=x=>({active:'进行中',resolved:'已解决',ended:'已结束',paused:'暂缓'})[x]||x;
 return '<details class="story-threads"><summary>长期故事 · '+(issues.length+terms.length)+'段安排与处境</summary>'+issues.map(x=>'<details><summary>'+esc(ISSUE_NAMES[x.type]||x.causes?.[0]||'持续处境')+' · '+stateLabel(x.status)+'</summary><p>'+date(x.start_month)+' ～ '+(x.end_month?date(x.end_month):'现在')+'</p>'+x.development_history.map(d=>'<p>'+date(d.month)+' · '+esc(({started:'问题出现',improved:'有所改善',worsened:'情况恶化',resolved:'问题解决',decision:'作出回应'})[d.kind]||d.action||d.kind)+(d.severity===undefined?'':' · 程度 '+d.severity)+'</p>').join('')+'</details>').join('')+terms.map(t=>'<details><summary>'+esc(STATE_NAMES[t.type]||'长期安排')+' · '+stateLabel(t.status)+'</summary><p>'+date(t.start_month)+' ～ '+(t.status==='active'?'现在':'已结束（详见月度记录）')+'</p>'+t.default_behavior_effects.map(x=>'<p>'+esc(x)+'</p>').join('')+'</details>').join('')+'</details>';
}
