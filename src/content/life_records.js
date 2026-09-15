// Read-only projections of recorded facts. Never invent events or future outcomes.
export function meaningfulEntries(s,cid){
 const out=[];
 for(const log of s.history){
  for(const x of log.remote_followups||log.result?.remote_followups||[])if(x.character_id===cid)out.push({month:x.month,actor:'异地消息',domain:'迁移',title:x.title,result:x.reasons.join('；')});
  if(log.kind==='month'){
   for(const r of log.reports.filter(r=>r.character_id===cid)){
    for(const d of (r.special_events?.length?r.special_events.map(x=>x.decision):[r.background?.decision,r.decision]).filter(Boolean))out.push({month:log.month,actor:'人物决定',title:d.event.title,domain:d.event.category,decision:d.chosen_action,result:d.content_result?.outcome||d.actual_changes?.join('；')||'',event_id:d.event.event_id,details:d.content_result});
    if(r.death)out.push({month:log.month,actor:'人生事实',domain:'健康',title:'死亡',result:r.death.reason});
    for(const dev of r.developments||[])if(dev.kind!=='unchanged')out.push({month:log.month,actor:'状态发展',domain:'家庭',title:dev.type,result:dev.kind+'；程度 '+dev.severity});
   }
   for(const b of log.births||[])if([b.father_id,b.mother_id,b.child_id].includes(cid))out.push({month:log.month,actor:'人生事实',domain:'家庭',title:'子女出生',result:'新人物 '+b.child_id});
  }else if((log.character_id===cid||log.kind==='player_choice'&&log.before?.character?.current_household_id===s.characters[cid]?.current_household_id)&&['player_choice','event','marriage','enroll','employ','succession','inheritance'].includes(log.kind))out.push({month:log.month,actor:log.kind==='player_choice'?'你的决定':'人物决定',domain:log.kind==='player_choice'?'玩家决定':log.result?.event?.category||log.kind,title:(log.kind==='player_choice'&&s.characters[log.character_id]?'〔'+s.characters[log.character_id].surname+s.characters[log.character_id].given_name+'〕':'')+(log.result?.player_choice||log.result?.event?.title||log.kind),character_choice:log.result?.character_choice,result:log.result?.final_outcome||log.result?.decision?.content_result?.outcome||log.result?.immediate_effect||log.result?.actual_changes?.join('；')||log.result?.status||'已记录状态变化',details:log.result?.decision?.content_result});
 }
 return out;
}
export function fiveYearSummaries(s,cid){
 const first=s.history[0]?.month;if(first===undefined)return [];
 const rows=meaningfulEntries(s,cid),out=[];
 for(let start=first;start+59<=s.current_world_month;start+=60){const end=start+59,entries=rows.filter(e=>e.month>=start&&e.month<=end),reports=s.history.filter(e=>e.kind==='month'&&e.month>=start&&e.month<=end).flatMap(e=>e.reports.filter(r=>r.character_id===cid));
  const before=reports[0]?.before,after=reports.at(-1)?.after;
  out.push({start,end,age_from:Math.floor((start-s.characters[cid].birth_month)/12),age_to:Math.floor((end-s.characters[cid].birth_month)/12),entries,decisions:entries.filter(e=>e.actor==='人物决定'),player_decisions:entries.filter(e=>e.actor==='你的决定'),before,after,source:'actual_logs_only'});
 }return out;
}
export function changedFacts(before,after){
 if(!before||!after)return [];
 const rows=[],add=(name,a,b)=>{if(a!==b&&a!==undefined&&b!==undefined)rows.push({name,before:a,after:b});};
 const fields=[['地点',x=>x.character?.current_location_context],['离开原因',x=>x.character?.location_purpose],['家庭资源',x=>x.resources?.household?.household_resources],['个人财产',x=>x.resources?.personal?.personal_inheritable_estate],['健康',x=>x.health?.value],...['stress','mood','fatigue'].map((k,i)=>[['压力','心情','疲劳'][i],x=>x.character?.dynamic[k]]),['婚姻',x=>x.marriages?.find(m=>m.status==='active')?'婚姻共同生活':'无有效婚姻'],['家庭责任',x=>x.household?.responsibilities?.[x.character?.character_id]?.type||'无'],['教育',x=>x.education?x.education.name+' · '+x.education.status:'无'],['职业',x=>x.career?x.career.name+' · '+x.career.status:'无'],['学习进度',x=>x.education?.progress??0],['工作时间',x=>x.career?.time??0],['工资倍率',x=>x.career?.wage??0]];
 fields.forEach(([label,read])=>add(label,read(before),read(after)));
 for(const sk of after.character?.skills||[])add(sk.name+'技能',before.character.skills.find(x=>x.name===sk.name)?.level||0,sk.level);
 for(const rel of after.relationships||[])add('与 '+rel.people.find(id=>id!==after.character.character_id)+' 的关系',before.relationships?.find(x=>x.id===rel.id)?.attitude??0,rel.attitude);
 return rows;
}
