'use strict';

// TODO: 全部是 Mock 样例与临时权重，不是历史结论或正式世界规则。
const WORLD_CONFIGS = {
  modern: {
    id:'modern', name:'现代', description:'现代日常社会：学习、工作、社交与兴趣体验。',
    allowed_contexts:['学校','大学','公司','现代职业','聚会','商业','交通','互联网'],
    forbidden_contexts:[], temporary_identities:['幼儿','学生','工作','无业'],
    event_domains:['日常','社交','学习','家庭','探索','学校','工作'],
    interest_examples:{
      '音乐':['钢琴',['智力']], '阅读':['写作',['智力','好奇心']], '运动':['足球',['运动']],
      '绘画':['素描',['智力','好奇心']], '技术':['编程',['智力']], '语言':['英语',['智力','社交']],
      '交流':['演讲',['社交','抗压']], '烹饪':['烹饪',['智力']], '商业':['销售',['社交','抗压']],
      '自然':['自然观察',['好奇心']]
    },
    behavior_constraints:{description:'沿用现代 Mock 评分；机会信息较易获取，可自主选择小规模体验。', travel_cost:0, education_barrier:0, family_duty:0},
    goal_interests:{'职业成就':['技术','阅读','语言'],'家庭生活':['烹饪','交流'],'声望地位':['交流','音乐','运动'],'财富积累':['商业']},
    goal_meanings:{'职业成就':'专业学习与职业发展','家庭生活':'陪伴家人与家庭稳定','声望地位':'社会认可与影响力','财富积累':'有经济收益的发展机会'}
  },
  ancient: {
    id:'ancient', name:'古代', description:'前工业农业社会（不绑定朝代）· 身份、家计、教育门槛与出行成本影响机会。',
    allowed_contexts:['农业','手工业','商贸','服务','军事','官僚','家庭','宗族','有限教育','缓慢传播的信息'],
    forbidden_contexts:['程序员','编程','互联网','手机','社交媒体','公司','HR','办公室','大学','医院','现代医学','金融投资','股票','基金','期货','汽车','飞机','健身','夜店','线上娱乐','电竞','短视频','高铁','地铁','电脑','网络','直播','电商','软件','电力','机器人','航天','银行卡','信用卡','比特币','加密货币'],
    temporary_identities:['幼儿','农户家庭成员','商户家庭成员','工匠 / 学徒','读书人','官员','军人','仆役','无固定职业','家庭劳动者'],
    adult_identities:['农户家庭成员','商户家庭成员','工匠 / 学徒','读书人','官员','军人','仆役','无固定职业','家庭劳动者'],
    youth_identities:['农户家庭成员','商户家庭成员','工匠 / 学徒','读书人','家庭劳动者'],
    event_domains:['农业生产','土地与收成','手工业学习','学徒经历','商贸机会','借贷','市集','读书','考试 / 科举式机会','家庭安排','婚配','亲属事务','宗族事务','生育','疾病','医治','灾荒','征役','服兵役','迁徙','治安问题','人情往来','邻里关系','地方权力关系','声望与身份变化'],
    interest_examples:{
      '读书':['识字',['智力','好奇心']], '书法':['书法',['智力']], '经商':['记账',['智力','社交']],
      '手工':['木工',['智力','好奇心']], '音乐':['吹笛',['智力']], '骑射':['射箭',['运动','抗压']],
      '武艺':['基本武艺',['运动','抗压']], '农事':['作物照料',['好奇心']], '医术':['草药辨识',['智力','好奇心']],
      '烹饪':['烹饪',['智力']], '绘画':['绘画',['智力','好奇心']], '诗文':['诗文习作',['智力']],
      '宗教 / 哲学':['经典阅读',['智力','好奇心']], '社交往来':['待人接物',['社交','抗压']]
    },
    interest_aliases:{'阅读':'读书','技术':'手工','编程':'手工','电竞':'手工','语言':'读书','英语':'读书','交流':'社交往来','商业':'经商','运动':'武艺','自然':'农事','短视频':'绘画','现代健身':'武艺','汽车':'手工'},
    behavior_constraints:{description:'农业家计优先；消息慢、路费高；学习需师承或资助；宗族与家庭协商重要；背景影响机会。', travel_cost:24, education_barrier:18, family_duty:18, background_access:12, gender_access:8, local_support:14,
      context_keywords:{travel:['远行','迁徙','迁居','路费','盘缠','出行','征役'],education:['读书','考试','学徒','师承','试学','学习'],family:['家人','家庭','宗族','照护','亲属','婚配'],social:['朋友','社交','聚会','邻里','市集']}},
    goal_interests:{'职业成就':['读书','手工','医术','武艺'],'家庭生活':['烹饪','农事','社交往来'],'声望地位':['诗文','书法','社交往来','骑射'],'财富积累':['经商','农事']},
    goal_meanings:{'职业成就':'精进手艺、经营能力、医术或仕途本领','家庭生活':'家庭稳定、婚姻子女与家族延续','声望地位':'地方名望、功名、官职或宗族影响','财富积累':'土地、商贸、店铺、牲畜与钱粮'},
    // 每项: 标题、描述、领域、最低年龄、机会标签、适用身份（省略表示通用）。不执行财产、疾病、婚育或征役状态变更。
    events:[
      ['帮看时令作物','家中长辈带人查看作物，允许做力所能及的照料。','农业生产',6,['family'],['农户家庭成员','家庭劳动者']],
      ['收成与用地商议','收成不稳，家人请你旁听用地与储粮商议。','土地与收成',12,['family']],
      ['作坊试学','邻近作坊允许试学基础手艺，但需先谈妥师承与家中劳动安排。','手工业学习',12,['education','family']],
      ['学徒的练习时段','师傅愿意示范一道工序，需要先完成日常杂务。','学徒经历',12,['education'],['工匠 / 学徒']],
      ['远集带货邀约','熟人邀你远行带货，消息尚待核实，路费与误工需要自行权衡。','商贸机会',18,['travel']],
      ['钱粮周转商议','亲属提出短期借用钱粮，需核实用途并与家人商议。','借贷',18,['family']],
      ['近集见闻','邻里结伴去附近市集，你可以同行了解货物与人情。','市集',12,['social']],
      ['借书请教','乡中识字者愿意在劳作之后讲解一段书文，名额有限。','读书',6,['education']],
      ['赴试消息','传来一场选才考试的消息，资格、盘缠和准备时间仍需核实。','考试 / 科举式机会',16,['education','travel'],['读书人','官员']],
      ['家务分工','家人商量近期劳动与照护安排，希望你表达自己的打算。','家庭安排',6,['family']],
      ['婚配意向商议','亲属提出一门婚配意向，可了解对方与家计、表达意愿或暂缓。尚无婚约。','婚配',18,['family']],
      ['亲属来访','亲属来访请托小事，需权衡相处时间和原有安排。','亲属事务',6,['family','social']],
      ['宗族议事旁听','宗族商议公共事务，可先旁听、请教熟人或表达意见。','宗族事务',16,['family','social']],
      ['亲属产后照护请托','亲属家有新生儿，询问是否能分担家务。这里只模拟请托，不生成子女。','生育',18,['family']],
      ['邻人患病请托','邻人身体不适，希望有人代办杂务；可先向长辈了解情况。','疾病',12,['family']],
      ['寻访医者消息','附近有人求医，熟人传来医者行踪，需核实后再考虑协助。','医治',16,['travel']],
      ['歉收后的互助商议','地方传来歉收消息，邻里商量节用与互助，实际情形仍需打听。','灾荒',12,['family','social']],
      ['徭役消息核实','传来征役消息，可向地方经办人核实名册与安排，尚未确认你被征召。','征役',18,['family','travel']],
      ['军中差务安排','军中一项差务征求意见，需核实职责和家中安排。','服兵役',18,['travel'],['军人']],
      ['迁居机会传闻','远方亲属提到安身机会，但沿途开销、土地与依靠尚不明确。','迁徙',18,['travel','family']],
      ['出行治安消息','熟人提醒沿途有治安隐患，可结伴、核实消息或暂缓出行。','治安问题',12,['travel']],
      ['邻里礼尚往来','邻人邀请参加小型互助聚集，可决定以何种方式参与。','人情往来',6,['social']],
      ['邻里协作','邻里希望合力处理一项日常小事，也允许只做力所能及的部分。','邻里关系',6,['social']],
      ['地方事务请托','地方经办人征询一项公共事务的意见，身份与熟人引介影响发言机会。','地方权力关系',18,['social']],
      ['乡里荐举商议','有人愿意介绍你参与地方事务，可先核实责任与资格，不自动获得身份。','声望与身份变化',18,['social','education']]
    ]
  }
};

