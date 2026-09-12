'use strict';

// TODO: 临时行为模板、现实条件和概率参数；不构成正式事件/职业/健康系统。
const DECISION_RULES = {
  version:'probabilistic-1',
  caps:{personality_dimension:.35, personality_total:.8, interest:.45, goal:.5, talent:.15},
  stability:{daily:.2, leisure:.35, social:.5, learning:.6, long_term:.9, safety:.95, emergency:.98},
  jitter_scale:.6, temperature_scale:.65, probability_units:1000,
  constraints:{normal:'正常条件',severe_illness:'本人重病，无法外出',family_care:'必须照护重病家人，无人替班',short_time:'仅有少量空闲时间'},
  domains:{
    音乐:/音乐|乐曲|钢琴|吹笛|演奏|听曲/,
    阅读:/阅读|读书|借书|识字|诗文|书法/, 运动:/运动|足球|体育|骑射|武艺|射箭/,
    绘画:/绘画|素描/, 技术:/编程|技术|软件/, 语言:/英语|语言/,
    烹饪:/烹饪|做饭/, 商业:/经商|商业|商贸|带货|销售|记账/,
    手工:/手工|作坊|木工|工序|师傅|学徒/, 自然:/自然观察|作物|农事|收成/,
    医术:/医术|草药辨识/, 交流:/社交|聚会|人情往来/
  },
  interest_aliases:{读书:'阅读',诗文:'阅读',书法:'阅读',经商:'商业',农事:'自然',武艺:'运动',骑射:'运动','宗教 / 哲学':'阅读',社交往来:'交流'},
  trait_names:['social_exposure','novelty','uncertainty','planning_need','risk','long_term_commitment','time_cost','family_cost','career_value','financial_value','reputation_value','interest_match','physical_demand','efficiency','relationship_care'],
  families:{
    safety:/治安|危险路段|出行风险/, health:/疾病|医治|患病|求医/,
    finance:/商贸|经商|借贷|投资|资产|钱粮周转|带货/,
    learning:/学习|学徒|学校|读书|试学|工序|师傅|借书|兴趣体验/,
    public:/功名|官职|公开职位|考试|荐举|地方权力|声望|公共事务/,
    family:/婚配|婚姻|生育|家庭|亲属|照护|家务/,
    farm:/农业|作物|收成|土地/, duty:/征役|兵役|军中/,
    social:/聚会|朋友|社交|邻里|人情|市集|活动|互助/,
    long_term:/长期|契约|迁居|迁徙|婚配|结婚|生育|职业机会|工作机会|升职/
  }
};
const clamp = (v,lo=0,hi=1) => Math.max(lo,Math.min(hi,v));
function decisionRng(seed) {
  let n=seed>>>0;
  // Mulberry32：固定seed可重放，混合相邻seed，避免简单线性序列耦合扰动和抽样。
  return ()=>{n=(n+0x6d2b79f5)>>>0;let t=Math.imul(n^(n>>>15),n|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};
}
function decisionSeed() {return Math.floor(Math.random()*4294967296);}
function eventText(event) {
  // 只识别本次情境，排除现代事件中的上月行动前缀，避免历史兴趣污染当月。
  return `${event.title||''} ${(event.description||'').replace(/^上月选择了“.*?”。/,'')}`;
}
function describeDecisionEvent(event,worldId) {
  const text=eventText(event), category=event.category||'', f=DECISION_RULES.families;
  const emergency=event.emergency===true||/紧急|失火|正在遇险|洪水逼近/.test(text);
  const longTerm=f.long_term.test(text)||['marriage','parenthood','long_absence','long_relocation','career_training'].some(t=>goalEventTags(event,worldId).includes(t));
  const families=['safety','health','public','finance','learning','farm','duty','family','social'];
  let family=families.find(name=>f[name].test(category))||families.find(name=>f[name].test(text))||'daily';
  if(emergency)family='emergency';
  else if(longTerm&&!['health','safety','public','finance'].includes(family))family='long_term';
  const domains=Object.entries(DECISION_RULES.domains).filter(([,pattern])=>pattern.test(text)).map(([name])=>name);
  const stability=emergency?DECISION_RULES.stability.emergency:family==='safety'||family==='health'?DECISION_RULES.stability.safety:longTerm?DECISION_RULES.stability.long_term:domains.includes('音乐')?DECISION_RULES.stability.leisure:family==='social'?DECISION_RULES.stability.social:family==='learning'?DECISION_RULES.stability.learning:DECISION_RULES.stability.daily;
  return {family,domains,long_term:longTerm,emergency,event_decision_stability:stability,
    resource_tradeoff:['finance','farm','duty','long_term'].includes(family),
    relationship_tradeoff:['family','social'].includes(family)||/人际冲突|他人感受|家人/.test(text),
    talent_context:['learning','public'].includes(family)||/技能挑战|职业发展|体育|运动|高压力/.test(text),
    travel:(event.tags||[]).includes('travel')||/远行|出行|迁居|迁徙/.test(text),
    education:(event.tags||[]).includes('education')||family==='learning'};
}
function decisionContext(character,event,worldId,assumption='normal') {
  const text=eventText(event), facts=event.conditions||{};
  return {world_id:worldId,age:character.age,identity:worldIdentity(character,worldId),gender:character.gender,
    assumption,source:'temporary_test',
    severe_illness:assumption==='severe_illness'||facts.severe_illness===true||/本人重病|病情严重无法外出/.test(text),
    mandatory_family_care:assumption==='family_care'||facts.mandatory_family_care===true||/必须照顾重病家人|必须照护重病家人/.test(text),
    time_available:assumption==='short_time'?.25:Number.isFinite(facts.time_available)?clamp(facts.time_available):1,
    contract_terms_known:facts.contract_terms_known===true,
    companion_available:facts.companion_available!==false,
    funds_available:facts.funds_available!==false,
    travel_allowed:facts.travel_allowed!==false,
    information_verified:facts.information_verified===true};
}

// 只接收事件和现实条件，不接收人物性格、兴趣、目标、天赋。
function generateCandidateActions(event,context) {
  const p=describeDecisionEvent(event,context.world_id), ancient=context.world_id==='ancient';
  const defaults=Object.fromEntries(DECISION_RULES.trait_names.map(t=>[t,0]));
  const make=(id,action,traits={},tags=[],extra={})=>({action_id:id,action,traits:{...defaults,...traits},action_tags:tags,base_weight:1,...extra});
  let actions;
  if(context.age<6) actions=[
    make('child_join','在照护者陪伴下接触眼前事物',{novelty:.5,social_exposure:.5},['participate']),
    make('child_watch','靠在照护者身边观察',{planning_need:.1},['observe']),
    make('child_rest','继续休息，由照护者处理',{relationship_care:.4},['rest'])
  ];
  else switch(p.family) {
    case 'emergency': actions=[
      make('escape','立即避开危险，前往近处安全位置',{risk:.1,physical_demand:.2,efficiency:1},['safety','urgent'],{outdoors:true,urgent_safe:true,base_weight:1.5}),
      make('call_help','立即呼救并请附近的人协助',{social_exposure:.6,efficiency:.9},['safety','urgent','ask_help'],{urgent_safe:true}),
      make('delay','留在原地，等消息齐全再行动',{uncertainty:1,risk:1,planning_need:1},['verify','delay'],{delays_emergency:true})];break;
    case 'safety': actions=[
      make('check_route','向熟悉路线的人核实危险路段',{planning_need:.7,uncertainty:.15,social_exposure:.3,time_cost:.2},['safety','verify']),
      make('safe_route','改走已知较安全的路线',{risk:.1,time_cost:.6,physical_demand:.3},['safety','travel'],{outdoors:true,travel:true}),
      make('companion_route','与可靠的同行者结伴出行',{social_exposure:.6,risk:.2,time_cost:.5},['safety','travel','social'],{outdoors:true,travel:true,requires_companion:true}),
      make('postpone_trip','暂缓这次出行，留在原处',{time_cost:.1,uncertainty:.1},['safety','decline'])];break;
    case 'health': actions=[
      make('seek_care',ancient?'请熟人联络医者，先说明病情':'联系医疗人员，先说明症状',{social_exposure:.3,efficiency:.8,time_cost:.2},['health','ask_help'],{base_weight:1.3}),
      make('care_here','留在近处，协助休息和日常照料',{relationship_care:.8,time_cost:.3},['health','care']),
      make('delegate_care','请有经验的人协助照护与跑腿',{social_exposure:.5,relationship_care:.6,time_cost:.2},['health','ask_help'])];break;
    case 'learning': {
      const craft=/作坊|手艺|学徒|工序/.test(eventText(event));
      actions=[
        make('try_lesson',craft?'今天去作坊参加试学':'参加这次学习体验',{novelty:.7,uncertainty:.45,time_cost:.6,career_value:.5,interest_match:1},['learning','participate','pursue_opportunity','skill_practice'],{outdoors:true,practice:true}),
        make('ask_requirements',craft?'先问清师傅的要求和学习时段':'先确认学习要求与时间安排',{planning_need:.8,uncertainty:.1,time_cost:.2,career_value:.3,interest_match:.4},['learning','verify']),
        make('coordinate_lesson','协调当天时间后参加一部分',{planning_need:.5,social_exposure:.3,time_cost:.3,career_value:.4,interest_match:.6},['learning','participate'],{outdoors:true,practice:true}),
        make('next_lesson','等下一次学习机会',{time_cost:.05},['learning','postpone']),
        make('decline_lesson','放弃本次试学或学习邀请',{},['learning','decline'])];break;
    }
    case 'finance': actions=[
      make('inspect_finance',/借贷|钱粮周转/.test(eventText(event))?'先核对借用金额、用途和归还约定':'先核算成本、收益与损失风险',{planning_need:.8,efficiency:.8,time_cost:.25,financial_value:.6},['finance','verify']),
      make('small_finance','先以能承受的小份额参与',{novelty:.4,risk:.25,time_cost:.4,financial_value:.7,uncertainty:.3,interest_match:.6},['finance','participate','pursue_opportunity'],{requires_funds:true,outdoors:p.travel,travel:p.travel}),
      make('commit_finance','核实条件后正式参与这次交易',{risk:.6,uncertainty:.7,time_cost:.8,financial_value:1,long_term_commitment:p.long_term?.8:.2,interest_match:1},['finance','participate','pursue_opportunity'],{requires_funds:true,requires_information:true,outdoors:p.travel,travel:p.travel}),
      make('decline_finance','拒绝本次交易，保留现有钱粮',{financial_value:.1},['finance','decline','preserve_stability'])];break;
    case 'public': actions=[
      make('prepare_public','了解资格要求，准备本次参与',{planning_need:.8,career_value:.5,reputation_value:.6,time_cost:.3},['reputation','verify']),
      make('apply_public','报名或接受引介，承担相应责任',{social_exposure:.8,novelty:.6,uncertainty:.5,career_value:.7,reputation_value:1,long_term_commitment:.7,time_cost:.7},['reputation','public_participation','pursue_opportunity'],{outdoors:true,travel:p.travel}),
      make('observe_public','先旁听或了解公开流程',{social_exposure:.3,planning_need:.3,time_cost:.25,reputation_value:.2},['reputation','observe'],{outdoors:true}),
      make('decline_public','不参与本次公开事务，维持原有安排',{},['reputation','decline'])];break;
    case 'long_term': {
      const marriage=/婚配|结婚|婚姻/.test(eventText(event)), child=/生育/.test(eventText(event));
      const subject=marriage?'婚配意向':child?'生育与长期照护安排':/迁/.test(eventText(event))?'长期迁居安排':'长期工作或训练安排';
      actions=[
        make('check_terms',`先核实${subject}的条件与责任`,{planning_need:1,uncertainty:.1,efficiency:.6,long_term_commitment:.1,time_cost:.3},['verify']),
        make('commit_terms',`确认条件后接受${subject}`,{long_term_commitment:1,uncertainty:.7,risk:.4,time_cost:1,family_cost:marriage||child?.2:.8,career_value:marriage||child?0:1,relationship_care:marriage||child?.8:0},['participate','pursue_opportunity',...(marriage||child?['family_priority']:[])],{requires_terms:true,outdoors:!marriage&&!child,travel:!marriage&&!child}),
        make('negotiate_terms','与相关人协商期限、分工和照护责任',{planning_need:.8,relationship_care:.8,long_term_commitment:.4,time_cost:.4,family_cost:.1},['verify','family_priority']),
        make('defer_terms','暂缓承诺，继续保持当前生活安排',{long_term_commitment:.1},['postpone','preserve_stability','decline_long_absence']),
        make('decline_terms',`拒绝这次${subject}`,{},['decline','decline_long_absence'])];break;
    }
    case 'family': actions=[
      make('care_direct','承担这次家务或照护分工',{relationship_care:1,time_cost:.7,physical_demand:.2},['care','participate']),
      make('care_share','与亲属分担任务，明确各自时间',{social_exposure:.4,relationship_care:.8,planning_need:.5,time_cost:.3},['care','participate','verify']),
      make('care_later','先说明自己的安排，商量稍后帮忙',{relationship_care:.4,planning_need:.3,time_cost:.1},['care','postpone']),
      make('care_decline','说明原因，婉拒这次临时请托',{relationship_care:.1},['decline'])];break;
    case 'farm': actions=[
      make('farm_work','按时令分担眼前的农事劳动',{physical_demand:.6,time_cost:.6,efficiency:.8,interest_match:1},['participate','learning'],{outdoors:true,practice:true}),
      make('farm_learn','跟随有经验的人查看作物与用地',{social_exposure:.3,planning_need:.4,time_cost:.3,interest_match:.7},['learning','participate'],{outdoors:true,practice:true}),
      make('farm_store','留在近处整理已有钱粮和工具',{time_cost:.3,efficiency:.5},['participate']),
      make('farm_rest','说明情况，暂缓这次劳作',{time_cost:.05},['postpone'])];break;
    case 'duty': actions=[
      make('duty_verify','向经办人核实名册、职责与期限',{planning_need:.8,time_cost:.2,efficiency:.6},['verify']),
      make('duty_prepare','确认职责后准备所需物品与行程',{planning_need:.5,time_cost:.6,long_term_commitment:.6},['participate'],{requires_information:true,outdoors:true}),
      make('duty_coordinate','先请家人或熟人协助安排必要事务',{relationship_care:.7,social_exposure:.5,time_cost:.3},['verify','family_priority'])];break;
    case 'social': {
      const music=p.domains.includes('音乐'), market=/市集/.test(eventText(event));
      const subject=music?'音乐活动':market?'市集同行':'这次聚集';
      actions=[
        make('attend',`直接参加${subject}`,{social_exposure:.9,novelty:.6,uncertainty:.5,time_cost:.6,interest_match:1},['social','participate'],{outdoors:true}),
        make('confirm',`先确认${subject}的时间安排`,{social_exposure:.2,uncertainty:.1,planning_need:.7,time_cost:.2,interest_match:.35},['social','verify']),
        make('partial',`只参加${subject}的一部分`,{social_exposure:.5,novelty:.3,time_cost:.25,interest_match:.65},['social','participate'],{outdoors:true}),
        make('decline',`婉拒${subject}，保留这段时间`,{},['social','decline']),
        make('bring_friend',`邀请熟人一同参加${subject}`,{social_exposure:.7,novelty:.3,planning_need:.35,time_cost:.6,relationship_care:.5,interest_match:1},['social','participate'],{outdoors:true,requires_companion:true})];break;
    }
    default: actions=[
      make('do_now','现在处理眼前这件事',{novelty:.4,time_cost:.4,efficiency:.6},['participate']),
      make('small_step','先做一个可随时停止的小尝试',{novelty:.3,planning_need:.3,time_cost:.2},['participate']),
      make('leave_later','保留现有安排，稍后再处理',{},['postpone'])];
  }
  return actions.map(a=>({...a,interest_domains:p.domains,traits:{...a.traits,interest_match:p.domains.length?a.traits.interest_match:0,
    physical_demand:p.domains.includes('运动')&&a.action_tags.includes('participate')?Math.max(.5,a.traits.physical_demand):a.traits.physical_demand}}));
}

function filterFeasibleActions(actions,event,context) {
  const accepted=[],excluded=[];
  for(const a of actions) {
    let reason='';
    if(a.delays_emergency)reason='紧急危险不能等待完整消息。';
    else if(context.severe_illness&&(a.outdoors&&!a.urgent_safe||a.traits.physical_demand>.3))reason='本人重病，不能进行该外出或体力活动。';
    else if(context.mandatory_family_care&&a.outdoors&&!a.urgent_safe)reason='必须照护重病家人且无人替班，不能离开。';
    else if(a.traits.time_cost>context.time_available&&!a.urgent_safe)reason='当前可用时间不足。';
    else if(a.requires_terms&&!context.contract_terms_known)reason='长期条件尚未确认，不能直接承诺或签约。';
    else if(a.requires_information&&!context.information_verified)reason='关键责任或交易信息尚未核实。';
    else if(a.requires_companion&&!context.companion_available)reason='当前没有可同行的熟人。';
    else if(a.requires_funds&&!context.funds_available)reason='已知资金条件不允许参与。';
    else if(a.travel&&!context.travel_allowed)reason='当前条件不允许出行。';
    else if(context.age<18&&a.requires_terms)reason='本测试中未成年人不能独立签订长期契约。';
    if(reason)excluded.push({...a,probability:0,probability_units:0,feasible:false,exclusion_reason:reason});
    else accepted.push({...a,feasible:true});
  }
  if(!accepted.length)accepted.push({action_id:'seek_safe_help',action:'暂停安排，在安全位置请求协助',traits:Object.fromEntries(DECISION_RULES.trait_names.map(t=>[t,0])),action_tags:['ask_help'],interest_domains:[],base_weight:1,feasible:true});
  return {actions:accepted,excluded};
}
function matchingInterest(character,action) {
  const matches=character.interests.filter(i=>action.interest_domains.includes(DECISION_RULES.interest_aliases[i.name]||i.name));
  return matches.sort((a,b)=>b.intensity-a.intensity)[0]||null;
}
function calculateActionProbabilities(character,event,actions,context,rng=Math.random) {
  const p=describeDecisionEvent(event,context.world_id), caps=DECISION_RULES.caps;
  const centered=key=>(character.personality[key]-50)/50;
  const temperature=1+DECISION_RULES.temperature_scale*(1-p.event_decision_stability);
  const amplitude=DECISION_RULES.jitter_scale*(1-p.event_decision_stability);
  const output=actions.map(action=>{
    const t=action.traits;
    const planningRelevance=p.emergency?0:p.long_term?1:(t.uncertainty*.4+t.long_term_commitment*.4+.15);
    const dimensions={
      外向性:caps.personality_dimension*centered('外向性')*t.social_exposure,
      直觉性:caps.personality_dimension*centered('直觉性')*t.novelty,
      计划性:caps.personality_dimension*centered('计划性')*clamp(planningRelevance)*(t.planning_need-t.uncertainty-t.long_term_commitment*.2),
      思考性:p.resource_tradeoff||p.relationship_tradeoff?caps.personality_dimension*centered('思考性')*((p.resource_tradeoff?t.efficiency:0)-(p.relationship_tradeoff?t.relationship_care:0)):0
    };
    for(const key of Object.keys(dimensions))dimensions[key]=clamp(dimensions[key],-caps.personality_dimension,caps.personality_dimension);
    const personality=clamp(Object.values(dimensions).reduce((a,b)=>a+b,0),-caps.personality_total,caps.personality_total);
    const matched=matchingInterest(character,action), interest=matched?caps.interest*clamp(matched.intensity/100)*t.interest_match:0;
    const goal=goalInfluence(character.life_goal,event,action.action_tags,context.world_id);
    const lifeGoal=clamp(goal.adjustment/20*caps.goal,-caps.goal,caps.goal);
    const relatedTalents=p.talent_context?(t.physical_demand>.4?['运动']:p.emergency||t.risk>.5?['抗压']:p.education||action.practice?['智力','好奇心']:[]):[];
    const talent=relatedTalents.length&&action.action_tags.includes('participate')?clamp((relatedTalents.reduce((s,k)=>s+character.talents[k],0)/relatedTalents.length-50)/50*caps.talent,-caps.talent,caps.talent):0;
    let situational=0;const situationReasons=[];
    if(context.world_id==='ancient') {
      const w=worldConfig('ancient').behavior_constraints;
      if(p.travel&&action.outdoors){situational-=w.travel_cost/24*.7;situationReasons.push('出行路费与误工成本降低外出吸引力');}
      if(p.education&&action.practice&&!['读书人','官员','商户家庭成员','工匠 / 学徒'].includes(context.identity)){situational-=w.education_barrier/18*.4;situationReasons.push('缺少现成师承或引介，试学条件较弱');}
      if(context.gender==='女'&&(p.education||p.travel)&&action.outdoors){situational-=w.gender_access/8*.15;situationReasons.push('沿用世界卡的临时社会机会成本');}
    }
    if(context.severe_illness&&t.time_cost>.2){situational-=1.2*t.time_cost;situationReasons.push('重病时优先减少负担');}
    if(context.mandatory_family_care&&t.time_cost>.2){situational-=t.time_cost;situationReasons.push('照护责任压缩其他活动时间');}
    if(context.time_available<.5){situational-=t.time_cost;situationReasons.push('可用时间很少');}
    if(p.emergency){situational+=action.urgent_safe?1:0;situationReasons.push('紧急事件优先安全处置');}
    const random=(rng()+rng()-1)*amplitude;
    const base=Math.log(action.base_weight), total=base+situational+personality+interest+lifeGoal+talent+random;
    return {...action,goal_relevance:goal.relevance,goal_relevance_multiplier:goal.multiplier,goal_adjustment:goal.adjustment,
      modifiers:{base,situational,personality,personality_dimensions:dimensions,interest,life_goal:lifeGoal,talent,random},
      matched_interest:matched?{name:matched.name,intensity:matched.intensity}:null,relevant_talents:relatedTalents,
      situation_reasons:situationReasons,reasons:situationReasons.length?situationReasons:['在现实可行的回应中，根据行为特征形成概率。'],log_weight:total/temperature,temperature,random_amplitude:amplitude};
  });
  const max=Math.max(...output.map(a=>a.log_weight)),weights=output.map(a=>Math.exp(a.log_weight-max)),sum=weights.reduce((a,b)=>a+b,0);
  // 以0.1%为单位，最大余数分配；显示分布与实际抽样分布使用同一组整数。
  const raw=weights.map(w=>w/sum*DECISION_RULES.probability_units),units=raw.map(Math.floor);
  let remain=DECISION_RULES.probability_units-units.reduce((a,b)=>a+b,0);
  const order=raw.map((v,i)=>({i,fraction:v-units[i]})).sort((a,b)=>b.fraction-a.fraction);
  for(let i=0;i<remain;i++)units[order[i].i]++;
  return output.map((a,i)=>({...a,probability_units:units[i],probability:units[i]/10}));
}
function sampleAction(actions,draw=Math.random()) {
  if(!Number.isFinite(draw)||draw<0||draw>=1)throw new Error('抽样值必须在[0,1)内。');
  const target=draw*DECISION_RULES.probability_units;let cumulative=0;
  for(const action of actions){cumulative+=action.probability_units;if(target<cumulative)return action;}
  throw new Error('概率分布不完整，未执行行为。');
}
function influenceLabel(value) {return Math.abs(value)<.001?'0（不参与）':`${value>0?'+':'−'}${Math.abs(value)<.15?'轻微':Math.abs(value)<.4?'适中':'明显'}`;}
function decisionReasons(character,event,actions,chosen,context,profile) {
  const interestAffected=actions.some(a=>a.modifiers.interest>0),goalAffected=actions.some(a=>a.modifiers.life_goal!==0);
  const liked=[...actions].sort((a,b)=>b.modifiers.personality-a.modifiers.personality).slice(0,2).map(a=>a.action);
  return [
    {factor:'事件条件',reason:`${profile.emergency?'这是需要及时处置的危险情境':profile.long_term?'这项选择涉及长期责任，需要稳定权衡':'这是一次短期情境，允许保留不同回应方式'}。${DECISION_RULES.constraints[context.assumption]||'采用已知现实条件'}；不可行行为先排除。`},
    {factor:'性格影响',reason:actions.some(a=>Math.abs(a.modifiers.personality)>.01)?`在可行选项中，“${liked.join('”和“')}”较符合人物偏好；${profile.emergency?'本次计划性不鼓励延迟处置':profile.long_term?'长期责任使计划与不确定性的权衡更重要':'短期活动中计划性的修正较弱'}，这些倾向都不会锁定选择。`:'人物在这些行为特征上没有明显偏向，性格未拉开较大差距。'},
    {factor:'兴趣影响',reason:interestAffected?`事件涉及${profile.domains.join('、')}，匹配兴趣提高相关参与行为的相对权重；保留拒绝和暂缓的可能。`:'本次可行行为没有匹配的兴趣投入，兴趣修正为0。'},
    {factor:'人生目标',reason:!character.life_goal?'尚无人生目标，本次目标修正为0。':`${character.life_goal}：${goalAffected?'只修正相关候选行为':'与本次行为没有有效的方向关联，不参与修正'}；所选行为相关性：${GOAL_RELEVANCE_LABELS[chosen.goal_relevance]}，倍率${chosen.goal_relevance_multiplier}，目标权重修正${influenceLabel(chosen.modifiers.life_goal)}。`},
    {factor:'天赋影响',reason:actions.some(a=>a.modifiers.talent!==0)?'仅在学习或挑战的参与行为中，有限估计成功可能性；不改变可选行为。':'本次天赋不参与普通选择修正。'},
    {factor:'最终选择',reason:`本次按概率抽取到：${chosen.action}（${chosen.probability.toFixed(1)}%）。概率最高的行为也不保证被抽中。`}
  ];
}
function practiceEffects(chosen,event,worldId,character,context) {
  if(!chosen.practice||context.age<6)return {suggested_effects:[],new_skill_suggestion:null};
  // 练习内容来自事件领域，不从人物最高兴趣或选项位置推导。
  const domains=chosen.interest_domains, config=worldConfig(worldId);
  const domain=domains[0];let entry;
  if(worldId==='ancient') {
    const alias={阅读:'读书',商业:'经商',自然:'农事',运动:'武艺'};
    entry=config.interest_examples[alias[domain]||domain];
  } else entry=domain==='手工'?['基础手艺',['智力','好奇心']]:config.interest_examples[domain];
  if(!entry)return {suggested_effects:[],new_skill_suggestion:null};
  const [skill,talents]=entry,reason=`实际选择了“${chosen.action}”，本次${domain}情境提供${skill}练习；相关天赋为${talents.join('、')}。`;
  return {suggested_effects:[{type:'skill_practice',action:chosen.action,skill_name:skill,effort:chosen.traits.time_cost>.4?'常规':'轻量',relevant_talents:talents,reason}],
    new_skill_suggestion:character.skills.some(s=>s.name===skill)?null:{name:skill,source:'ai_generated',reason:'Mock临时内容：本次实际进行了事件提供的技能练习。'}};
}
function mockDecision(character,event,worldId=activeWorld,options={}) {
  const seed=options.seed??decisionSeed(),context=decisionContext(character,event,worldId,options.assumption||'normal');
  const generated=generateCandidateActions(event,context),filtered=filterFeasibleActions(generated,event,context);
  const actions=calculateActionProbabilities(character,event,filtered.actions,context,decisionRng(seed));
  // 抽样使用独立随机流；跨世界可以共用seed和同一个抽样分位，候选数量变化不会错位。
  const draw=options.draw??decisionRng((seed^0x9e3779b9)>>>0)(),chosen=sampleAction(actions,draw);
  const profile=describeDecisionEvent(event,worldId);
  return {event,decision_version:DECISION_RULES.version,event_decision_stability:profile.event_decision_stability,
    decision_context:context,generated_actions:generated,excluded_actions:filtered.excluded,candidate_actions:actions,
    chosen_action:chosen.action,chosen_action_id:chosen.action_id,sampling:{seed,draw,method:'weighted_random',probability_units:1000},
    decision_reasons:decisionReasons(character,event,actions,chosen,context,profile),...practiceEffects(chosen,event,worldId,character,context)};
}
function validateProbabilityDecision(output) {
  const actions=output.candidate_actions;
  if(output.decision_version!==DECISION_RULES.version||!Array.isArray(output.excluded_actions)||!Array.isArray(output.generated_actions))throw new Error('概率记录结构不完整。');
  if(!Number.isFinite(output.event_decision_stability)||output.event_decision_stability<0||output.event_decision_stability>1)throw new Error('决策稳定性不合法。');
  if(new Set(actions.map(a=>a.action_id)).size!==actions.length||actions.some(a=>!Number.isInteger(a.probability_units)||a.probability_units<0||a.probability!==a.probability_units/10||!a.feasible))throw new Error('候选概率不合法。');
  if(actions.reduce((sum,a)=>sum+a.probability_units,0)!==1000)throw new Error('候选概率总和不是100%。');
  for(const a of actions){
    if(!a.traits||!DECISION_RULES.trait_names.every(k=>Number.isFinite(a.traits[k])&&a.traits[k]>=0&&a.traits[k]<=1)||!Array.isArray(a.action_tags))throw new Error('行为特征不合法。');
    if(!a.modifiers||!['base','situational','personality','interest','life_goal','talent','random'].every(k=>Number.isFinite(a.modifiers[k])))throw new Error('概率修正不合法。');
    if(!Object.hasOwn(GOAL_RELEVANCE_MULTIPLIER,a.goal_relevance)||a.goal_relevance_multiplier!==GOAL_RELEVANCE_MULTIPLIER[a.goal_relevance])throw new Error('人生目标相关性记录不合法。');
  }
  if(output.excluded_actions.some(a=>a.probability_units!==0||a.probability!==0||a.feasible!==false||typeof a.exclusion_reason!=='string'))throw new Error('不可行行为未被排除。');
  if(!output.sampling||output.sampling.method!=='weighted_random'||!Number.isInteger(output.sampling.seed))throw new Error('缺少抽样记录。');
  const chosen=sampleAction(actions,output.sampling.draw);
  if(chosen.action_id!==output.chosen_action_id||chosen.action!==output.chosen_action)throw new Error('最终选择与记录的概率抽样不一致。');
}
