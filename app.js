'use strict';

const STORAGE_KEY = 'pea_character_sim_static_v1';
let activeWorld = 'modern';
const storageKey = (worldId = activeWorld) => `${worldId}_${STORAGE_KEY}`;
const FORMAT = 'pea-character-sim-static';
const RULES_VERSION = 'prototype-2-worlds';
const TALENTS = ['智力', '社交', '运动', '抗压', '好奇心'];
const PERSONALITY = ['外向性', '直觉性', '思考性', '计划性'];
const GOALS = ['职业成就', '家庭生活', '声望地位', '财富积累'];
const SURNAMES = [...'赵钱孙李周吴郑王陈林许沈'];
const NAMES = ['安宁', '知远', '小满', '明月', '一禾', '思源', '晓雨', '清和'];
const EFFORT = {'轻量':1,'常规':2,'专注':3};
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone = value => JSON.parse(JSON.stringify(value));
const pretty = value => `<pre class="json">${esc(JSON.stringify(value, null, 2))}</pre>`;
const now = () => new Date().toISOString();
const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
const randomInt = (low, high) => Math.floor(Math.random() * (high - low + 1)) + low;
const choice = values => values[randomInt(0, values.length - 1)];
const sample = (values, count) => {
  const pool = [...values], result = [];
  while (result.length < count) result.push(pool.splice(randomInt(0, pool.length - 1), 1)[0]);
  return result;
};
const round = (value, places = 2) => Number(value.toFixed(places));

let state;
let busy = false;
let stopRequested = false;
let logLimit = 20;
let selectedBatch = '';
let selectedCrossBatch = '';
let dialogAction;

function parseDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('日期格式不合法。');
  const [year, month, day] = value.split('-').map(Number);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) throw new Error('日期不存在。');
  return {year, month, day};
}
function daysInMonth(year, month) { return new Date(Date.UTC(year, month, 0)).getUTCDate(); }
function isoDate(year, month, day) { return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`; }
function ageOn(birth, today) {
  const b = parseDate(birth), d = parseDate(today);
  return d.year - b.year - (d.month < b.month || (d.month === b.month && d.day < b.day) ? 1 : 0);
}
function nextMonth(today, anchorDay) {
  let {year, month} = parseDate(today);
  month += 1;
  if (month === 13) { year += 1; month = 1; }
  return isoDate(year, month, Math.min(anchorDay, daysInMonth(year, month)));
}
function mbti(personality) {
  return [['I','E'],['S','N'],['F','T'],['P','J']].map((pair, index) => pair[personality[PERSONALITY[index]] >= 50 ? 1 : 0]).join('');
}
function simpleIdentity(age, existing, worldId = activeWorld) {
  if (age < 6) return '幼儿';
  if (worldId === 'ancient') {
    const options = age < 18 ? worldConfig(worldId).youth_identities : worldConfig(worldId).adult_identities;
    return options.includes(existing) ? existing : choice(options);
  }
  if (age < 18) return '学生';
  return ['工作','无业'].includes(existing) ? existing : '无业';
}
function weightedChoice(values, weights) {
  let target = Math.random() * weights.reduce((sum, value) => sum + value, 0);
  for (let index = 0; index < values.length; index++) {
    target -= weights[index];
    if (target <= 0) return values[index];
  }
  return values.at(-1);
}
function newState() {
  return {version:1, world_id:activeWorld, mode:'STATIC MOCK MODE', game_date:'2026-01-01', anchor_day:1,
    current_character:null, sim_logs:[], event_candidates:[], comparisons:[], cross_world_comparisons:[]};
}
function isObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function validateCharacter(c) {
  if (!isObject(c) || typeof c.character_id !== 'string' || typeof c.birth_date !== 'string') throw new Error('人物结构不完整。');
  parseDate(c.birth_date);
  if (!TALENTS.every(key => Number.isInteger(c.talents?.[key]) && c.talents[key] >= 0 && c.talents[key] <= 100)) throw new Error('人物天赋不合法。');
  if (!PERSONALITY.every(key => Number.isInteger(c.personality?.[key]) && c.personality[key] >= 0 && c.personality[key] <= 100)) throw new Error('人物性格不合法。');
  if (!Array.isArray(c.interests) || !Array.isArray(c.skills) || !Array.isArray(c.experiences)) throw new Error('人物列表字段不完整。');
  if (c.life_goal !== null && !GOALS.includes(c.life_goal)) throw new Error('人生目标不合法。');
}
function validateState(candidate) {
  if (!isObject(candidate) || candidate.version !== 1 || candidate.mode !== 'STATIC MOCK MODE') throw new Error('这不是可识别的静态 Mock 存档。');
  if ((candidate.world_id || 'modern') !== activeWorld) throw new Error('存档所属世界与当前世界不同，请先切换对应世界再导入。');
  candidate.world_id ||= 'modern';
  candidate.cross_world_comparisons ||= [];
  if (!Array.isArray(candidate.cross_world_comparisons) || !candidate.cross_world_comparisons.every(b=>isObject(b)&&typeof b.comparison_id==='string'&&isObject(b.results)&&['modern','ancient'].every(w=>isObject(b.results[w])&&b.results[w].world_id===w&&typeof b.results[w].log_id==='string'))) throw new Error('跨世界对比记录不合法。');
  for (const batch of candidate.cross_world_comparisons) {
    validateCharacter(batch.character);
    if (batch.source_world!==activeWorld || typeof batch.abstract_scenario!=='string') throw new Error('跨世界对比来源不合法。');
    for (const worldId of ['modern','ancient']) {
      const record=batch.results[worldId];
      if (!Array.isArray(record.executed_results)||JSON.stringify(record.ai_input_snapshot)!==JSON.stringify(batch.character)) throw new Error('跨世界对比人物快照不一致。');
      validateDecision(record.ai_output,batch.character,worldId);
    }
  }
  parseDate(candidate.game_date);
  if (!Number.isInteger(candidate.anchor_day) || candidate.anchor_day < 1 || candidate.anchor_day > 31) throw new Error('存档日期锚点不合法。');
  for (const key of ['sim_logs','event_candidates','comparisons']) if (!Array.isArray(candidate[key])) throw new Error(`存档缺少 ${key}。`);
  if (candidate.current_character !== null) validateCharacter(candidate.current_character);
  if (!candidate.sim_logs.every(item => isObject(item) && typeof item.log_id === 'string')) throw new Error('日志结构不合法。');
  if (!candidate.event_candidates.every(item => isObject(item) && item.status === 'candidate')) throw new Error('候选事件结构不合法。');
  if (!candidate.comparisons.every(item => isObject(item) && Array.isArray(item.log_ids) && Number.isInteger(item.count) && item.count >= 5 && item.count <= 20)) throw new Error('对比批次结构不合法。');
  if (activeWorld === 'ancient') {
    if (candidate.current_character) assertWorldText(JSON.stringify(candidate.current_character),activeWorld);
    for (const r of candidate.sim_logs) if (r.ai_output) assertWorldText(JSON.stringify(r.ai_output),activeWorld);
  }
  return candidate;
}
function saveState() {
  const encoded = JSON.stringify(state);
  localStorage.setItem(storageKey(), encoded);
  $('storage-info').textContent = `${worldConfig().name}存档已保存 · 约 ${Math.ceil(new Blob([encoded]).size / 1024)} KB · 无云端同步`;
}
function loadState() {
  const raw = localStorage.getItem(storageKey()) ?? (activeWorld === 'modern' ? localStorage.getItem(STORAGE_KEY) : null);
  if (!raw) return newState();
  try { return validateState(JSON.parse(raw)); }
  catch (error) {
    // 保存故障副本失败时中止，避免覆盖唯一的存档。
    localStorage.setItem(`${storageKey()}_invalid_${Date.now()}`, raw);
    setTimeout(() => status(`原浏览器存档无法读取，已保留故障副本并创建空存档：${error.message}`, true));
    return newState();
  }
}
function commit(change) {
  const before = clone(state);
  try { const result = change(); saveState(); return result; }
  catch (error) { state = before; throw error; }
}
function snapshot(character, today) {
  if (!character) return null;
  return {...clone(character), age:ageOn(character.birth_date, today), mbti:mbti(character.personality), game_date:today};
}
function generateInterests(worldId = activeWorld) {
  return sample(Object.keys(worldConfig(worldId).interest_examples), randomInt(2,4)).map(name => ({name, intensity:randomInt(15,100), source:'temporary_ai'}));
}
function generateCharacter(today, baby = false) {
  const d = parseDate(today);
  const years = baby ? 0 : randomInt(12,45);
  const birthYear = d.year - years;
  const birthDate = isoDate(birthYear, d.month, Math.min(d.day, daysInMonth(birthYear, d.month)));
  const age = ageOn(birthDate, today);
  const character = {
    character_id:uid(), surname:choice(SURNAMES), given_name:choice(NAMES), gender:choice(['女','男']),
    birth_date:birthDate, alive:true, simple_identity:simpleIdentity(age, choice(['工作','无业'])), identity_source:'temporary_test',
    talents:Object.fromEntries(TALENTS.map(key => [key,randomInt(0,100)])),
    personality:Object.fromEntries(PERSONALITY.map(key => [key,randomInt(0,100)])),
    interests:generateInterests(), life_goal:null, goal_generation:null, skills:[], experiences:[]
  };
  generateGoal(character, today);
  return character;
}
function generateGoal(character, today) {
  if (character.life_goal !== null || ageOn(character.birth_date, today) < 12) return null;
  const p = character.personality;
  const signals = [p['计划性'],100-p['思考性'],p['外向性'],p['思考性']];
  const goalInterests = worldConfig().goal_interests;
  // TODO: 临时权重，确保任何目标都保留随机可能性。
  const weights = GOALS.map((goal,index) => round(20 + signals[index]*.35 + Math.max(0,...character.interests.filter(i=>goalInterests[goal].includes(i.name)).map(i=>i.intensity))*.25));
  const goal = weightedChoice(GOALS, weights);
  character.life_goal = goal;
  character.goal_generation = {date:today, source:'temporary_program_rule', weights:Object.fromEntries(GOALS.map((name,index)=>[name,weights[index]])), rule_version:RULES_VERSION, reason:'参考四维性格、临时兴趣样例匹配，以非零权重随机抽取；此后固定。'};
  return {type:'life_goal_generated', goal, ...clone(character.goal_generation)};
}
function makeLog(kind, before, today, worldId = activeWorld) {
  return {log_id:uid(), kind, world_id:worldId, game_date:today, created_at:now(), rules_version:RULES_VERSION,
    character_before:before, ai_input_snapshot:null, ai_calls:[], ai_output:null, candidate_actions:[],
    chosen_action:null, decision_reasons:[], executed_results:[], character_after:null, status:'ok', error:null,
    user_review:null, in_event_candidates:false};
}
function audit(record, task, input, output) {
  record.ai_calls.push({task, world_id:record.world_id, mode:'static_mock', model:'Mock 随机规则 v2', input:clone({...input,world:worldConfig(record.world_id)}),
    raw_output:JSON.stringify(output), structured_output:clone(output), error:null, requested_at:now()});
}
function createCharacter(baby) {
  return commit(() => {
    const today = state.game_date;
    const record = makeLog('generation', snapshot(state.current_character,today), today);
    const character = generateCharacter(today,baby);
    record.ai_input_snapshot = snapshot({...character,interests:[],life_goal:null,goal_generation:null},today);
    audit(record,'interests',{character:record.ai_input_snapshot},{interests:character.interests});
    record.executed_results.push({type:'interests_generated',source:'temporary_ai',interests:clone(character.interests)});
    if (character.life_goal) record.executed_results.push({type:'life_goal_generated',goal:character.life_goal,...clone(character.goal_generation)});
    state.current_character = character;
    record.character_after = snapshot(character,today);
    state.sim_logs.push(record);
    return record;
  });
}
function mockEvent(c, worldId = activeWorld) {
  if (worldId === 'ancient') return ancientEvent(c);
  const age = c.age, interest = contextualInterest(c,worldId);
  let title, description, category;
  if (age < 3) [title,description,category] = ['照护中的新声音','照护者带来一个安全的发声玩具，观察孩子愿意独自听还是互动。','日常'];
  else if (age < 6) [title,description,category] = ['一起玩一会儿','在照护者陪同下，有机会加入一个小型游戏，也可以先在旁边观察。','日常'];
  else {
    const previous = c.experiences.at(-1);
    const context = previous ? `上月选择了“${previous.action}”。` : '目前没有记录过模拟经历。';
    const options = [
      ['陌生的小聚会','朋友邀请参加周末的陌生小聚会，可决定是否参与以及怎样参与。','社交'],
      ['兴趣体验机会',`本月有一次适龄的${interest.name}体验，可投入练习，也可先了解或放弃。`,'学习'],
      ['家中的空闲时段','家人希望一起聊聊天，同一时段也可以自行安排感兴趣的活动。','家庭'],
      ['尝试新的安排','一个适龄的日常小组活动正在征求参与者，可尝试，也可保留原有安排。','探索']
    ];
    if (c.simple_identity === '学生') options.push(['学校的自选活动','学校有一个可自由报名的兴趣活动，需要考虑是否投入课余时间。','学校']);
    if (c.simple_identity === '工作') options.push(['工作间隙的分享','有机会在工作间隙参加经验分享，不涉及薪资或职位变更。','工作']);
    [title,description,category] = choice(options); description = context + description;
  }
  return {title,description,category,world_id:worldId,is_temporary_ai_event:true,minimum_age:age<6?0:6,maximum_age:120};
}
function mockDecision(c,event,worldId = activeWorld,noise = Array.from({length:4},()=>Math.random()*18-9)) {
  if (worldId === 'ancient') return ancientDecision(c,event,noise);
  const p=c.personality, goal=c.life_goal, interest=contextualInterest(c,worldId);
  const [e,n,t,j]=['外向性','直觉性','思考性','计划性'].map(key=>p[key]);
  const social=event.category==='社交'||['聚会','朋友','社交'].some(word=>event.description.includes(word));
  const family=event.category==='家庭'||event.description.includes('家人');
  let labels,scores;
  if(c.age<3){labels=['主动向照护者表达兴趣','先安静观察，再短暂接触','偏好熟悉的安静陪伴'];scores=[20+.65*e+.15*n,25+.4*j+.2*(100-e),20+.7*(100-e)];}
  else{
    labels=['主动参与，尝试新体验','先询问细节，再按计划有限参与','婉拒本次活动，保留原有安排','选择小范围参与，兼顾熟悉的人'];
    scores=[12+.5*e+.2*n+.1*(100-j)+(goal==='声望地位'?12:0),15+.45*j+.2*t+(goal==='职业成就'?12:0),10+.4*(100-e)+.3*interest.intensity+(goal==='财富积累'?12:0),15+.35*(100-t)+.2*(100-e)+(goal==='家庭生活'?20:0)];
    if(!social&&!family){labels[0]=`投入本次体验，练习${interest.name}相关能力`;scores[0]+=.2*interest.intensity-.15*e;}
    if(family)labels[3]='优先陪伴家人，调整自己的活动安排';
    if(c.age>=6)labels[2]=`婉拒本次活动，自己练习${interest.name}相关能力`;
  }
  scores=scores.map((value,index)=>round(Math.max(0,Math.min(100,value+noise[index])),1));
  const actionReasons=[`外向 ${e} 与直觉 ${n} 支持主动尝试；兴趣 ${interest.intensity} 在相关体验中参与评分。`,`计划 ${j} 与思考 ${t} 影响先核实再参与的倾向。`,`内向倾向 ${100-e} 与兴趣 ${interest.name} ${interest.intensity} 影响保留个人安排。`,`情感倾向 ${100-t}、内向倾向 ${100-e} 及家庭目标影响小范围参与。`];
  const chosenIndex=scores.indexOf(Math.max(...scores)), chosen=labels[chosenIndex];
  const reasons=[
    {factor:'性格',reason:`原始四维：外向 ${e}、直觉 ${n}、思考 ${t}、计划 ${j}；分别影响参与、尝试、权衡和安排方式。`},
    {factor:'兴趣',reason:`${interest.name}强度 ${interest.intensity}，影响愿意投入的方向，不直接增加技能。`},
    {factor:'人生目标',reason:goal?`长期优先级为${goal}，在可选行为间形成临时偏好。`:'未满12岁，没有人生目标，不按成人目标决策。'},
    {factor:'当前情况',reason:`${c.age}岁，测试身份${worldIdentity(c,worldId)}；已记录${c.experiences.length}次月度经历。本次仅处理给定小情境。`}
  ];
  let suggestedEffects=[],newSkillSuggestion=null;
  if(c.age>=6&&(chosenIndex===2||(chosenIndex===0&&!social&&!family))){
    const [skill,talents]=worldConfig(worldId).interest_examples[interest.name]||['基础观察',['好奇心']];
    const explanation=`Mock 临时判断：${skill}练习涉及${talents.join('、')}。${talents.includes('抗压')?'接受反馈有练习压力，因此考虑抗压。':''}`;
    suggestedEffects=[{type:'skill_practice',action:chosen,skill_name:skill,effort:'常规',relevant_talents:talents,reason:explanation}];
    if(!c.skills.some(item=>item.name===skill))newSkillSuggestion={name:skill,source:'ai_generated',reason:'Mock AI临时内容：本月首次实际练习该技能。'};
    reasons.push({factor:'天赋',reason:explanation+'程序按投入和相关天赋计算增长，不设天赋硬上限。'});
  }
  reasons.push({factor:'世界约束',reason:worldConfig(worldId).behavior_constraints.description});
  return {event,candidate_actions:labels.map((action,index)=>({action,score:scores[index],reasons:[actionReasons[index]||actionReasons.at(-1)]})),chosen_action:chosen,decision_reasons:reasons,suggested_effects:suggestedEffects,new_skill_suggestion:newSkillSuggestion};
}
function skillGrowth(talents,relevant,effort){return round(EFFORT[effort]*(.5+relevant.reduce((sum,key)=>sum+talents[key],0)/relevant.length/100));}
function validateDecision(output,c,worldId) {
  if (!isObject(output) || !isObject(output.event) || output.event.world_id!==worldId || output.event.is_temporary_ai_event!==true || c.age<output.event.minimum_age || c.age>output.event.maximum_age) throw new Error('Mock事件世界或年龄范围不合法。');
  if (!Array.isArray(output.candidate_actions) || !output.candidate_actions.length || !output.candidate_actions.every(a=>typeof a.action==='string'&&Number.isFinite(a.score)&&a.score>=0&&a.score<=100&&Array.isArray(a.reasons)) || !output.candidate_actions.some(a=>a.action===output.chosen_action)) throw new Error('Mock候选行为不合法。');
  if (!Array.isArray(output.decision_reasons) || !Array.isArray(output.suggested_effects)) throw new Error('Mock判断字段不完整。');
  assertWorldText(JSON.stringify(output),worldId);
  for (const e of output.suggested_effects) {
    if (e.type!=='skill_practice'||e.action!==output.chosen_action||typeof e.skill_name!=='string'||!Object.hasOwn(EFFORT,e.effort)||!Array.isArray(e.relevant_talents)||!e.relevant_talents.length||!e.relevant_talents.every(t=>TALENTS.includes(t))||c.age<6) throw new Error('Mock技能建议不合法。');
    if (!c.skills.some(s=>s.name===e.skill_name) && output.new_skill_suggestion?.name!==e.skill_name) throw new Error('新技能缺少生成依据。');
  }
}
function decide(character,today,record,event=null,applyEffects=true,worldId=activeWorld,noise){
  const snap=snapshot(character,today);record.ai_input_snapshot=snap;
  if(!event){event=mockEvent(snap,worldId);audit(record,'event',{character:snap},event);}
  const output=mockDecision(snap,event,worldId,noise);audit(record,'decision',{character:snap,shared_event:event},output);
  validateDecision(output,snap,worldId);
  record.ai_output=clone(output);record.candidate_actions=clone(output.candidate_actions);record.chosen_action=output.chosen_action;record.decision_reasons=clone(output.decision_reasons);
  if(applyEffects){
    for(const effect of output.suggested_effects){
      let skill=character.skills.find(item=>item.name===effect.skill_name);
      if(!skill){skill={name:effect.skill_name,level:0,source:'ai_generated'};character.skills.push(skill);record.executed_results.push({type:'new_skill_created',...clone(skill),reason:output.new_skill_suggestion.reason});}
      const before=skill.level,calculated=skillGrowth(character.talents,effect.relevant_talents,effect.effort);skill.level=round(Math.min(100,before+calculated));
      record.executed_results.push({type:'skill_growth',skill:skill.name,before,after:skill.level,delta:round(skill.level-before),calculated_delta:calculated,effort:effect.effort,relevant_talents:Object.fromEntries(effect.relevant_talents.map(key=>[key,character.talents[key]])),talent_reason:effect.reason,source:'temporary_program_rule',formula:'投入档位 × 1 × (0.5 + 相关天赋均值 / 100)，统一量尺上限100'});
    }
    character.experiences.push({game_date:today,event_title:event.title,action:output.chosen_action,log_id:record.log_id,source:'temporary_ai'});
    if(!output.suggested_effects.length)record.executed_results.push({type:'experience_only',description:'只记录经历，没有属性数值变化。'});
  }else record.executed_results.push({type:'comparison_only',description:'对比仅判断，不推进月份或执行技能建议。'});
  record.character_after=snapshot(character,today);
}
function advance(){
  return commit(()=>{
    const character=state.current_character;if(!character||!character.alive)throw new Error('请先生成存活人物。');
    const previous=state.game_date,today=nextMonth(previous,state.anchor_day),record=makeLog('monthly',snapshot(character,previous),today);state.game_date=today;
    record.executed_results.push({type:'date_advanced',before:previous,after:today});
    const identity=simpleIdentity(ageOn(character.birth_date,today),character.simple_identity);
    if(identity!==character.simple_identity){record.executed_results.push({type:'temporary_identity_changed',before:character.simple_identity,after:identity,reason:'仅按年龄更新测试标签。'});character.simple_identity=identity;}
    const goal=generateGoal(character,today);if(goal)record.executed_results.push(goal);
    decide(character,today,record);state.sim_logs.push(record);return record;
  });
}
function startComparison(scenario,count){
  return commit(()=>{if(!Number.isInteger(count)||count<5||count>20)throw new Error('对比人数必须为5～20。');if(!scenario.trim()||scenario.length>2000)throw new Error('请输入1～2000字情境。');
    assertWorldText(scenario,activeWorld);
    const batch={comparison_id:uid(),world_id:activeWorld,created_at:now(),game_date:state.game_date,count,log_ids:[],event:{title:'同情境人物对比',description:scenario.trim(),category:'日常',world_id:activeWorld,is_temporary_ai_event:true,minimum_age:0,maximum_age:120}};state.comparisons.push(batch);return batch;});
}
function comparisonNext(batchId){
  return commit(()=>{const batch=state.comparisons.find(item=>item.comparison_id===batchId);if(!batch||batch.log_ids.length>=batch.count)throw new Error('对比不存在或已经完成。');
    const record=makeLog('comparison',null,batch.game_date);record.comparison_id=batchId;const character=generateCharacter(batch.game_date,false);record.ai_input_snapshot=snapshot({...character,interests:[],life_goal:null,goal_generation:null},batch.game_date);audit(record,'interests',{character:record.ai_input_snapshot},{interests:character.interests});record.character_before=snapshot(character,batch.game_date);decide(character,batch.game_date,record,{...clone(batch.event),world_id:activeWorld},false);batch.log_ids.push(record.log_id);state.sim_logs.push(record);return record;});
}
function crossWorldComparison(scenario) {
  return commit(()=>{
    if (!state.current_character || !state.current_character.alive) throw new Error('请先在当前世界生成存活人物。');
    if (!scenario.trim() || scenario.length>2000) throw new Error('请输入1～2000字抽象情境。');
    assertWorldText(scenario,'ancient');
    const character = snapshot(state.current_character,state.game_date);
    const batch = {comparison_id:uid(),source_world:activeWorld,created_at:now(),game_date:state.game_date,abstract_scenario:scenario.trim(),character:clone(character),noise:Array.from({length:4},()=>Math.random()*18-9),results:{}};
    for (const worldId of ['modern','ancient']) {
      const record = makeLog('cross_world',clone(character),state.game_date,worldId);
      const event = concreteEvent(character,batch.abstract_scenario,worldId);
      audit(record,'event',{character,abstract_scenario:batch.abstract_scenario},event);
      decide(clone(state.current_character),state.game_date,record,event,false,worldId,batch.noise);
      batch.results[worldId] = record;
    }
    state.cross_world_comparisons.push(batch);
    return batch;
  });
}
function getLog(id){const record=state.sim_logs.find(item=>item.log_id===id)||state.cross_world_comparisons.flatMap(b=>Object.values(b.results)).find(r=>r.log_id===id);if(!record)throw new Error('找不到这条日志。');return record;}
function switchWorld(worldId) {
  worldConfig(worldId);
  if (busy) return;
  saveState();
  const previous = {world:activeWorld,state};
  try {
    activeWorld=worldId; state=loadState(); saveState();
    localStorage.setItem('pea_character_sim_active_world',activeWorld);
  } catch (error) { activeWorld=previous.world; state=previous.state; $('world-select').value=activeWorld; throw error; }
  selectedBatch=''; selectedCrossBatch=''; logLimit=20;
  $('scenario').value=activeWorld==='ancient'?'邻里邀请参加一个陌生的人情聚集。':'朋友邀请周末参加一个完全陌生的社交聚会。';
  refresh(); status(`已读取${worldConfig().name}独立存档。`);
}
function importSave(envelope) {
  if (!isObject(envelope)||envelope.format!==FORMAT||envelope.version!==1||!isObject(envelope.state)) throw new Error('请选择“完整测试存档”导出的JSON。');
  const imported=validateState(clone(envelope.state));
  commit(()=>{state=imported;});
  selectedBatch='';selectedCrossBatch='';logLimit=20;
}
function clearWorld() { commit(()=>{state=newState();}); selectedBatch='';selectedCrossBatch='';logLimit=20; }
function renderWorld() {
  const config=worldConfig();document.body.dataset.world=activeWorld;
  $('world-select').value=activeWorld;$('world-name').textContent=config.name;
  $('world-description').textContent=config.description;
  $('world-rules').innerHTML=`<p>${esc(config.behavior_constraints.description)}</p><p>测试日历沿用统一年月标尺，不表示具体历史年代。</p>${GOALS.map(g=>`<p>${esc(g)}：${esc(config.goal_meanings[g])}</p>`).join('')}<details><summary>结构化世界卡</summary>${pretty(config)}</details>`;
  $('clear-data').textContent=`清空${config.name}测试数据`;
  $('export-all').textContent=`导出${config.name}完整测试存档`;
  const batches=state.cross_world_comparisons;
  if(!selectedCrossBatch&&batches.length)selectedCrossBatch=batches.at(-1).comparison_id;
  $('cross-batch').innerHTML=[...batches].reverse().map(b=>`<option value="${esc(b.comparison_id)}" ${b.comparison_id===selectedCrossBatch?'selected':''}>${esc(b.game_date)} · ${esc(b.character.surname+b.character.given_name)} · ${esc(b.abstract_scenario.slice(0,35))}</option>`).join('');
  renderCross();
}
function renderCross() {
  const batch=state.cross_world_comparisons.find(b=>b.comparison_id===selectedCrossBatch);
  if(!batch){$('cross-person').innerHTML='';$('cross-results').innerHTML='<p class="muted">先生成当前人物，再输入一个两边都适用的抽象情境。</p>';return;}
  $('cross-person').innerHTML=`<div class="card"><h3>共用人物：${esc(batch.character.surname+batch.character.given_name)}</h3><p>抽象情境：${esc(batch.abstract_scenario)}</p><details><summary>两边使用完全相同的属性快照</summary>${pretty(batch.character)}</details></div>`;
  $('cross-results').innerHTML=['modern','ancient'].map(w=>`<article class="card"><h2>${esc(worldConfig(w).name)}</h2>${eventCard(batch.results[w])}</article>`).join('');
}
function review(logId,verdict,note){return commit(()=>{if(!['合理','不合理'].includes(verdict)||note.length>1000)throw new Error('评价或备注不合法。');if(verdict==='不合理'&&!note.trim())throw new Error('请填写不合理的原因。');const record=getLog(logId);record.user_review={verdict,note:note.trim(),updated_at:now()};return record;});}
function addCandidate(logId,note){return commit(()=>{if(note.length>1000)throw new Error('备注最长1000字。');const existing=state.event_candidates.find(item=>item.log_id===logId);if(existing)return existing;const record=getLog(logId);if(!record.ai_output)throw new Error('这条记录没有可加入的事件。');const entry={candidate_id:uid(),world_id:record.world_id||activeWorld,log_id:logId,original_event:clone(record.ai_output.event),character_state:clone(record.ai_input_snapshot),ai_judgment:clone(record.ai_output),choice_result:{chosen_action:record.chosen_action,executed_results:clone(record.executed_results)},added_at:now(),user_note:note.trim(),status:'candidate'};state.event_candidates.push(entry);record.in_event_candidates=true;return entry;});}

function status(text,error=false){$('status').textContent=text;$('status').className=error?'error':'';}
function updateButtons(){document.querySelectorAll('[data-mutate]').forEach(button=>{button.disabled=busy||button.dataset.locked==='true'||((button.dataset.months||button.id==='cross-start')&&!state.current_character);});$('stop').hidden=!busy;}
async function run(work){if(busy)return;busy=true;stopRequested=false;updateButtons();try{await work();}catch(error){status(error.message,true);}finally{busy=false;updateButtons();}}
function metrics(values){return Object.entries(values).map(([name,value])=>`<div class="metric"><span>${esc(name)}</span><progress max="100" value="${value}" aria-label="${esc(name)} ${value}"></progress><span>${value}</span></div>`).join('');}
function characterCard(c,compact=false){if(!c)return '<p class="muted">先生成一个人物，开始观察。</p>';return `<div class="identity"><div><h3 class="name">${esc(c.surname+c.given_name)}</h3><p>${esc(c.gender)} · ${c.age}岁 · ${esc(c.simple_identity)} <span class="badge temp">临时测试身份</span></p></div><span class="badge">${esc(c.mbti)} · 仅显示标签</span></div><p class="muted">出生 ${esc(c.birth_date)} · ${c.alive?'存活':'已故'}</p><div class="attribute-grid">${compact?'':`<div><h4>天赋 · 永久固定</h4>${metrics(c.talents)}</div>`}<div><h4>性格 · 永久固定</h4>${metrics(c.personality)}</div></div><h4>兴趣 <span class="badge temp">Mock临时内容</span></h4><div class="tags">${c.interests.map(i=>`<span class="tag">${esc(i.name)} ${i.intensity}</span>`).join('')}</div><h4>人生目标</h4><p>${esc(c.life_goal||'未满12岁，尚未生成')} ${c.life_goal?'<span class="badge">已固定</span>':''}</p>${compact?'':`<h4>技能 · 实际已掌握能力</h4><div class="tags">${c.skills.length?c.skills.map(s=>`<span class="tag">${esc(s.name)} ${s.level} <small>Mock临时技能</small></span>`).join(''):'<span class="muted">暂无技能，兴趣和天赋不会自动变成技能。</span>'}</div><details><summary>人物完整数据与目标生成依据</summary>${pretty(c)}</details>`}`;}
function reviewControls(r){const rating=r.user_review?`${r.user_review.verdict}${r.user_review.note?'：'+r.user_review.note:''}`:'尚未评价';return `<p class="muted">评价：${esc(rating)}${r.in_event_candidates?' · 已加入候选事件库':''}</p><div class="review-row"><button data-review="合理" data-id="${r.log_id}" data-mutate>合理</button><button data-review="不合理" data-id="${r.log_id}" data-mutate>不合理</button><button data-candidate="${r.log_id}" data-mutate data-locked="${r.in_event_candidates}" ${r.in_event_candidates?'disabled':''}>${r.in_event_candidates?'已加入候选库':'加入候选事件库'}</button></div>`;}
function executed(results){return results.map(r=>{if(r.type==='skill_growth')return `<li>${esc(r.skill)}：${r.before} → ${r.after}（+${r.delta}）<div class="reason">${esc(r.talent_reason)}<br>${esc(r.formula)}</div></li>`;if(r.type==='life_goal_generated')return `<li>人生目标生成：${esc(r.goal)}（此后固定；临时加权随机规则）</li>`;if(r.type==='new_skill_created')return `<li>新建 Mock 临时技能：${esc(r.name)}，初始等级由程序设为0。</li>`;if(r.type==='date_advanced')return `<li>日期：${esc(r.before)} → ${esc(r.after)}</li>`;if(r.type==='interests_generated')return '<li>保存2～4项Mock临时兴趣。</li>';if(r.type==='temporary_identity_changed')return `<li>临时身份标签：${esc(r.before)} → ${esc(r.after)}</li>`;return `<li>${esc(r.description||r.reason||r.type)}</li>`;}).join('');}
function eventCard(r,compact=false){const out=r.ai_output;let html='';if(out){html+=`<h3>${esc(out.event.title)}</h3><span class="badge temp">Mock临时内容 · ${esc(out.event.category)} · ${esc(worldConfig(r.world_id||'modern').name)}</span><p>${esc(out.event.description)}</p>${compact?'':`<h4>候选行为 <small class="muted">评分不是概率</small></h4>${out.candidate_actions.map(a=>`<div class="action"><div class="action-head"><strong>${esc(a.action)}</strong><span>${a.score}</span></div><p class="reason">${a.reasons.map(esc).join('；')}</p></div>`).join('')}`}<h4>Mock 最终判断</h4><p class="chosen">${esc(out.chosen_action)}</p><h4>判断依据</h4>${out.decision_reasons.map(item=>`<p class="reason"><strong>${esc(item.factor)}</strong> · ${esc(item.reason)}</p>`).join('')}`;}html+=`<h4>程序实际执行</h4><ul>${executed(r.executed_results)}</ul>`;if(out)html+=reviewControls(r);html+=`<details><summary>完整审计 JSON（输入 / Mock输出 / 快照）</summary>${pretty(r)}</details>`;return html;}
function logSummary(r){const c=r.character_after||{},title=r.ai_output?.event?.title||(r.kind==='generation'?'人物生成':'Mock记录');return `<details class="card log-item" data-log="${r.log_id}"><summary><span class="log-meta">${esc(r.game_date)} · ${esc((c.surname||'')+(c.given_name||''))} · ${{generation:'生成',monthly:'月度',comparison:'对比'}[r.kind]}</span><span>${esc(title)}${r.user_review?' · '+esc(r.user_review.verdict):''}${r.in_event_candidates?' · 候选':''}</span></summary><div class="log-content">${eventCard(r)}</div></details>`;}
function renderComparison(){const batch=state.comparisons.find(item=>item.comparison_id===selectedBatch);$('compare-resume').hidden=!batch||batch.log_ids.length>=batch.count;if(!batch){$('batch').value='';$('comparison-results').innerHTML='<p class="muted">输入情境，生成第一组人物。</p>';return;}$('scenario').value=batch.event.description;$('comparison-results').innerHTML=batch.log_ids.map((id,index)=>{const r=getLog(id);return `<article class="card"><p class="eyebrow">人物 ${index+1} / ${batch.count}</p>${characterCard(r.character_after,true)}${eventCard(r,true)}</article>`;}).join('');}
function refresh(){renderWorld();const current=snapshot(state.current_character,state.game_date);$('date').textContent='游戏日期 · '+state.game_date;$('character').innerHTML=characterCard(current);const ordered=[...state.sim_logs].reverse();$('recent').innerHTML=ordered.slice(0,5).map(logSummary).join('')||'<p class="muted">尚无记录。</p>';$('log-list').innerHTML=ordered.slice(0,logLimit).map(logSummary).join('')||'<p class="muted">尚无记录。</p>';$('more').hidden=ordered.length<=logLimit;const latest=ordered.find(r=>r.kind==='monthly'&&r.character_after?.character_id===current?.character_id);$('latest').innerHTML=latest?eventCard(latest):'<p class="muted">推进一个月后，这里显示当前人物的情境、选择与实际结果。</p>';$('candidate-list').innerHTML=[...state.event_candidates].reverse().map(c=>`<article class="card"><span class="badge temp">candidate · Mock临时内容</span><h3>${esc(c.original_event.title)}</h3><p>${esc(c.original_event.description)}</p><p>备注：${esc(c.user_note||'无')}</p><p class="muted">加入时间：${esc(new Date(c.added_at).toLocaleString())}</p><details><summary>原始事件、人物状态与Mock判断</summary>${pretty(c)}</details></article>`).join('')||'<p class="muted">尚未加入候选事件。</p>';if(!selectedBatch&&state.comparisons.length)selectedBatch=state.comparisons.at(-1).comparison_id;$('batch').innerHTML=[...state.comparisons].reverse().map(b=>`<option value="${b.comparison_id}" ${b.comparison_id===selectedBatch?'selected':''}>${esc(b.game_date)} · ${b.log_ids.length}/${b.count}人 · ${esc(b.event.description.slice(0,35))}</option>`).join('');renderComparison();saveState();updateButtons();}
async function create(baby){status('正在生成静态 Mock 人物…');createCharacter(baby);refresh();status('人物已生成并保存在当前浏览器。');}
async function months(count){let done=0;for(let i=0;i<count;i++){if(stopRequested)break;status(`正在模拟第 ${i+1}/${count} 个月…`);advance();done++;refresh();await new Promise(requestAnimationFrame);}status(`已逐月保存在当前浏览器：${done}个月${stopRequested?'；已暂停':''}。`);}
async function compareLoop(id){const batch=state.comparisons.find(item=>item.comparison_id===id);let done=batch.log_ids.length;for(;done<batch.count;done++){if(stopRequested)break;status(`正在对比人物 ${done+1}/${batch.count}…`);comparisonNext(id);refresh();await new Promise(requestAnimationFrame);}status(`对比已保存在当前浏览器：${done}/${batch.count}人${stopRequested?'；可继续':''}。`);}
function download(filename,data){const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function dateStamp(){return new Date().toISOString().slice(0,10);}

document.querySelectorAll('[data-tab]').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('.panel').forEach(panel=>panel.hidden=panel.id!==button.dataset.tab);document.querySelectorAll('[data-tab]').forEach(item=>{item.classList.toggle('selected',item===button);item.setAttribute('aria-pressed',String(item===button));});}));
$('generate').onclick=()=>run(()=>create(false));$('baby').onclick=()=>run(()=>create(true));document.querySelectorAll('[data-months]').forEach(button=>button.onclick=()=>run(()=>months(Number(button.dataset.months))));$('stop').onclick=()=>{stopRequested=true;status('会在当前月份或人物完成保存后暂停。');};
$('compare-start').onclick=()=>run(async()=>{if(!$('count').reportValidity()||!$('scenario').value.trim()){status('请输入情境和5～20的人数。',true);return;}const batch=startComparison($('scenario').value,Number($('count').value));selectedBatch=batch.comparison_id;refresh();await compareLoop(selectedBatch);});$('compare-resume').onclick=()=>run(()=>compareLoop(selectedBatch));$('batch').onchange=()=>{selectedBatch=$('batch').value;renderComparison();};$('more').onclick=()=>{logLimit+=20;refresh();};
document.addEventListener('click',event=>{const button=event.target.closest('[data-review],[data-candidate]');if(!button||busy)return;dialogAction={log_id:button.dataset.id||button.dataset.candidate,verdict:button.dataset.review};$('dialog-title').textContent=button.dataset.review?`评价：${button.dataset.review}`:'加入候选事件库';$('review-note').value='';$('review-note').required=button.dataset.review==='不合理';$('review-dialog').showModal();$('review-note').focus();});
$('dialog-cancel').onclick=()=>$('review-dialog').close();$('review-form').onsubmit=event=>{event.preventDefault();run(async()=>{if(dialogAction.verdict)review(dialogAction.log_id,dialogAction.verdict,$('review-note').value);else addCandidate(dialogAction.log_id,$('review-note').value);$('review-dialog').close();refresh();status('已保存在当前浏览器。');});};
$('export-all').onclick=()=>{download(`character-sim-${activeWorld}-save-${dateStamp()}.json`,{format:FORMAT,version:1,mode:'STATIC MOCK MODE',world_id:activeWorld,exported_at:now(),state:clone(state)});status(`${worldConfig().name}完整测试存档已导出，包含跨世界对比历史。`);};
$('export-logs').onclick=()=>{download(`character-sim-${activeWorld}-logs-${dateStamp()}.json`,{format:`${FORMAT}-logs`,version:1,mode:'STATIC MOCK MODE',exported_at:now(),world_id:activeWorld,sim_logs:clone(state.sim_logs),cross_world_comparisons:clone(state.cross_world_comparisons)});status('测试日志已导出。');};
$('export-candidates').onclick=()=>{download(`character-sim-${activeWorld}-candidates-${dateStamp()}.json`,{format:`${FORMAT}-candidates`,version:1,mode:'STATIC MOCK MODE',exported_at:now(),world_id:activeWorld,event_candidates:clone(state.event_candidates)});status('候选事件已导出。');};
$('import-file').onchange=event=>{const file=event.target.files[0];event.target.value='';if(!file)return;run(async()=>{try{if(file.size>5*1024*1024)throw new Error('导入文件不能超过5 MB。');const envelope=JSON.parse(await file.text());importSave(envelope);refresh();status('当前世界存档已导入，另一世界不变。');}catch(error){status(`导入失败，当前数据未改变：${error.message}`,true);}});};
$('clear-data').onclick=()=>run(async()=>{if(!confirm(`确定清空${worldConfig().name}的人物、日志、候选事件和两类对比历史吗？另一世界不受影响。建议先导出。`))return;clearWorld();refresh();status('当前世界测试数据已清空。');});
$('world-select').onchange=()=>{try{switchWorld($('world-select').value);}catch(error){status(error.message,true);}};
$('cross-start').onclick=()=>run(async()=>{const batch=crossWorldComparison($('cross-scenario').value);selectedCrossBatch=batch.comparison_id;refresh();status('跨世界对比已保存，两边人物属性和时间均未改变。');});
$('cross-batch').onchange=()=>{selectedCrossBatch=$('cross-batch').value;renderCross();};

try {
  const savedWorld=localStorage.getItem('pea_character_sim_active_world');
  if(savedWorld&&Object.hasOwn(WORLD_CONFIGS,savedWorld))activeWorld=savedWorld;
  state=loadState();refresh();
} catch(error) {status(`浏览器存档读取失败：${error.message}。请检查存储权限或空间。`,true);}