// TODO: Mock相关性与分值，集中在此处，未来可由正式事件标签和规则替换。
const GOAL_RELEVANCE_MULTIPLIER = {unrelated:0, indirect:0.2, direct:1};
const GOAL_RELEVANCE_LABELS = {unrelated:'无关', indirect:'间接相关', direct:'直接相关'};
const GOAL_RELEVANCE_RULES = {
  '职业成就': {
    direct:['career_opportunity','career_training','promotion','career_change'],
    indirect:['career_network','career_relocation','short_learning']
  },
  '家庭生活': {
    direct:['family','marriage','parenthood','long_absence','long_relocation','long_family_care','major_family_conflict'],
    indirect:['stable_career','stable_income','settlement','family_asset']
  },
  '声望地位': {
    direct:['public_office','reputation_activity','public_leadership','title','social_influence'],
    indirect:['important_network','public_display','public_affairs']
  },
  '财富积累': {
    direct:['investment','business','major_asset','high_income','long_income','loan','major_finance'],
    indirect:['career_opportunity','income_skill','economic_relocation']
  }
};
const GOAL_ACTION_ADJUSTMENTS = {
  '职业成就':{pursue_opportunity:18, verify:10, skill_practice:8},
  '家庭生活':{family_priority:20, decline_long_absence:18, preserve_stability:12, verify:4},
  '声望地位':{public_participation:18, pursue_opportunity:16, verify:8},
  '财富积累':{pursue_opportunity:18, verify:12, preserve_stability:4}
};
const GOAL_EVENT_TAGS = {
  modern:{'学习':['short_learning'],'学校':['short_learning'],'工作':['career_network']},
  ancient:{
    '手工业学习':['short_learning'],'学徒经历':['career_training'],'商贸机会':['business','high_income'],
    '借贷':['loan'],'考试 / 科举式机会':['career_training','title'],'婚配':['marriage'],
    '生育':['parenthood'],'征役':['long_absence'],'服兵役':['long_absence'],
    '迁徙':['long_relocation','career_relocation','economic_relocation','settlement'],
    '地方权力关系':['public_affairs'],'声望与身份变化':['reputation_activity','public_affairs']
  }
};
const GOAL_TEXT_TAGS = [
  [/长期离乡|长期离家/,['long_absence']], [/长期迁居|迁居|定居/,['long_relocation','settlement']],
  [/结婚|婚配|婚姻/,['marriage']], [/生育|子女|家族延续/,['parenthood']],
  [/长期.{0,8}照护|长期.{0,8}照料/,['long_family_care']], [/家庭.{0,8}(事业|工作).{0,8}冲突|为了家庭稳定放弃重大机会/,['major_family_conflict']],
  [/稳定工作/,['stable_career']], [/稳定收入/,['stable_income']], [/置办.{0,8}(家庭资产|房屋|宅院|土地)/,['family_asset']],
  [/工作.{0,3}机会|学徒.{0,3}机会|升职|转换职业|职业方向|长期职业训练/,['career_opportunity']], [/短期.{0,8}(学习|试学)|试学|兴趣体验/,['short_learning']],
  [/职业人脉|工作间隙.{0,8}分享/,['career_network']], [/为了.{0,8}(发展|职业).{0,8}(迁居|搬迁)/,['career_relocation']],
  [/投资|经商|商贸/,['business']], [/购买.{0,8}重要资产|重要资产/,['major_asset']], [/高收益/,['high_income']],
  [/长期收入/,['long_income']], [/借贷|借用钱粮/,['loan']], [/重大财务|财务决策/,['major_finance']],
  [/官职|公开职位|功名|头衔/,['public_office','title']], [/提升名望|地方名望|声望/,['reputation_activity']],
  [/公开领导/,['public_leadership']], [/社会影响力|宗族影响力/,['social_influence']], [/重要人物/,['important_network']],
  [/公开展示/,['public_display']], [/公共事务|地方事务/,['public_affairs']]
];

