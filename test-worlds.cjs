'use strict';
// node test-worlds.cjs — 标准库检查；不联网，不读取或写入真实浏览器存档。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const code = ['worlds.js','app.js'].map(f=>fs.readFileSync(path.join(__dirname,f),'utf8')).join('\n');
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
  const fixedPerson=snapshot(state.current_character,state.game_date);
  fixedPerson.personality={'外向性':100,'直觉性':100,'思考性':0,'计划性':0};fixedPerson.life_goal='声望地位';fixedPerson.birth_date='2000-01-01';fixedPerson.age=27;fixedPerson.simple_identity='无业';
  const a=concreteEvent(fixedPerson,'获得一个可能改变未来的发展机会','modern'),b=concreteEvent(fixedPerson,'获得一个可能改变未来的发展机会','ancient');
  check(mockDecision(fixedPerson,a,'modern',[0,0,0,0]).chosen_action!==mockDecision(fixedPerson,b,'ancient',[0,0,0,0]).chosen_action,'world changes choice');
  const costs=mockDecision(fixedPerson,b,'ancient',[0,0,0,0]);
  const noTravel=mockDecision(fixedPerson,{...b,tags:[]},'ancient',[0,0,0,0]);
  check(costs.candidate_actions[0].score<noTravel.candidate_actions[0].score,'travel changes scores');
  let invalid=false;try{validateDecision({event:b,candidate_actions:[],suggested_effects:[]},fixedPerson,'ancient');}catch(_){invalid=true;}check(invalid,'invalid output rejected');
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
console.log('PASS: switching, isolation, migration, reload, imports, 1/3/12 months, fixed traits, birthday, reviews, candidates, 5/20 comparisons, cross-world snapshots, world scoring, 2400 ancient decisions, invalid output rollback, relative assets and no network.');
