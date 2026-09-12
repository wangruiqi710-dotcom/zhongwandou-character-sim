'use strict';
// node test-worlds.cjs — 标准库检查；不联网，不读取或写入真实浏览器存档。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const code = ['worlds.js','decisions.js','app.js'].map(f=>fs.readFileSync(path.join(__dirname,f),'utf8')).join('\n');
function boot(seed = {}) {
  const storage = new Map(Object.entries(seed)), elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id,{dataset:{},value:'',textContent:'',innerHTML:'',className:'',hidden:false,disabled:false,reportValidity:()=>true});
    return elements.get(id);
  };
  const context = vm.createContext({console,Blob,crypto:require('node:crypto').webcrypto,setTimeout:()=>{},requestAnimationFrame:fn=>fn(),confirm:()=>true,
    document:{getElementById:element,querySelectorAll:()=>[],addEventListener:()=>{},body:{dataset:{}}},
    localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)}});
  vm.runInContext(code,context);
  return {run:s=>vm.runInContext(s,context),storage,elements};
}
const app=boot();
app.run(`
  function check(value,message){if(!value)throw new Error(message);}
  check(activeWorld==='modern','default world');
  createCharacter(false);
  const originalPerson=clone(state.current_character);
  check(TALENTS.every(t=>Number.isInteger(originalPerson.talents[t])),'talents');
  check(originalPerson.life_goal!==null,'adult goal');
  check(mbti({'外向性':100,'直觉性':100,'思考性':0,'计划性':100})==='ENFJ','mbti');
  for(let i=0;i<16;i++)advance(); // 1+3+12逐月
  check(state.sim_logs.filter(r=>r.kind==='monthly').length===16,'modern months');
  const modernRecord=state.sim_logs.at(-1);review(modernRecord.log_id,'合理','');addCandidate(modernRecord.log_id,'现代样例');
  const modernBatch=startComparison('朋友邀请参加聚会。',5);
  for(let i=0;i<5;i++)comparisonNext(modernBatch.comparison_id);
  const modernSaved=localStorage.getItem(storageKey());
  switchWorld('ancient');
  check(state.current_character===null&&state.sim_logs.length===0,'empty independent ancient');
  createCharacter(false);const ancientId=state.current_character.character_id;
  const fixed=JSON.stringify([state.current_character.talents,state.current_character.personality,state.current_character.life_goal]);
  for(let i=0;i<12;i++)advance();
  check(state.sim_logs.filter(r=>r.kind==='monthly').length===12&&state.game_date==='2027-01-01','ancient 12 months');
  check(fixed===JSON.stringify([state.current_character.talents,state.current_character.personality,state.current_character.life_goal]),'fixed attributes');
  for(const r of state.sim_logs)if(r.ai_output)assertWorldText(JSON.stringify(r.ai_output),'ancient');
  const batch=startComparison('获得一次远行学习机会，需要盘缠和家人支持。',20);
  for(let i=0;i<20;i++)comparisonNext(batch.comparison_id);
  check(batch.log_ids.length===20,'20 people comparison');
  const r=getLog(batch.log_ids[0]);review(r.log_id,'不合理','测试原因');addCandidate(r.log_id,'古代样例');
  const beforeCross=JSON.stringify(state.current_character),beforeDate=state.game_date;
  const cross=crossWorldComparison('获得一个可能改变未来的发展机会');
  check(JSON.stringify(cross.results.modern.ai_input_snapshot)===JSON.stringify(cross.results.ancient.ai_input_snapshot),'identical cross inputs');
  check(JSON.stringify(state.current_character)===beforeCross&&state.game_date===beforeDate,'cross is read only');
  check(JSON.stringify(cross.results.modern.ai_output.event)!==JSON.stringify(cross.results.ancient.ai_output.event),'different concrete context');
  review(cross.results.ancient.log_id,'合理','');addCandidate(cross.results.ancient.log_id,'跨世界候选');
  check(state.event_candidates.at(-1).world_id==='ancient','candidate world');
  check(localStorage.getItem(storageKey('modern'))===modernSaved,'ancient operations preserve modern');
  const exportAncient={format:FORMAT,version:1,state:clone(state)};
  const malformed=clone(exportAncient);delete malformed.state.cross_world_comparisons[0].results.ancient.ai_output;
  let malformedRejected=false;const beforeImport=JSON.stringify(state);try{importSave(malformed);}catch(_){malformedRejected=true;}
  check(malformedRejected&&JSON.stringify(state)===beforeImport,'malformed cross import preserves state');
  clearWorld();check(state.sim_logs.length===0,'clear active');
  importSave(exportAncient);check(state.current_character.character_id===ancientId&&state.cross_world_comparisons.length===1,'import restores cross');
  const savedAncient=localStorage.getItem(storageKey());
  switchWorld('modern');
  check(state.current_character.character_id===originalPerson.character_id&&state.event_candidates.length===1,'modern restored');
  let rejected=false;try{importSave(exportAncient);}catch(_){rejected=true;}
  check(rejected&&state.current_character.character_id===originalPerson.character_id,'wrong world import rejected');
  clearWorld();check(localStorage.getItem(storageKey('ancient'))===savedAncient,'clear preserves other world');
  switchWorld('ancient');
  const prior=JSON.stringify(state);
  for(const word of worldConfig().forbidden_contexts){
    let failed=false;try{startComparison('参与'+word+'活动',5);}catch(_){failed=true;}
    check(failed,'forbidden term '+word);
  }
  check(JSON.stringify(state)===prior,'invalid scenario leaves no data');
  for(let i=0;i<200;i++){
    const c=generateCharacter(state.game_date),s=snapshot(c,state.game_date);
    assertWorldText(JSON.stringify(c),'ancient');
    for(let m=0;m<12;m++){const event=mockEvent(s);const out=mockDecision(s,event);validateDecision(out,s,'ancient');}
  }
  createCharacter(true);check(state.current_character.life_goal===null,'baby no goal');advance();
  state.current_character.birth_date='2015-03-01';state.game_date='2027-02-01';state.anchor_day=1;
  check(ageOn(state.current_character.birth_date,state.game_date)===11,'before birthday');
  advance();check(state.current_character.life_goal!==null&&state.sim_logs.at(-1).executed_results.some(r=>r.type==='life_goal_generated'),'12th birthday goal');

  const fixedPerson=snapshot(generateCharacter('2026-01-01'),'2026-01-01');
  fixedPerson.birth_date='1990-01-01';fixedPerson.age=36;fixedPerson.simple_identity='农户家庭成员';fixedPerson.gender='男';
  fixedPerson.personality={'外向性':50,'直觉性':50,'思考性':50,'计划性':99};
  fixedPerson.talents=Object.fromEntries(TALENTS.map(k=>[k,50]));fixedPerson.life_goal='家庭生活';
  fixedPerson.interests=[{name:'音乐',intensity:99,source:'temporary_ai'}];fixedPerson.skills=[];
  const ev=(category,description,world='modern',extra={})=>({title:category,description,category,world_id:world,is_temporary_ai_event:true,minimum_age:0,maximum_age:120,...extra});
  const social=ev('社交','朋友临时邀请参加音乐活动。');
  const safety=ev('治安问题','熟人提醒沿途存在风险，建议核实出行路线。','ancient',{tags:['travel']});
  const workshop=ev('手工业学习','邻近作坊提供一次短期试学，需要协调当天劳动时间。','ancient',{tags:['education','family']});
  const away=ev('工作机会','需要长期离乡工作，长期契约条件尚未确认。','ancient');
  const business=ev('商贸机会','熟人提供经商机会，需要先核算成本。','ancient');
  const apprentice=ev('学徒经历','接受长期学徒训练机会。','ancient');
  const office=ev('声望与身份变化','申请公开职位和功名机会。','ancient');
  const call=(person,event,seed=123,options={})=>mockDecision(person,event,event.world_id,{seed,...options});
  const distribution=out=>out.candidate_actions.map(a=>a.probability_units);
  const participates=out=>out.candidate_actions.filter(a=>a.action_tags.includes('participate')).reduce((s,a)=>s+a.probability,0);
  const without=clone(fixedPerson);without.interests=[{name:'音乐',intensity:0,source:'temporary_ai'}];
  const changed=clone(fixedPerson);changed.personality=Object.fromEntries(PERSONALITY.map(k=>[k,0]));changed.life_goal='财富积累';changed.interests=[{name:'自然',intensity:1,source:'temporary_ai'}];changed.talents=Object.fromEntries(TALENTS.map(k=>[k,0]));
  for(const event of [social,safety,workshop,away,business,office]){
    const options1=generateCandidateActions(event,decisionContext(fixedPerson,event,event.world_id));
    const options2=generateCandidateActions(event,decisionContext(changed,event,event.world_id));
    check(JSON.stringify(options1)===JSON.stringify(options2),'attributes cannot create options');
  }
  const neutralSafety=call(without,safety),musicSafety=call(fixedPerson,safety);
  check(musicSafety.candidate_actions.every(a=>a.modifiers.interest===0),'music99 irrelevant to safety');
  check(JSON.stringify(distribution(neutralSafety))===JSON.stringify(distribution(musicSafety)),'irrelevant interest leaves probabilities identical');
  const music=call(fixedPerson,social),noMusic=call(without,social);
  check(participates(music)>participates(noMusic),'music increases participation group');
  check(music.generated_actions.every(a=>!a.action.includes('练音乐')&&!a.action.includes('自己练')),'no invented private practice');
  const outgoing=clone(without);outgoing.personality['外向性']=90;
  const introvert=clone(without);introvert.personality['外向性']=10;
  const outSocial=call(outgoing,social),inSocial=call(introvert,social);
  check(participates(outSocial)>participates(inSocial),'extroversion increases participation');
  check(outSocial.candidate_actions.find(a=>a.action_id==='decline').probability>0,'outgoing can decline');
  // 同一个人物与事件重复100次。随机种子固定，可复现，不使用随机断言。
  const counts={},expected={};let nonMaximum=0;
  for(let i=0;i<100;i++){
    const out=call(fixedPerson,social,(i+1)*7919);
    validateDecision(out,fixedPerson,'modern');
    counts[out.chosen_action_id]=(counts[out.chosen_action_id]||0)+1;
    for(const a of out.candidate_actions)expected[a.action_id]=(expected[a.action_id]||0)+a.probability/100;
    if(out.candidate_actions.find(a=>a.action_id===out.chosen_action_id).probability<Math.max(...out.candidate_actions.map(a=>a.probability)))nonMaximum++;
  }
  check(Object.keys(counts).length>=3&&nonMaximum>0,'100 draws include multiple and nonmaximum choices');
  for(const id of Object.keys(expected))check(Math.abs((counts[id]||0)-expected[id])<14,'100 draws follow probabilities');
  console.log('REPEAT_100 '+JSON.stringify({counts,expected,nonMaximum}));
  const lowPlan=clone(fixedPerson);lowPlan.personality['计划性']=1;
  check(call(fixedPerson,social).candidate_actions.find(a=>a.action_id==='confirm').probability>call(lowPlan,social).candidate_actions.find(a=>a.action_id==='confirm').probability,'planning raises confirmation a little');
  const ordinary=[
    social,ev('社交','朋友邀请参加绘画活动。'),workshop,ev('邻里关系','邻里邀请分担一次临时互助。','ancient'),
    ev('家庭','家人希望分担今天的家务。'),ev('农业生产','家中长辈带人查看作物。','ancient'),
    ev('日常','眼前有一件日常小事。'),ev('学习','附近有一次阅读体验。'),ev('市集','熟人邀请结伴去市集。','ancient'),ev('亲属事务','亲属临时来访。','ancient')
  ];
  const ordinaryChoices=ordinary.map((event,i)=>call(fixedPerson,event,101+i*32719).chosen_action);
  check(ordinaryChoices.some(a=>!/确认|问清|了解|核实/.test(a)),'planner99 not always ask across 10 ordinary events');
  const longDecision=call(fixedPerson,away);
  check(longDecision.event_decision_stability>music.event_decision_stability,'long decisions more stable');
  check(longDecision.candidate_actions[0].random_amplitude<music.candidate_actions[0].random_amplitude/4,'long decisions lower noise');
  check(longDecision.excluded_actions.some(a=>a.requires_terms&&a.probability===0),'unconfirmed long contract blocked even before personality');
  const illness=call(outgoing,social,123,{assumption:'severe_illness'});
  const care=call(fixedPerson,social,123,{assumption:'family_care'});
  check([illness,care].every(o=>o.excluded_actions.some(a=>a.action_id==='attend')&&o.candidate_actions.every(a=>!a.outdoors)),'illness and compulsory care dominate interests');
  const emergency=call(fixedPerson,ev('紧急事件','紧急失火，立即面临危险。'));
  check(emergency.excluded_actions.some(a=>a.delays_emergency),'delay excluded in emergency');
  check(emergency.candidate_actions.every(a=>a.modifiers.personality_dimensions['计划性']===0),'emergency planning has no preference to wait');
  const poor=call(fixedPerson,ev('商贸机会','经商邀约。','ancient',{conditions:{funds_available:false}}));
  check(poor.excluded_actions.some(a=>a.requires_funds),'funding feasibility');
  check(JSON.stringify(GOAL_RELEVANCE_MULTIPLIER)===JSON.stringify({unrelated:0,indirect:.2,direct:1}),'old goal multipliers retained');
  const byGoal=(goal,event)=>{const p=clone(fixedPerson);p.life_goal=goal;return call(p,event);};
  check([safety,workshop,ordinary[3]].every(e=>byGoal('家庭生活',e).candidate_actions.every(a=>a.modifiers.life_goal===0)),'family irrelevant to safety short learning and neighbors');
  check(byGoal('财富积累',safety).candidate_actions.every(a=>a.modifiers.life_goal===0),'wealth irrelevant to safety');
  for(const [goal,event] of [['家庭生活',away],['财富积累',business],['职业成就',apprentice],['声望地位',office]]){
    check(byGoal(goal,event).candidate_actions.some(a=>a.goal_relevance==='direct'&&a.modifiers.life_goal>0),'direct goal still participates '+goal);
  }
  check(byGoal('职业成就',workshop).candidate_actions.some(a=>a.goal_relevance==='indirect'&&a.modifiers.life_goal>0&&a.modifiers.life_goal<=.1),'indirect weak');
  const goalDistributions=GOALS.map(g=>distribution(byGoal(g,safety)));
  check(goalDistributions.every(d=>JSON.stringify(d)===JSON.stringify(goalDistributions[0])),'unrelated goals identical');
  const historySafety={...safety,description:'上月选择了“为了家庭稳定放弃重大机会”。'+safety.description};
  check(byGoal('家庭生活',historySafety).candidate_actions.every(a=>a.modifiers.life_goal===0),'previous action cannot make current safety goal relevant');
  const noTalent=clone(fixedPerson);noTalent.talents=Object.fromEntries(TALENTS.map(k=>[k,100]));
  check(call(noTalent,social).candidate_actions.every(a=>a.modifiers.talent===0),'talents cannot influence ordinary social');
  for(const event of ordinary.concat([away,business,apprentice,office,ev('日常','眼前的普通事情。')]))for(const person of [fixedPerson,changed]){
    const out=call(person,event);validateDecision(out,person,event.world_id);
    check(out.candidate_actions.reduce((s,a)=>s+a.probability_units,0)===1000,'exact probability sum');
    for(const a of out.candidate_actions){
      check(DECISION_RULES.trait_names.every(t=>a.traits[t]>=0&&a.traits[t]<=1),'structured traits');
      check(Object.values(a.modifiers.personality_dimensions).every(v=>Math.abs(v)<=.35),'single dimension bounded');
      check(Math.abs(a.modifiers.interest)<=.45&&Math.abs(a.modifiers.life_goal)<=.5&&Math.abs(a.modifiers.talent)<=.15,'other sources bounded');
    }
  }
  const known=ev('学习','参加手工技能学习。','ancient');
  const subject=clone(fixedPerson);subject.interests=[{name:'音乐',intensity:99,source:'temporary_ai'}];
  const learning=call(subject,known,5,{draw:0});
  check(learning.suggested_effects.length===1&&learning.suggested_effects[0].skill_name==='木工','practice skill from event not highest interest');
  const refused=call(subject,known,5,{draw:.9999});
  check(refused.suggested_effects.length===0,'declined learning creates no skills');
  const corrupt=clone(music);corrupt.candidate_actions[0].probability_units++;
  let invalid=false;try{validateDecision(corrupt,fixedPerson,'modern');}catch(_){invalid=true;}check(invalid,'bad probabilities rejected');
  const forced=clone(music);forced.chosen_action_id='made_up';
  invalid=false;try{validateDecision(forced,fixedPerson,'modern');}catch(_){invalid=true;}check(invalid,'arbitrary winner rejected');
  check(JSON.stringify(call(fixedPerson,social,123))===JSON.stringify(call(fixedPerson,social,123)),'seed reproduces probability and choice');
  const replay=mockDecision(fixedPerson,social,'modern',{seed:music.sampling.seed,draw:music.sampling.draw,assumption:music.decision_context.assumption});
  check(JSON.stringify(replay)===JSON.stringify(music),'audit seed and draw replay');
  for(const dimension of PERSONALITY){
    const low=clone(without),high=clone(without);low.personality=Object.fromEntries(PERSONALITY.map(k=>[k,50]));high.personality=clone(low.personality);low.personality[dimension]=0;high.personality[dimension]=100;
    const l=call(low,social),h=call(high,social);
    check(h.candidate_actions.every((a,i)=>Math.abs(a.probability-l.candidate_actions[i].probability)<18&&a.probability<60),'single dimension cannot dominate');
  }
  const safe=JSON.stringify(state),decider=mockDecision;mockDecision=()=>({});
  let rollback=false;try{advance();}catch(_){rollback=true;}mockDecision=decider;
  check(rollback&&JSON.stringify(state)===safe,'bad output rolls back month');
`);
const saved=Object.fromEntries(app.storage);
const reloaded=boot(saved);
assert.equal(reloaded.run('activeWorld'),'ancient');
assert.equal(reloaded.run('JSON.stringify(state)'),app.run('JSON.stringify(state)'));
const legacy=app.run(`JSON.stringify({...newState(),world_id:undefined,cross_world_comparisons:undefined})`);
const migrated=boot({'pea_character_sim_static_v1':legacy});
assert.equal(migrated.run('state.world_id'),'modern');
assert.equal(migrated.storage.get('pea_character_sim_static_v1'),legacy,'legacy backup kept');
assert.ok(migrated.storage.has('modern_pea_character_sim_static_v1'));
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
for(const src of html.matchAll(/(?:src|href)="([^"]+)"/g))assert.match(src[1],/^\.\//);
assert.doesNotMatch(code,/\bfetch\s*\(|XMLHttpRequest|WebSocket|localhost|127\.0\.0\.1|8765|file:\/\/|[A-Z]:[\\/]Users[\\/]/i);
console.log('PASS: switching, isolation, migration, reload, imports, 1/3/12 months, fixed traits, birthday, reviews, candidates, 5/20 comparisons, cross-world snapshots, world scoring, 2400 ancient decisions, probabilistic decisions (10 regressions + goal gating), action traits, invalid output rollback, relative assets and no network.');