function goalEventTags(event, worldId) {
  const tags = [...(event.goal_tags || []), ...(GOAL_EVENT_TAGS[worldId]?.[event.category] || [])];
  const text = `${event.title || ''} ${event.description || ''} ${event.abstract_scenario || ''}`;
  for (const [pattern,matched] of GOAL_TEXT_TAGS) if (pattern.test(text)) tags.push(...matched);
  return [...new Set(tags)];
}
function actionTags(event, worldId, index) {
  const eventTags=goalEventTags(event,worldId), longFamily=eventTags.some(tag=>GOAL_RELEVANCE_RULES['家庭生活'].direct.includes(tag));
  const domain = event.category==='治安问题' ? ['safety'] : /病|医治/.test(event.category) ? ['health'] : /社交|人情|邻里/.test(event.category) ? ['social'] : /学习|学徒|读书|学校/.test(event.category) ? ['learning'] : /商贸|借贷/.test(event.category) ? ['finance'] : [];
  const common = [
    ['participate','pursue_opportunity'], ['verify'],
    ['decline','preserve_stability',...(domain.includes('learning')?['skill_practice']:[]),...(eventTags.includes('long_absence')||eventTags.includes('long_relocation')?['decline_long_absence']:[])],
    ['limited_participation',...(longFamily?['family','family_priority']:[]),...(eventTags.some(tag=>GOAL_RELEVANCE_RULES['声望地位'].direct.includes(tag))?['public_participation']:[])]
  ];
  return [...new Set([...domain,...common[index]])];
}
function goalInfluence(goal,event,tags,worldId) {
  if (!goal) return {relevance:'unrelated',multiplier:0,base_adjustment:0,adjustment:0,event_tags:goalEventTags(event,worldId)};
  const eventTags=goalEventTags(event,worldId), allTags=new Set([...eventTags,...tags]), rules=GOAL_RELEVANCE_RULES[goal];
  const relevance=rules.direct.some(tag=>allTags.has(tag))?'direct':rules.indirect.some(tag=>allTags.has(tag))?'indirect':'unrelated';
  const base=Math.max(0,...tags.map(tag=>GOAL_ACTION_ADJUSTMENTS[goal][tag]||0));
  return {relevance,multiplier:GOAL_RELEVANCE_MULTIPLIER[relevance],base_adjustment:base,adjustment:round(base*GOAL_RELEVANCE_MULTIPLIER[relevance],1),event_tags:eventTags};
}
function scoreActions(labels,baseScores,reasonTexts,event,goal,worldId,noise) {
  const actions=labels.map((action,index)=>{
    const tags=actionTags(event,worldId,index), influence=goalInfluence(goal,event,tags,worldId);
    const score=round(Math.max(0,Math.min(100,baseScores[index]+influence.adjustment+noise[index])),1);
    const sign=influence.adjustment>0?'+':'';
    return {action,score,action_tags:tags,goal_relevance:influence.relevance,goal_relevance_multiplier:influence.multiplier,goal_base_adjustment:influence.base_adjustment,goal_adjustment:influence.adjustment,
      reasons:[reasonTexts[index],`人生目标：${goal||'无'}；相关性：${GOAL_RELEVANCE_LABELS[influence.relevance]}；本次目标修正：${sign}${influence.adjustment}。`]};
  });
  const chosenIndex=actions.findIndex(item=>item.score===Math.max(...actions.map(item=>item.score)));
  return {actions,chosenIndex,chosen:labels[chosenIndex],chosenInfluence:actions[chosenIndex]};
}
function goalDecisionReason(goal, scored) {
  const item=scored.chosenInfluence, sign=item.goal_adjustment>0?'+':'';
  return goal ? `人生目标：${goal}；相关性：${GOAL_RELEVANCE_LABELS[item.goal_relevance]}；本次目标修正：${sign}${item.goal_adjustment}（倍率 ${item.goal_relevance_multiplier}）。` : '人生目标：无；相关性：无关；本次目标修正：0。';
}

