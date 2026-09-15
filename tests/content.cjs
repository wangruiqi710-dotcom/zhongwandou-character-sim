const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
vm.runInThisContext(['worlds.js','src/core/legacy_bridge.js','decisions.js'].map(f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8')).join('\n'));
(async()=>{
 const {ANCIENT_EVENTS}=await import('../src/content/ancient_events.js'),{fixture}=await import('../src/testing/test_cases.js'),{contentContext,eligibleContent,instantiateContent,applyContent,contentFeasibility}=await import('../src/content/event_runtime.js');
 const {resolveDecision,decide}=await import('../src/systems/behavior.js'),{command,month}=await import('../src/core/simulation.js'),{pendingDecision,playerChoices,needsPlayer,playerDecisionType}=await import('../src/systems/player_decisions.js');
 const {enroll,employ}=await import('../src/systems/education_career.js'),{createCharacter}=await import('../src/systems/character_generation.js'),{establishMarriage}=await import('../src/systems/marriage.js'),{addLongTerm}=await import('../src/systems/long_term_state.js'),{startAway}=await import('../src/systems/life_context.js');
 const {createHousehold,joinHousehold}=await import('../src/systems/household.js'),{changeRelationship}=await import('../src/systems/relationships.js');
 const {newRun,step,replay}=await import('../src/testing/run.js'),{meaningfulEntries,fiveYearSummaries}=await import('../src/content/life_records.js');
 const report={version:'2.2.0-alpha',audit:{count:ANCIENT_EVENTS.length,domains:{},sizes:{},reachable:0,executed:0,issues:[]},cohorts:[],families:[],ten_years:[],examples:[]};
 function witness(t){const s=fixture({seed:80,resources:3000}),cid=s.test.child_id,c=s.characters[cid],hid=c.current_household_id;
  c.birth_month=s.current_world_month-24*12;c.skills=[{name:'手工',level:30,source:'MOCK_ONLY'}];c.mentor_character_id=s.test.father_id;c.dynamic.stress=60;c.dynamic.fatigue=70;s.resources.personal[cid].personal_inheritable_estate=200;
  c.experiences.push({month:s.current_world_month-24,theme:t.theme,type:'fixture'});enroll(s,cid,1);employ(s,cid,0);enroll(s,s.test.sibling_id||Object.values(s.characters).find(x=>x.given_name==='安').character_id);
  const sibling=Object.values(s.characters).find(x=>x.given_name==='安').character_id;s.test.sibling_id=sibling;
  s.health[s.test.mother_id].value=30;s.characters[s.test.mother_id].birth_month=s.current_world_month-65*12;s.characters[s.test.father_id].birth_month=s.current_world_month-67*12;s.relationships[Object.keys(s.relationships)[0]].attitude=-30;
  const condition=t.trigger_conditions.condition;
  if(!['single','negotiating','refused'].includes(condition))establishMarriage(s,cid,s.test.target_id,'MOCK fixture');
  const outsider=createCharacter(s,{age_years:30,household_id:createHousehold(s,'测试邻居')});employ(s,outsider.character_id,1);changeRelationship(s,cid,outsider.character_id,-10,'测试熟识');
 for(const id of [s.test.father_id,s.test.mother_id,sibling])joinHousehold(s,id,c.current_household_id);
 for(const years of [1,9]){const ch=createCharacter(s,{age_years:years,parents:[cid,s.test.target_id],household_id:c.current_household_id});enroll(s,ch.character_id,0);}
  if(condition==='unemployed')s.careers[cid].status='ended';if(condition==='merchant')employ(s,cid,1);if(condition==='farmer')employ(s,cid,2);
  if(condition==='poor')s.resources.households[c.current_household_id].household_resources=100;if(condition==='elder')c.birth_month=s.current_world_month-60*12;
  if(condition==='carer')s.households[c.current_household_id].responsibilities[cid]={until:s.current_world_month+120,mandatory:true};
  if(condition==='away')startAway(s,cid);if(condition==='sickself')s.health[cid].value=50;
  if(condition==='recoveringkin')addLongTerm(s,s.test.mother_id,'health_recovery',null,12);
  if(condition==='negotiating')s.ongoing_situations.fixture={id:'fixture',type:'marriage_negotiation',status:'active',participants:[cid,s.test.target_id]};
  if(condition==='refused')s.marriage_proposal_history.push({initiator_character_id:cid,candidate_character_id:s.test.target_id,status:'refused'});
  return {s,cid};}
 const seen=new Set(),effects=new Set();
 for(const t of ANCIENT_EVENTS){
  report.audit.domains[t.domain]=(report.audit.domains[t.domain]||0)+1;report.audit.sizes[t.importance]=(report.audit.sizes[t.importance]||0)+1;
  assert(!seen.has(t.event_id));seen.add(t.event_id);assert(t.decision_goal&&t.terminal_outcomes.length>=2);assert(t.terminal_outcomes.every(o=>o.effects.length));assert(t.followup_tags.length);
  const signature=JSON.stringify([t.trigger_conditions,t.participant_requirements,t.terminal_outcomes.map(o=>o.effects)]);assert(!effects.has(signature),'duplicate logic '+t.event_id);effects.add(signature);
  const {s,cid}=witness(t);assert(eligibleContent(s,cid,t),'unreachable '+t.event_id);report.audit.reachable++;
  const event=instantiateContent(s,cid,t),r=resolveDecision(s,cid,event,{noise:false});assert(r.terminal);assert.equal(r.candidate_actions.reduce((n,a)=>n+a.probability_units,0),1000);
  const action=r.candidate_actions.find(a=>a.action_type==='terminal_action'&&a.action_id!=='leave_current');assert(action,'no effect option '+t.event_id);r.chosen_action_id=action.action_id;r.chosen_action=action.action;
  const before=JSON.stringify(s);applyContent(s,cid,r);assert.notEqual(JSON.stringify(s),before);report.audit.executed++;
  if(t.participant_requirements.real_person)assert(s.characters[event.target_id]);
  if(report.examples.length<3&&['education-4','hardship-2','away-4'].includes(t.event_id))report.examples.push({id:t.event_id,event:event.description,actions:r.candidate_actions.map(a=>a.action),choice:r.chosen_action,result:r.content_result.outcome,before:r.content_result.before,after:r.content_result.after});
 }
 report.audit.player=ANCIENT_EVENTS.filter(t=>playerDecisionType({...t,content_template:true})).length;report.audit.multistage=ANCIENT_EVENTS.filter(t=>t.transition_actions.length).length;report.audit.real_npc=ANCIENT_EVENTS.filter(t=>t.participant_requirements.real_person).length;report.audit.long_term=ANCIENT_EVENTS.filter(t=>t.developmental).length;report.audit.ongoing=ANCIENT_EVENTS.filter(t=>t.possible_ongoing_situations.length).length;report.audit.developmental=ANCIENT_EVENTS.filter(t=>t.developmental).length;
 if(process.env.LOCATION_AUDIT_ONLY==='1'){fs.writeFileSync('reports/v240-content-audit.json',JSON.stringify(report.audit,null,2)+'\n');console.log(JSON.stringify(report.audit));return;}
 const schooling=ANCIENT_EVENTS.find(t=>t.event_id==='education-4'),rich=witness(schooling),poor=structuredClone(rich.s),pc=poor.characters[rich.cid];poor.resources.households[pc.current_household_id].household_resources=0;poor.households[pc.current_household_id].responsibilities[rich.cid]={mandatory:true,until:poor.current_world_month+12};
 const re=instantiateContent(rich.s,rich.cid,schooling),pe=instantiateContent(poor,rich.cid,schooling),rr=decide(rich.s,rich.cid,re,{noise:false}),pr=decide(poor,rich.cid,pe,{noise:false});assert(rr.candidate_actions.some(a=>a.action_id==='commit_terms'));assert(pr.excluded_actions.some(a=>a.action_id==='commit_terms'));assert(pe.mock_actions.some(a=>a.id==='fee_relief'));assert(pe.mock_actions.some(a=>a.id==='coordinate'));
 const high=structuredClone(rich.s),low=structuredClone(rich.s);high.characters[rich.cid].interests=[{name:'读书',intensity:100}];low.characters[rich.cid].interests=[{name:'读书',intensity:0}];const hi=decide(high,rich.cid,re,{noise:false}),lo=decide(low,rich.cid,re,{noise:false});assert(hi.candidate_actions.find(a=>a.action_id==='commit_terms').probability>lo.candidate_actions.find(a=>a.action_id==='commit_terms').probability);
 const elderly=structuredClone(rich.s);elderly.characters[rich.cid].birth_month-=60*12;assert(!eligibleContent(elderly,rich.cid,schooling));
 // The player selects which opportunity exists, not just a +5% preference.
 assert(needsPlayer(rich.s,rich.cid,re));const pending=pendingDecision(rich.s);assert.throws(()=>month(rich.s));const playerEntry=command(rich.s,{type:'player_choice',event_id:pending.id,option_id:'commit_terms'});assert(!playerEntry.result.decision.event.mock_actions.some(a=>a.id==='alternative'));
 report.audit.causal_checks=['same opportunity: rich admission / poor hard exclusion','poor student fee-relief route','care coordination route','same event: interest changes probability','old-age education excluded','player pause and selected opportunity only'];
 // Deliberate player input is TEST ONLY. No production auto-choice policy.
 function answer(s,policy='support'){let count=0;for(let p;(p=pendingDecision(s));){assert(++count<100);const feasible=playerChoices(s,p).filter(a=>a.feasible);const option=(policy==='conserve'?feasible.find(a=>a.id==='skip'||a.id==='rest'||a.id==='respect'):null)||feasible.find(a=>a.id==='support'||a.id==='commit_terms'||a.target_id)||feasible.find(a=>!['skip','force'].includes(a.id))||feasible[0];command(s,{type:'player_choice',event_id:p.id,option_id:option.id});}return count;}
 function scenario(index,family=null){const s=fixture({seed:110+index,resources:[60,4000,300,900,250][index],template:'random'}),cid=s.test.child_id,c=s.characters[cid],hid=c.current_household_id;
  c.birth_month=s.current_world_month-(index===1?14:18)*12;c.life_goal=['家庭生活','职业成就','家庭生活','财富积累','声望地位'][index];
  c.interests=[{name:['农事','读书','烹饪','经商','手工'][index],intensity:95,source:'MOCK_ONLY'}];Object.assign(c.personality,{extraversion:[20,45,30,95,70][index],planning:[80,90,70,20,50][index]});c.talents.intelligence=[30,95,55,65,70][index];c.talents.athletic=[85,30,50,55,70][index];
  if(index===1){enroll(s,cid,0);s.careers[cid].status='ended';}if(index===3)employ(s,cid,1);if(index===4)employ(s,cid,0);
  if(index===0||index===2){for(const id of s.households[hid].members)if(id!==cid&&s.careers[id])s.careers[id].status='ended';s.health[s.test.mother_id].value=35;}
  if(index===2)s.households[hid].responsibilities[cid]={until:s.current_world_month+96,mandatory:true};
  if(family){s.seed=991;s.rng_state=991;c.life_goal='职业成就';c.interests=[{name:'手工',intensity:80,source:'MOCK_ONLY'}];c.personality={extraversion:50,intuition:50,thinking:50,planning:70};for(const k of Object.keys(c.talents))c.talents[k]=65;
   s.resources.households[hid].household_resources=family==='A'?5000:family==='B'?20:700;
   if(family==='B'){for(let i=0;i<3;i++)createCharacter(s,{age_years:5+i,parents:[s.test.father_id,s.test.mother_id],household_id:hid});s.households[hid].responsibilities[cid]={until:s.current_world_month+96,mandatory:true};for(const id of [s.test.father_id,s.test.mother_id])s.careers[id].status='ended';}
   if(family==='C'){for(const r of Object.values(s.relationships))r.attitude=-55;c.dynamic.stress=65;}
  }return s;
 }
 function simulate(s,months,policy){const cid=s.test.child_id,start=s.current_world_month,initial=structuredClone(s),choices=[];let pauses=0;
  for(let i=0;i<months;i++){if(pendingDecision(s)){pauses++;answer(s,policy);}if(s.control.ended)break;month(s);}
  answer(s,policy);const c=s.characters[cid],rows=meaningfulEntries(s,cid),all=s.history.flatMap(h=>h.reports||[]),content=c.experiences.filter(x=>x.event_id);
  const stats={seed:s.seed,months:s.current_world_month-start,initial_age:Math.floor((start-c.birth_month)/12),domains:[...new Set(content.map(x=>x.domain))],unique_templates:new Set(content.map(x=>x.event_id)).size,career_path:[...new Set(all.filter(r=>r.character_id===cid).map(r=>r.after?.career?.name).filter(Boolean))],education_path:[...new Set(all.filter(r=>r.character_id===cid).map(r=>r.after?.education?.name).filter(Boolean))],marriages:Object.values(s.marriages).filter(m=>m.people.includes(cid)).length,children:Object.values(s.characters).filter(x=>x.biological_parent_ids.includes(cid)).length,resources:{before:initial.resources.households[initial.characters[cid].current_household_id].household_resources,after:s.resources.households[c.current_household_id].household_resources},migration:Object.values(s.long_term_states).filter(t=>t.character_id===cid&&t.type==='away_from_home_assignment').length,relationships:Object.values(s.relationships).filter(r=>r.people.includes(cid)).map(r=>({people:r.people,attitude:r.attitude,interactions:r.history.length})),long_states:[...new Set(Object.values(s.long_term_states).filter(t=>t.character_id===cid).map(t=>t.content_theme||t.type))],problems:Object.values(s.ongoing_situations).filter(x=>x.participants.includes(cid)).length,player_decisions:s.history.filter(h=>h.kind==='player_choice').length,paused_months:pauses,failed:content.filter(x=>x.failed).length,alive:c.alive,summary_count:fiveYearSummaries(s,cid).length};
  assert(stats.unique_templates>=6,'too little content');assert(stats.player_decisions>0);assert(pauses<months*.6);
  return {stats,rows:rows.map(({details,...e})=>e),summary:fiveYearSummaries(s,cid).map(g=>({age:g.age_from+'-'+g.age_to,events:g.entries.length,player:g.player_decisions.length})),final:{age:Math.floor((s.current_world_month-c.birth_month)/12),health:s.health[cid].value,stress:c.dynamic.stress,skills:c.skills}};
 }
 for(let i=0;i<5;i++){const r=simulate(scenario(i),240,'support');report.cohorts.push(r.stats);console.log('cohort',i,r.stats.unique_templates,r.stats.career_path);}
 assert(report.cohorts.some(r=>r.failed>0));
 const signatures=new Set(report.cohorts.map(r=>JSON.stringify([r.career_path,r.education_path,r.migration,r.marriages,r.children,r.domains])));assert(signatures.size>=4,'life trajectories too similar');
 for(const f of ['A','B','C']){const r=simulate(scenario(4,f),240,'support');report.families.push({family:f,...r.stats});}
 assert(new Set(report.families.map(r=>JSON.stringify([r.domains,r.unique_templates,r.migration,r.problems]))).size===3,'families too similar');
 for(const i of [0,1,2]){const s=scenario(i);s.characters[s.test.child_id].birth_month=s.current_world_month-18*12;report.ten_years.push({background:['贫困家庭青年','家庭条件较好的青年','家庭责任较重的青年'][i],...simulate(s,120,i===0?'conserve':'support')});}
 // Focus raises candidate weights without altering eligibility, randomness or the frozen core.
 const s=scenario(1),cid=s.test.child_id;const before=ANCIENT_EVENTS.filter(t=>eligibleContent(s,cid,t)).map(t=>t.event_id);s.test_focus_mode='健康';assert.deepEqual(ANCIENT_EVENTS.filter(t=>eligibleContent(s,cid,t)).map(t=>t.event_id),before);
 const run=newRun(s);step(run,{type:'focus',value:'教育'});step(run,{type:'month'});const expected=structuredClone(run.state);expected.history.forEach(e=>delete e.command_index);assert.deepEqual(replay(run),expected);
 fs.mkdirSync(path.join(__dirname,'../reports'),{recursive:true});fs.writeFileSync(path.join(__dirname,'../reports/content-validation.json'),JSON.stringify(report,null,2));
 let md='# Mock 2.2.0-alpha 实际人生记录\n\n所有事件来自固定 seed 的真实运行；测试脚本明确提供玩家选择，生产页面不会替玩家选。\n';
 for(const r of report.ten_years){md+='\n## '+r.background+'\n\n```json\n'+JSON.stringify(r.stats,null,2)+'\n```\n\n';for(const e of r.rows)md+='- '+Math.floor(e.month/12)+'年'+(e.month%12+1)+'月【'+e.actor+'】'+e.title+'：'+e.result+'\n';}
 fs.writeFileSync(path.join(__dirname,'../reports/ten-year-lives.md'),md);console.log(JSON.stringify({audit:report.audit,cohorts:report.cohorts,families:report.families},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
