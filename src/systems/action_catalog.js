// MOCK_ONLY semantic outcomes. Character preferences never create options.
const option=(id,outcome,label,traits={},conditions={},effect=null)=>({id,name:label,traits,tags:outcome==='accept'||effect?['participate']:outcome==='reject'?['decline']:outcome==='defer'?['postpone']:['verify'],conditions:{...conditions,action_type:outcome==='inquire'?'transition_action':'terminal_action',outcome,information_required:outcome==='inquire'?['duration','cost','time']:[],effects:effect?[effect]:[]}});
export function completeEvent(s,event){
 if(event.content_template){const e=structuredClone(event);e.stage=e.stage||1;if(e.context_facts?.information_acquired)e.mock_actions=e.mock_actions.filter(a=>a.conditions.action_type!=='transition_action');return e;}
 const e={...event,context_facts:{...(event.context_facts||{})}},t=e.type,c=s.config;
 const accept=(id,label,traits={},conditions={},effect=t)=>option(id,'accept',label,{interest_match:1,...traits},conditions,effect);
 const inquire=(id,label)=>option(id,'inquire',label,{planning_need:.8,time_cost:.02});
 const reject=(id,label)=>option(id,'reject',label);
 const defer=(id,label)=>option(id,'defer',label);
 const term={requires_terms:true};
 const schemas={
 learning:{goal:'是否进入这次短期试学，以及以什么条件进入',actions:[accept('try_lesson','直接参加试学',{novelty:.7,time_cost:c.trial_time,career_value:.2},{outdoors:true}),accept('partial','协调现有安排后参加试学',{planning_need:.7,time_cost:c.trial_time/2},{outdoors:true}),inquire('confirm','先问清学习时段、费用与师傅要求'),defer('defer','暂缓这次试学'),reject('decline','放弃这次试学')]},
 education:{goal:'是否接受家庭提供的长期教育机会',actions:[accept('commit_terms','接受并开始长期学习',{long_term_commitment:1,career_value:.8,planning_need:.5},{requires_information:true}),inquire('check_terms','核实学费、期限与日程'),defer('defer_terms','暂缓入学'),reject('decline_terms','拒绝这次教育安排')]},
 career:{goal:'是否进入当前职业机会',actions:[accept('commit_terms','接受并进入新职业',{long_term_commitment:1,career_value:1,financial_value:.6},term),inquire('check_terms','确认工作时间与报酬'),defer('defer_terms','暂缓职业转换'),reject('decline_terms','拒绝这次工作')]},
 relocation:{goal:'是否进入持续三年的离乡发展安排',actions:[accept('commit_terms','接受离乡三年发展',{long_term_commitment:1,career_value:1,financial_value:.7,family_cost:.9,uncertainty:.6},{...term,travel:true}),inquire('check_terms','商量照护交接并核实离乡条件'),defer('defer_terms','暂缓离乡'),reject('decline_terms','留在当前生活中')]},
 away_review:{goal:'离乡期限结束后如何继续生活',actions:[accept('return','结束外地安排并返回家乡',{family_cost:0,relationship_care:.8},{},'return'),accept('extend','延长当前外地工作',{career_value:.8,long_term_commitment:1},{},'extend'),accept('settle','留在当地长期生活',{novelty:.5,long_term_commitment:1,family_cost:.8},{},'settle'),accept('change_path','结束现有工作，转去另一处寻找新道路',{novelty:.8,uncertainty:.5},{},'change_path'),inquire('check_terms','确认续期条件与家庭近况')]},
 marriage:{goal:'是否与这位具体候选继续推进并建立婚姻',actions:[accept('commit_terms','接受与当前候选建立婚姻',{relationship_care:.8,family_cost:.3,long_term_commitment:1},term),inquire('check_terms','与候选见面并商量共同生活安排'),defer('defer_terms','暂缓议亲'),reject('decline_terms','拒绝这次婚配')]},
 birth:{goal:'是否开始孕育并承担照护',actions:[accept('commit_terms','开始孕育与照护安排',{relationship_care:.8,long_term_commitment:1},term),inquire('check_terms','商量双方的照护与时间安排'),defer('defer_terms','暂缓生育'),reject('decline_terms','拒绝本次生育安排')]},
 music:{goal:'是否参加音乐活动及参与方式',actions:[accept('attend','参加音乐活动',{social_exposure:.9,novelty:.6,time_cost:.2},{outdoors:true}),accept('partial','参加部分音乐活动',{social_exposure:.5,time_cost:.1},{outdoors:true}),inquire('confirm','确认活动时间'),reject('decline','婉拒这次活动')]},
 safety:{goal:'如何处理不安全道路的信息与出行',actions:[accept('safe_route','改走已知安全路线',{planning_need:.5,time_cost:.05},{},'safe_route'),inquire('verify','核实消息与替代路线'),defer('delay_trip','推迟非必要出行')]},
 health:{goal:'如何处理当前健康限制',actions:[accept('treatment','休息并接受当前可负担的医治',{efficiency:.8},{},'treatment'),accept('rest','停止额外活动，优先休养',{planning_need:.3},{},'rest')]},
 conflict:{goal:'如何重新安排工作、照护与家计',actions:[accept('reduce_work','减少工作时间以承担照护',{relationship_care:.8},{},'reduce_work'),accept('redistribute','请家庭其他成员接替部分照护',{social_exposure:.5,planning_need:.7},{},'redistribute'),accept('seek_work','调整日程，增加可行的工作收入',{efficiency:.8,financial_value:.7},{},'seek_work'),inquire('consult','商量家庭分工与收支'),defer('observe','暂时维持安排并持续观察')]},
 strain:{goal:'如何应对持续的关系紧张',actions:[accept('discuss','协商共同生活分工',{relationship_care:1,planning_need:.6},{},'discuss'),accept('seek_support','请真实亲友帮助调解',{social_exposure:.7,relationship_care:.8},{},'seek_support'),accept('distance','暂时减少共同活动',{novelty:.5,uncertainty:.6},{outdoors:true},'distance'),defer('endure','暂时维持并继续观察')]}
 };
 const schema=schemas[t];if(!schema)throw Error('未审计的事件类型：'+t);
 e.decision_goal=schema.goal;e.terminal_outcomes=schema.actions.filter(a=>a.conditions.action_type==='terminal_action').map(a=>({action_id:a.id,outcome:a.conditions.outcome,effects:a.conditions.effects}));
 for(const a of schema.actions){if(a.conditions.outcome==='accept'){if(['career','education','relocation','away_review'].includes(t))a.tags.push('pursue_opportunity');if(t==='learning')a.tags.push('skill_practice');if(['marriage','birth'].includes(t)||a.id==='return')a.tags.push('family_priority');}if(t==='relocation'&&a.conditions.outcome==='reject')a.tags.push('decline_long_absence');}
 e.mock_actions=schema.actions.filter(a=>!(e.context_facts.information_acquired&&a.conditions.action_type==='transition_action'));
 e.stage=e.stage||1;e.context_facts={duration:t==='learning'?c.trial_months:t==='relocation'?c.relocation_months:c.education_months,cost:e.cost||0,time:t==='learning'?c.trial_time:.6,...e.context_facts};
 return e;
}