function worldConfig(id = activeWorld) {
  if (!Object.hasOwn(WORLD_CONFIGS,id)) throw new Error('未知世界卡。');
  return WORLD_CONFIGS[id];
}
function assertWorldText(text, worldId) {
  const hit = worldConfig(worldId).forbidden_contexts.find(word => text.toLowerCase().includes(word.toLowerCase()));
  if (hit) throw new Error(`古代情境包含时代错位内容“${hit}”，请改用抽象或前工业情境。`);
}
function contextualInterest(c, worldId) {
  const raw = [...c.interests].sort((a,b)=>b.intensity-a.intensity)[0] || {name:'观察',intensity:50};
  const config = worldConfig(worldId);
  const name = worldId === 'ancient' ? (config.interest_aliases[raw.name] || (Object.hasOwn(config.interest_examples,raw.name) ? raw.name : '手工')) : raw.name;
  return {...raw,name}; // 仅解释活动方向，不改人物存档中的兴趣或强度。
}
function worldIdentity(c, worldId) {
  if (worldId === 'modern') return ['幼儿','学生','工作','无业'].includes(c.simple_identity) ? c.simple_identity : simpleIdentity(c.age, null, worldId);
  if (c.age < 6) return '幼儿';
  const choices = c.age < 18 ? worldConfig(worldId).youth_identities : worldConfig(worldId).adult_identities;
  return choices.includes(c.simple_identity) ? c.simple_identity : '农户家庭成员';
}
function ancientEvent(c, scenario = '') {
  if (c.age < 6) return {title:'家中陪伴',description:'照护者在身旁唱歌，可以互动、安静聆听或休息。',category:'家庭安排',tags:['family'],minimum_age:0,maximum_age:5,is_temporary_ai_event:true,world_id:'ancient'};
  const config = worldConfig('ancient'), identity = worldIdentity(c,'ancient');
  let options = config.events.filter(row => c.age >= row[3] && (!row[5] || row[5].includes(identity)));
  if (scenario) {
    const preferred = /家庭|亲属|婚|子女/.test(scenario) ? ['家庭安排','亲属事务'] : /朋友|聚会|社交/.test(scenario) ? ['人情往来','邻里关系'] : /学|读书/.test(scenario) ? ['读书','手工业学习'] : /发展|机会|未来/.test(scenario) ? (c.age >= 18 ? ['商贸机会'] : ['手工业学习']) : null;
    if (preferred) options = options.filter(row => preferred.includes(row[2]));
  }
  const [title,description,category,minimum_age,tags] = choice(options.length ? options : config.events.filter(row=>row[3]<=c.age&&!row[5]));
  return {title,description:`临时背景：${identity}。${description}`,category,tags,minimum_age,maximum_age:120,is_temporary_ai_event:true,world_id:'ancient'};
}
function concreteEvent(c, scenario, worldId) {
  if (!scenario.trim() || scenario.length > 2000) throw new Error('请输入1～2000字抽象情境。');
  assertWorldText(scenario,worldId);
  if (worldId === 'ancient') return {...ancientEvent(c,scenario),abstract_scenario:scenario};
  let event = mockEvent(c,worldId);
  if (c.age >= 6) {
    const social = /朋友|聚会|社交/.test(scenario), family = /家庭|亲属|婚|子女/.test(scenario);
    event = {...event,title:social?'朋友的小型聚会':family?'家人共同安排时间':'新的发展体验',category:social?'社交':family?'家庭':'学习',
      description:social?'朋友邀请参加一个陌生的小型聚会，可以自主报名或先了解。':family?'家人希望共同安排一段时间，你也有自己的兴趣活动。':`获得一次适龄的${contextualInterest(c,worldId).name}体验机会，可在线了解内容、选择时间并就近试学。`};
  }
  return {...event,abstract_scenario:scenario,world_id:worldId};
}
function ancientDecision(c,event,noise) {
  const config = worldConfig('ancient'), w = config.behavior_constraints, p = c.personality;
  const [e,n,t,j] = PERSONALITY.map(key=>p[key]), interest = contextualInterest(c,'ancient'), identity = worldIdentity(c,'ancient');
  if (c.age < 6) {
    const labels=['向照护者表达兴趣','安静观察后接触','留在熟悉的陪伴中'];
    const scored=scoreActions(labels,[20+.6*e+.1*n,20+.3*j+.3*(100-e),20+.6*(100-e)],labels.map(()=> '只在照护者陪伴下接触日常活动。'),event,c.life_goal,'ancient',noise);
    return {event,candidate_actions:scored.actions,chosen_action:scored.chosen,decision_reasons:[{factor:'性格',reason:`外向${e}、直觉${n}、思考${t}、计划${j}用于陪伴方式倾向。`},{factor:'人生目标',reason:goalDecisionReason(c.life_goal,scored)},{factor:'世界约束',reason:'幼儿只参与家中适龄陪伴，无独立劳作或出行。'}],suggested_effects:[],new_skill_suggestion:null};
  }
  const tags = event.tags || Object.entries(w.context_keywords).filter(([,words])=>words.some(word=>event.description.includes(word))).map(([tag])=>tag);
  const travel = tags.includes('travel'), education = tags.includes('education'), family = tags.includes('family');
  const access = ['读书人','官员','商户家庭成员','工匠 / 学徒'].includes(identity);
  // TODO: 假设部分公共学习/远行机会有性别差异；只影响机会成本，不限制能力、不判定普遍历史事实。
  const genderBarrier = c.gender==='女' && (travel||education) ? w.gender_access : 0;
  const cost = (travel?w.travel_cost:0)+(education&&!access?w.education_barrier:0)+genderBarrier;
  const labels = ['主动争取本次机会，承担协调成本',travel?'先核实资格与路费，再请熟人引介':'先核实条件与时间，再请熟人引介',`暂缓外部机会，留在近处练习${interest.name}基础`,'先协调家中劳动与照护，再有限参与'];
  const scores = [18+.25*e+.2*n+.15*interest.intensity-cost+(access?w.background_access:0),18+.3*j+.25*t+cost*.5,14+.25*(100-e)+.15*interest.intensity+cost*.45,16+.25*(100-t)+.15*j+(family?w.family_duty:0)+w.local_support];
  const detail = [`外向${e}、直觉${n}与兴趣${interest.intensity}推动尝试，机会成本扣${cost}。`,`计划${j}、思考${t}及信息不明成本推动先核实。`,`内向倾向${100-e}及出行/教育成本支持就近安排。`,`情感倾向${100-t}、家计责任和就近协调支持有限参与。`];
  const scored=scoreActions(labels,scores,detail,event,c.life_goal,'ancient',noise), index=scored.chosenIndex, chosen=scored.chosen;
  const reasons=[
    {factor:'性格',reason:`原始四维：外向${e}、直觉${n}、思考${t}、计划${j}；只用于选择倾向。`},
    {factor:'兴趣',reason:`在本世界以${interest.name}活动解释兴趣，强度${interest.intensity}；原始属性不变，不直接增加技能。`},
    {factor:'人生目标',reason:`${goalDecisionReason(c.life_goal,scored)}${c.life_goal?` 时代解释：${config.goal_meanings[c.life_goal]}。`:''}`},
    {factor:'当前情况',reason:`${c.age}岁；临时机会身份：${identity}。只讨论事件，不自动改变财产、婚育、健康或身份。`},
    {factor:'世界约束',reason:`消息需核实；出行成本${travel?w.travel_cost:0}，教育门槛${education&&!access?w.education_barrier:0}，临时性别机会成本${genderBarrier}；${access?'身份提供引介渠道':'需要寻找引介与资助'}。家庭与宗族协商参与评分。`}
  ];
  let effects=[],suggestion=null;
  if (index===2) {
    const [skill,talents]=config.interest_examples[interest.name];
    const reason=`在近处做${skill}基础练习，相关天赋为${talents.join('、')}；师资不足时仅轻量练习。`;
    effects=[{type:'skill_practice',action:chosen,skill_name:skill,effort:'轻量',relevant_talents:talents,reason}];
    if (!c.skills.some(s=>s.name===skill)) suggestion={name:skill,source:'ai_generated',reason:'Mock临时内容：首次基础练习，由程序设初值。'};
    reasons.push({factor:'天赋',reason});
  }
  return {event,candidate_actions:scored.actions,chosen_action:chosen,decision_reasons:reasons,suggested_effects:effects,new_skill_suggestion:suggestion};
}
