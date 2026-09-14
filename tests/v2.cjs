// node tests/v2.cjs — same static production modules, no network or private files.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
vm.runInThisContext(['worlds.js','src/core/legacy_bridge.js','decisions.js'].map(f=>fs.readFileSync(path.join(root,f),'utf8')).join('\n'));
(async()=>{
 const {fixture,CASES}=await import('../src/testing/test_cases.js'),{month:rawMonth,command}=await import('../src/core/simulation.js'),{newRun,step,replay}=await import('../src/testing/run.js');
 const {inherit}=await import('../src/systems/genetics.js'),{FACE,COLORS,TALENTS}=await import('../src/config/mock_feature_pools.js');
 const {decide}=await import('../src/systems/behavior.js'),{eventFor}=await import('../src/systems/events.js'),{applyForce}=await import('../src/systems/player_intent.js');
 const {createCharacter}=await import('../src/systems/character_generation.js'),{createHousehold}=await import('../src/systems/household.js');
 const {startReproduction}=await import('../src/systems/reproduction.js'),{establishMarriage,arrangeMarriage}=await import('../src/systems/marriage.js');
 const {die}=await import('../src/systems/death.js'),{defaultBehaviors}=await import('../src/systems/default_behavior.js');
 const {selectSuccessor,inheritEstate,successors}=await import('../src/systems/succession_inheritance.js');
 const {feedbackFor,validateImport,exportEnvelope}=await import('../src/testing/feedback_store.js');
 const {scan,samples,healthChecks}=await import('../src/testing/behavior_lab.js');
 const {clone}=await import('../src/core/state.js');
 const {pendingDecision,playerChoices}=await import('../src/systems/player_decisions.js');
 // Explicit deterministic test-player input. Production must stop at these same gates.
 function answer(s,apply=cmd=>command(s,cmd)){let guard=0;while(pendingDecision(s)){assert(++guard<100);const p=pendingDecision(s),options=playerChoices(s,p).filter(x=>x.feasible),o=options.find(x=>['skip','respect'].includes(x.id))||options[0];apply({type:'player_choice',event_id:p.id,option_id:o.id});}}
 function month(s){answer(s);return rawMonth(s);}
 let checks=0;const ok=(v,label)=>{assert.ok(v,label);checks++;};
 const initial=fixture({seed:72}),a=initial.characters[initial.test.father_id],b=initial.characters[initial.test.mother_id];
 for(const k of TALENTS){a.talents[k]=25;b.talents[k]=75;}
 let outside=0,nonMean=0,mutations=0;const colors={};
 for(let i=0;i<10000;i++){const child=inherit(initial,a,b);for(const k of COLORS){assert([a.appearance[k],b.appearance[k]].includes(child.appearance[k]));}assert(/^skin_0[1-4]$/.test(child.appearance.skin_tone_id));const f=Object.values(child.explanation.face),mut=f.filter(f=>f.source==='mutation').length;assert(mut<=2);assert(f.length-mut>=3);mutations+=mut;for(const k of FACE){const info=child.explanation.face[k];if(info.source!=='mutation')assert.equal(child.appearance[k],(info.source==='father'?a:b).appearance[k]);}outside+=child.explanation.continuous.intelligence.outside?1:0;nonMean+=child.talents.intelligence!==50?1:0;colors[child.appearance.skin_tone_id]=(colors[child.appearance.skin_tone_id]||0)+1;}
 ok(outside>0&&outside<3000,'continuous outside rare');ok(nonMean>9000,'not parental mean');const s1=clone(initial),s2=clone(initial),a2=clone(a),b2=clone(b);a2.appearance.hairstyle_id='anything';b2.appearance.hairstyle_id='else';ok(inherit(s1,a,b).appearance.hairstyle_id===inherit(s2,a2,b2).appearance.hairstyle_id,'hairstyle independent');
 for(const world of ['modern','ancient']){const s=fixture({world}),cid=s.control.current_control_character_id;for(const type of ['music','safety','learning','career','birth','strain']){const result=decide(s,cid,eventFor(s,type,s.test.target_id));ok(result.candidate_actions.reduce((sum,a)=>sum+a.probability_units,0)===1000,'sum probability');ok(result.candidate_actions.every(a=>Number.isFinite(a.probability)&&a.probability>=0),'finite nonnegative');ok(Math.abs(result.candidate_actions.reduce((sum,a)=>sum+a.probability_fraction,0)-1)<1e-10,'normalized probability sum1');}
 for(const attr of ['planning','interest','extraversion','goal','resources','stress','relationship']){const rows=scan(s,cid,'music',attr);ok(rows.every(r=>r.candidate_actions.every(a=>a.modifiers.random===0)),'theory noise off');}
 const musicSafety=scan(s,cid,'safety','interest');ok(JSON.stringify(musicSafety[0].candidate_actions.map(a=>a.probability))===JSON.stringify(musicSafety.at(-1).candidate_actions.map(a=>a.probability)),'unrelated music no effect');for(let i=0;i<12;i++)month(s);ok(s.history.filter(h=>h.kind==='month').length===12,'world monthly');
 }
 const scarce=fixture({case_id:'TC-RESOURCE-01'}),cid=scarce.control.current_control_character_id,result=decide(scarce,cid,eventFor(scarce,'learning'));
 ok(result.excluded_actions.some(a=>a.resource_cost>0&&a.probability===0),'resource hard filter');ok(!applyForce(scarce,cid,result,'try_lesson').executed,'force cannot cross resources');
 const blocked=decide(scarce,cid,{...eventFor(scarce,'music'),hard_block:'no conditions'});ok(blocked.excluded_actions.length>0,'hard block');
 const engine=globalThis.PeaDecision,ctx={age:20,time_available:0,severe_illness:false};const candidates=engine.generateCandidateActions(eventFor(scarce,'music'),{...ctx,world_id:'modern'}).map(a=>({...a,resource_cost:0,delays_emergency:true}));
 const empty=engine.filterFeasibleActions(candidates,eventFor(scarce,'music'),ctx);ok(empty.actions.length===1&&empty.actions[0].action_id==='seek_safe_help','zero feasible fallback');const probs=engine.calculateActionProbabilities((await import('../src/systems/behavior.js')).legacyPerson(scarce,cid),eventFor(scarce,'music'),empty.actions,{...ctx,world_id:'modern'},()=>.5);ok(engine.sampleAction(probs,0).action_id==='seek_safe_help'&&probs[0].probability===100,'one feasible');
 const f=fixture({}),fc=f.control.current_control_character_id,decision=decide(f,fc,eventFor(f,'career'));decision.chosen_action_id='decline_terms';const forced=applyForce(f,fc,decision,'commit_terms',f.test.father_id);ok(forced.executed&&forced.resistance>0,'force overrides current refusal');const personality=clone(f.characters[fc].personality);month(f);ok(f.characters[fc].active_simulation,'autonomy resumes');assert.deepEqual(f.characters[fc].personality,personality);
 const death=fixture({case_id:'TC-INHERITANCE-01'}),father=death.test.father_id,home=death.characters[father].current_household_id,wealth=death.resources.households[home].household_resources;die(death,father);ok(!death.characters[father].alive&&!death.characters[father].active_simulation,'death facts');ok(defaultBehaviors(death,father).primary===null,'dead no defaults');ok(death.control.current_control_character_id===null&&death.control.pending.candidates.length===2,'await selection');
 const heirs=death.inheritances[father].eligible;inheritEstate(death,father,heirs[0]);ok(death.resources.personal[heirs[0]].personal_inheritable_estate===600&&death.resources.personal[heirs[1]].personal_inheritable_estate===400,'60/40');ok(death.resources.households[home].household_resources===wealth,'household money untouched');assert.throws(()=>inheritEstate(death,father,heirs[0]));selectSuccessor(death,heirs[1]);ok(death.control.current_control_character_id===heirs[1],'control independent');
 const single=fixture({});delete single.characters[single.test.child_id].biological_parent_ids[1];single.characters[single.test.child_id].biological_parent_ids=[];single.resources.personal[single.test.father_id].personal_inheritable_estate=88;die(single,single.test.father_id);const one=single.inheritances[single.test.father_id];inheritEstate(single,single.test.father_id,one.eligible[0]);ok(single.resources.personal[one.eligible[0]].personal_inheritable_estate===88,'single child100');
 const baby=fixture({case_id:'TC-BIRTH-01'}),before=Object.keys(baby.characters).length;for(let i=0;i<9;i++)month(baby);ok(Object.keys(baby.characters).length>before,'true newborn created');const born=Object.values(baby.characters).find(c=>c.birth_month===baby.current_world_month);ok(born&&born.life_goal===null&&born.biological_parent_ids.length===2,'newborn fields');
 const goal=fixture({}),gc=goal.characters[goal.test.child_id];gc.birth_month=goal.current_world_month-143;gc.life_goal=null;month(goal);ok(gc.life_goal!==null,'goal at12');
 const run=newRun(fixture({seed:85}));for(let i=0;i<24;i++){answer(run.state,cmd=>step(run,cmd));step(run,{type:'month'});}const replayed=replay(run);const normalized=clone(run.state);normalized.history.forEach(e=>delete e.command_index);assert.deepEqual(replayed,normalized);checks++;const feedback=feedbackFor(run,6,'很好的结果');ok(feedback.simulation_month===run.state.history[6].month&&feedback.replay.commands.length===run.state.history[6].command_index+1,'historical feedback checkpoint');validateImport(exportEnvelope({feedback:[feedback]}));assert.throws(()=>replay({...feedback.replay,mock_version:'old'}));checks++;
 const noise=clone(initial);const tests=await samples(decide(noise,noise.test.child_id,eventFor(noise,'music'),{noise:false}).candidate_actions,10000,10);ok(tests.every(r=>Math.abs(r.error)<2),'sampling distribution');
 let marriageSeed=null,marriedState;for(let seed=0;seed<150;seed++){const s=fixture({seed,case_id:'TC-MARRIAGE-02'}),r=arrangeMarriage(s,s.test.child_id,s.test.target_id,'force');if(r.status==='married'){marriageSeed=seed;marriedState=s;break;}}ok(marriageSeed!==null,'force marriage real execution');for(let i=0;i<24;i++)month(marriedState);ok(marriedState.history.filter(h=>h.kind==='month').length===24,'forced24');
 console.log(JSON.stringify({checks,genetics:{children:10000,outside,nonMean,meanFaceMutations:mutations/10000,colors},forcedMarriageSeed:marriageSeed,sampling:tests},null,2));

 // Stronger color distribution and formal adoption / collateral boundaries.
 const ga=clone(a),gb=clone(b),gs=fixture({seed:2});ga.appearance.skin_tone_id='skin_01';gb.appearance.skin_tone_id='skin_04';let fromA=0;for(let i=0;i<10000;i++){const c=inherit(gs,ga,gb);fromA+=c.appearance.skin_tone_id==='skin_01'?1:0;assert(['skin_01','skin_04'].includes(c.appearance.skin_tone_id));}ok(fromA>4700&&fromA<5300,'equal parental colors');
 const adop=fixture({}),ap=adop.test.father_id;for(const c of Object.values(adop.characters))c.biological_parent_ids=c.biological_parent_ids.filter(id=>id!==ap);
 const adopted=createCharacter(adop,{household_id:adop.characters[ap].current_household_id});adopted.adoptive_parent_ids=[ap];adopted.adoption_records=[{parent_id:ap,month:adop.current_world_month-1}];die(adop,ap);ok(successors(adop,ap).some(c=>c.character_id===adopted.character_id),'adopted infant eligible');
 adopted.adoption_records[0].month=adop.current_world_month+1;ok(!successors(adop,ap).some(c=>c.character_id===adopted.character_id),'posthumous adoption excluded');
 const siblings=fixture({}),siblingId=Object.values(siblings.characters).find(c=>c.character_id!==siblings.test.child_id&&c.biological_parent_ids.includes(siblings.test.father_id)).character_id;
 die(siblings,siblings.test.child_id);ok(successors(siblings,siblings.test.child_id).some(x=>x.character_id===siblingId&&x.priority==='collateral'),'collateral fallback');
 // Same real monthly core across three generations, with explicit test-player choices.
 const three=fixture({seed:0,resources:100000});three.config.illness_frequency=0;three.config.decision_event_frequency=0;three.config.marriage_opportunity_frequency=0;three.config.reproduction_frequency=0;
 let controlled=three.test.child_id;const generationLog=[];
 for(let g=0;g<3;g++){
   const pc=three.characters[controlled];while((three.current_world_month-pc.birth_month)<18*12)month(three);
   const hid=createHousehold(three,'三代测试对象家庭'),mate=createCharacter(three,{sex:pc.sex==='女'?'男':'女',age_years:20,household_id:hid});
   three.resources.households[hid].household_resources=100000;three.resources.households[pc.current_household_id].household_resources=100000;
   establishMarriage(three,controlled,mate.character_id,'explicit test accepted arrangement');
   assert(startReproduction(three,controlled,mate.character_id).started);
   const n=Object.keys(three.characters).length;for(let m=0;m<three.config.gestation_months;m++)month(three);
   ok(Object.keys(three.characters).length===n+1,'generation '+g+' actual birth');
   const kid=Object.values(three.characters).find(c=>c.birth_month===three.current_world_month);
   const immutable=clone({talents:kid.talents,appearance:kid.appearance,personality:kid.personality});
   die(three,controlled);ok(three.control.pending.candidates.some(c=>c.character_id===kid.character_id),'generation child candidate');
   selectSuccessor(three,kid.character_id);controlled=kid.character_id;generationLog.push({generation:g+1,character_id:controlled,birth_month:kid.birth_month});
   month(three);assert.deepEqual({talents:kid.talents,appearance:kid.appearance,personality:kid.personality},immutable);
 }
 ok(generationLog.length===3,'three generations unified loop');
 const deadReports=three.history.flatMap(h=>h.reports||[]).filter(r=>three.characters[r.character_id].death_month!==null&&r.before?.character?.alive===false);
 ok(deadReports.length===0,'no later monthly dead behavior');
 const blockedBirth=fixture({}),br=decide(blockedBirth,blockedBirth.test.child_id,eventFor(blockedBirth,'birth',blockedBirth.test.target_id));
 ok(br.excluded_actions.some(a=>a.action_id==='commit_terms'),'birth hard conditions');
 // Parameter isolation and fixed default months: no compulsory personality decisions.
 const stable=fixture({case_id:'TC-EDU-01'});stable.config.decision_event_frequency=0;stable.config.illness_frequency=0;stable.config.marriage_opportunity_frequency=0;stable.config.reproduction_frequency=0;
 for(let i=0;i<12;i++)month(stable);ok(stable.history.filter(h=>h.kind==='month').every(h=>h.reports.find(r=>r.character_id===stable.test.child_id).defaults.primary.type==='education'),'education default persists');ok(stable.history.every(h=>!h.reports.find(r=>r.character_id===stable.test.child_id).decision),'no monthly mandatory decision');
 const longRun=fixture({seed:0});let lifeMonths=0;while(longRun.control.current_control_character_id&&lifeMonths<1500){month(longRun);lifeMonths++;}ok(longRun.control.pending!==null,'run to death reaches pause');console.log(JSON.stringify({additionalChecks:checks,unequalColorParentA:fromA,generationLog,continuousMonths:three.history.length,runToDeathMonths:lifeMonths}));

})().catch(e=>{console.error(e);process.exitCode=1;});
