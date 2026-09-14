// Explicit test inputs only. Production never supplies a player choice.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
vm.runInThisContext(['worlds.js','src/core/legacy_bridge.js','decisions.js'].map(f=>fs.readFileSync(path.join(root,f),'utf8')).join('\n'));
(async()=>{
 const {fixture}=await import('../src/testing/test_cases.js'),{newRun,step,replay}=await import('../src/testing/run.js');
 const {ANCIENT_EVENTS}=await import('../src/content/ancient_events.js'),{instantiateContent,contentContext}=await import('../src/content/event_runtime.js');
 const {needsPlayer,playerChoices,pendingDecision,playerDecisionType}=await import('../src/systems/player_decisions.js');
 const {eventFor}=await import('../src/systems/events.js'),{ensureSituation}=await import('../src/systems/ongoing_situations.js');
 const {entryResults,libraryRows}=await import('../src/ui/content_views.js'),{choiceLayers,timelineView}=await import('../src/ui/compact_views.js');
 const {META}=await import('../src/config/mock_tunables.js');
 const tests=[],audit=[];
 const {execFileSync}=require('node:child_process');
 const baseline=await import('data:text/javascript;base64,'+Buffer.from(execFileSync('git',['show','be8c02ab25dc44ec2c70f9c3daa0b24ec275261c:src/content/ancient_events.js'],{cwd:root})).toString('base64'));
 const withoutOwner=t=>{const {event_type,player_involvement,...rest}=t;return rest;};assert.deepEqual(ANCIENT_EVENTS.map(withoutOwner),baseline.ANCIENT_EVENTS.map(withoutOwner));
 for(const file of ['decisions.js','worlds.js','src/core/rng.js','src/systems/genetics.js','src/systems/character_generation.js','src/systems/behavior.js','src/systems/long_term_state.js','src/systems/ongoing_situations.js','src/testing/run.js','src/testing/feedback_store.js'])assert.equal(fs.readFileSync(path.join(root,file),'utf8').replace(/\r/g,''),execFileSync('git',['show','be8c02ab25dc44ec2c70f9c3daa0b24ec275261c:'+file],{cwd:root,encoding:'utf8'}).replace(/\r/g,''),'protected core changed '+file);
 tests.push('PROTECTED-CORE: content unchanged except ownership, probability/RNG/world/state/replay/feedback source unchanged');
 const facts=s=>JSON.stringify([s.characters,s.resources,s.health,s.marriages,s.long_term_states,s.ongoing_situations,s.rng_state]);
 for(const t of ANCIENT_EVENTS){
  const s=fixture({seed:5}),cid=s.test.child_id,ctx=contentContext(s,cid);
  // Isolate routing from eligibility: verify every declared template, including rare ones.
  if(!ctx.roles[t.participant_requirements.role].length)ctx.roles[t.participant_requirements.role]=[s.test.target_id];
  const e=instantiateContent(s,cid,t,ctx),before=facts(s),type=playerDecisionType(e),gate=needsPlayer(s,cid,e);assert.equal(t.event_type==='PLAYER_DECISION_EVENT',!!type);assert.equal(t.player_involvement!=='人物自主',!!type);
  assert.equal(gate,!!type);assert.equal(facts(s),before,'routing wrote character results: '+t.event_id);
  if(type){assert.equal(pendingDecision(s).type,type);assert(playerChoices(s,pendingDecision(s)).some(o=>o.feasible));assert.equal(facts(s),before);}
  audit.push({id:t.event_id,title:t.display_templates.title,previous:t.importance==='major'?'家庭资源或长期安排；人物仍有自主回应':'人物自主',effective:type||'autonomous'});
 }
 assert.equal(audit.length,104);assert.equal(audit.filter(x=>x.effective!=='autonomous').length,23);
 assert.equal((libraryRows('全部','全部','玩家决策').match(/<details class="card">/g)||[]).length,23);
 tests.push('AUDIT-104-TEMPLATES: 23 family gates, 81 autonomous, no pre-choice effects');
 const r=newRun(fixture({seed:5,case_id:'PLAYER-MARRIAGE-01'})),s=r.state,p=pendingDecision(s),before=facts(s),month=s.current_world_month;
 assert.throws(()=>step(r,{type:'month'}),/需要你的决定/);assert.equal(facts(r.state),before);assert.equal(r.commands.length,0);
 const o=playerChoices(r.state,p).find(x=>x.target_id&&x.feasible),entry=step(r,{type:'player_choice',event_id:p.id,option_id:o.id});
 assert(entry.result.player_choice);assert(Object.hasOwn(entry.result,'character_choice'));assert(entry.result.final_outcome);assert.equal(r.state.current_world_month,month);
 assert(entry.result.arrangement.child);assert(!pendingDecision(r.state)||pendingDecision(r.state).id!==p.id);
 const expected=structuredClone(r.state);expected.history.forEach(e=>delete e.command_index);assert.deepEqual(replay(r),expected);
 assert(choiceLayers(entry.result).includes('你的决定'));assert(choiceLayers(entry.result).includes('人物反应'));assert(choiceLayers(entry.result).includes('最终结果'));
 tests.push('TEST-PLAYER-UI-01 state: waits, no result before input, writeback after explicit choice; replay equal');
 for(const content of [false,true]){
  const run=newRun(fixture({seed:5})),s=run.state,cid=s.test.child_id,outsider=s.test.target_id;
  const e=content?instantiateContent(s,outsider,ANCIENT_EVENTS.find(t=>t.event_id==='match-4')):eventFor(s,'marriage',cid);e.target_id=cid;
  const before=facts(s);assert.equal(needsPlayer(s,outsider,e),true);const p=pendingDecision(s);assert.equal(p.character_id,cid);assert.equal(p.payload.event.target_id,outsider);assert.equal(facts(s),before);assert.equal(s.marriage_proposal_history.length,0);
  const result=step(run,{type:'player_choice',event_id:p.id,option_id:outsider}).result;assert(result.arrangement.child);assert(result.character_choice);assert(result.final_outcome);assert.equal(s.marriage_proposal_history.length,3);
  if(content){assert(s.characters[cid].experiences.some(x=>x.event_id==='match-4'));assert(result.decision.content_result);assert(Object.values(s.long_term_states).some(t=>t.content_theme==='match'));}
 }
 tests.push('TEST-MARRIAGE-PLAYER-01: incoming legacy/content proposals wait, one arrangement, separate reactions, content history retained');
 for(const option of ['skip','reject']){
  const r=newRun(fixture({seed:5,case_id:'PLAYER-MARRIAGE-01'})),s=r.state,p=pendingDecision(s),target=s.test.target_id;
  p.payload.event={target_id:target};const issue=ensureSituation(s,'marriage_negotiation',[s.test.child_id,target],['当前提议']);
  const rng=s.rng_state;step(r,{type:'player_choice',event_id:p.id,option_id:option});assert.equal(s.rng_state,rng);assert.equal(s.marriage_proposal_history.length,0);assert.equal(issue.status,option==='skip'?'paused':'ended');
 }
 tests.push('MARRIAGE-DEFER-REJECT: no character draw, active proposal actually pauses/ends');
 let refusalRun;
 for(let seed=0;seed<100;seed++){const r=newRun(fixture({seed,case_id:'PLAYER-MARRIAGE-01'})),p=pendingDecision(r.state);step(r,{type:'player_choice',event_id:p.id,option_id:r.state.test.target_id});if(pendingDecision(r.state)?.type==='force'){refusalRun=r;break;}}
 assert(refusalRun,'real marriage refusal must create second player decision');
 const refusal=pendingDecision(refusalRun.state),beforeRefusal=facts(refusalRun.state);assert.throws(()=>step(refusalRun,{type:'month'}),/需要你的决定/);assert.equal(facts(refusalRun.state),beforeRefusal);
 assert(playerChoices(refusalRun.state,refusal).some(o=>o.id==='persuade'));assert(playerChoices(refusalRun.state,refusal).some(o=>o.id==='defer'));
 const blocked=structuredClone(refusalRun.state);blocked.health[refusal.character_id].value=0;assert.equal(playerChoices(blocked,refusal).find(o=>o.id==='force').feasible,false);
 const respected=step(refusalRun,{type:'player_choice',event_id:refusal.id,option_id:'respect'});assert(respected.result.character_choice);assert(Object.values(refusalRun.state.ongoing_situations).some(x=>x.type==='marriage_negotiation'&&x.participants.includes(refusal.character_id)&&x.status==='ended'));
 tests.push('MARRIAGE-REFUSAL: second player wait, respect/persuade/defer/force, hard-condition button disabled');
 const a=newRun(fixture({seed:10}));const log=step(a,{type:'event',event_type:'music'});const html=entryResults(a.state,log);assert(html.includes('人物考虑过'));assert(html.includes('人物最终决定'));assert(!html.includes('可选回应'));assert(!html.includes('data-player-option'));
 const compact=timelineView(a.state,a.state.history,0,()=>html,()=>log.result.event.title);assert(compact.includes('timeline-node'));assert(!compact.includes('class="timeline-node important-node" open'));
 tests.push('TEST-AUTONOMOUS-UI-01: character-labelled candidates, no player buttons, collapsed detail');
 for(const world of ['ancient','modern']){const s=fixture({world,case_id:'PLAYER-EDU-01'}),r=newRun(s);for(let i=0;i<3;i++){const before=JSON.stringify(r);assert.throws(()=>step(r,{type:'month'}),/需要你的决定/);assert.equal(JSON.stringify(r),before);}}
 tests.push('TEST-PLAYER-NO-AUTO-01: repeated advance attempts cannot consume choice or month, both worlds');
 console.log(JSON.stringify({version:META.mock_version,tests,audit_changed:audit.filter(x=>x.previous==='人物自主'&&x.effective!=='autonomous')},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
