import {activeLocationContext,locationOf,sameLocation,isSameLocationAsHousehold,PURPOSE_LABELS} from '../systems/location_context.js';
import {date} from '../core/state.js';
import {esc,personName} from './presentation.js';
export function activeLocationView(s){const l=activeLocationContext(s);return l?'<p class="location-badge">当前生活环境：<strong>'+esc(l.name)+'</strong> · '+esc(PURPOSE_LABELS[l.purpose]||'生活')+'</p>':'';}
export function personLocationView(s,cid){
 const l=locationOf(s,cid),c=s.characters[cid];if(!l)return '';const active=s.control.current_control_character_id,remote=active&&cid!==active&&!sameLocation(s,cid,active),t=s.remote_life_threads?.[c.remote_thread_id],elapsed=Math.max(0,s.current_world_month-l.start_month);
 if(!remote&&l.context==='home'&&l.expected_duration===null)return '';
 const duration=l.expected_duration!==null&&l.expected_duration!==undefined?elapsed+' / '+l.expected_duration+'个月':elapsed+'个月 · 无固定期限';
 return '<div class="location-summary"><p>'+esc(PURPOSE_LABELS[l.purpose]||'生活')+' · '+duration+(remote?' · 与你异地':'')+'</p>'+(remote?'<details><summary>异地近况 · '+esc(t?.followups.at(-1)?.title||'尚无新消息')+'</summary><p>家庭归属保留 · '+(isSameLocationAsHousehold(s,cid)?'在家庭驻地':'不在家庭驻地')+' · '+(l.return_expected?'预计返回':'未安排返回')+'</p><p>当前生活：'+esc(t?.current_phase||'生活继续推进')+'</p>'+remoteMessages(s,t?.followups)+'</details>':'')+'</div>';

}
export function remoteMessages(s,rows=[]){return rows.map(x=>'<details class="remote-message"><summary>'+date(x.month)+' · '+esc(x.title)+' · '+esc(personName(s,x.character_id))+'</summary><button data-person="'+esc(x.character_id)+'">查看人物</button>'+x.reasons.map(r=>'<p>'+esc(r)+'</p>').join('')+'</details>').join('');}
