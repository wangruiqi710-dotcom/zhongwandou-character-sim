import {locationAudit} from './location_audit.js';
import {auditTemplate} from './decision_audit.js';
import {playerDecisionType} from '../config/player_event_routes.js';
// MOCK_EVENT_CONTENT. Authored situations, not a formal game event database.
// Rows: title | eligibility | participant | primary response | alternative | effects | alternative effects.
// Numeric amounts and thresholds are MOCK_TUNABLE; no probability-engine weights are changed.
export const CONTENT_TUNABLES={focus_multiplier:3,continuity_multiplier:2,interest_opportunity_multiplier:.5,cooldown:18,theme_duration:120,failure_base:.18};
const groups=[
['apprentice','学徒 / 师承','手工',[
 '师傅让你试着修一只旧凳|learner|mentor|拆开榫头重做|先照原样描摹|skill:手工:2,relation:2|skill:手工:1,stress:-1',
 '木料开裂，交活日期未变|apprentice|mentor|承认损耗并重做|请师傅接手难处|personal:-6,skill:手工:3,stress:3|relation:-2,skill:手工:1',
 '同门愿意交换磨刀经验|apprentice|peer|互相演示各自手法|保留配方，只交流工具|relation:4,skill:手工:1|relation:-1,mood:1',
 '师傅愿意留下你长期做活|trained|mentor|接下长期作坊安排|结束试学，寻找别的道路|career:0,relation:5|stoptrial:1,mood:-2'
]],
['education','教育与学习','读书',[
 '家中旧账本成了识字材料|youth|parent|请长辈逐字指认|自己临摹熟悉的字|skill:读书:2,relation:1|skill:书法:1',
 '抄写课业与家务挤在一起|student|family|商量保留一段读书时间|本月少做课业|stress:-3,relation:2|progress:-1,fatigue:-3',
 '一篇习作被退回重写|student|mentor|按批注逐段重写|先找出一处最明显错误|skill:读书:3,stress:2|skill:读书:1,mood:-1',
 '私塾愿意接纳长期旁听|youth|parent|争取完整的学习安排|暂时只借读旧书|education:0,skill:读书:1,household:-120|skill:读书:2'
]],
['firstwork','职业与谋生','农事',[
 '邻家缺人整理待播种子|unemployed|neighbor|帮忙半天换取报酬|只借出筛子|personal:8,skill:农事:1|relation:2',
 '短工报酬比约定少了一份|worker|peer|当面核对工日|先收下现钱，保留争议|personal:5,stress:3|mood:-3,relation:-2',
 '集市收摊后留下搬运活|adult|neighbor|量力接下一小批|替对方找熟人接活|personal:12,fatigue:4|relation:3',
 '农庄给出一季接一季的用工|unemployed|family|接受稳定农事劳动|继续寻找零工|career:2|personal:4,stress:2'
]],
['growth','职业成长','手工',[
 '一次尺寸核对避免了返工|craft|peer|把检查方法告诉同伴|记在自己的样板上|relation:2,skill:手工:1|skill:绘画:1',
 '客人提出更精细的活计|craft|peer|先做小样再接单|只做自己熟悉的部分|personal:18,skill:手工:2,fatigue:3|personal:6,stress:-2',
 '同伴建议轮流检查成品|worker|peer|参与轮流检查|只检查自己的份额|relation:3,stress:-2|skill:手工:1,relation:-1',
 '作坊愿意让你负责成品交接|craft|mentor|承担长期交接职责|继续专注原有工序|wage:0.12,stress:5,relation:4|skill:手工:3'
]],
['setback','失败与挫折','经商',[
 '卖出的货被退回一小件|merchant|neighbor|修整后退换|说明瑕疵，协商折价|personal:-9,relation:2|personal:-4,relation:-2',
 '连日少客，原定工时难以维持|worker|peer|缩减工时保住岗位|用空出的时间练熟手艺|wage:-0.1,stress:-2|skill:手工:2,stress:3',
 '同行教你辨认失误的来由|worker|peer|复盘最近一次失误|暂歇一日，缓解挫败|skill:经商:2,relation:2|mood:3,fatigue:-4',
 '原来的活计结束，熟人介绍另一行|worker|peer|转做商铺帮工|暂时离开固定工作|career:1,stress:4|quit:1,mood:-4'
]],
['away','离乡 / 迁移','经商',[
 '行商带回外乡用工的消息|adult|neighbor|询问沿途食宿|只记下联络人|skill:经商:1,relation:2|relation:1,mood:1',
 '外地寄宿的费用突然增加|away|parent|缩减非必要支出|请家人帮着核实账目|personal:-12,stress:2|relation:3,personal:-7',
 '家人捎来家乡近况|away|parent|回信说明生活与归期|托人带去一份小礼|relation:4,mood:2|personal:-8,relation:5',
 '远方铺子提供三年学做生意机会|adult|family|安排交接后离乡|留乡寻找相近的活计|relocation:1|skill:经商:1,relation:2'
]],
['hardship','家庭资源','农事',[
 '粮缸见底，家里重新盘点口粮|poor|family|共同清点并减少损耗|先用自己的余钱补缺|household:5,relation:1|transfer:8,stress:2',
 '修屋顶与买口粮不能同时办|poor|family|先补最漏的一处|先保障口粮，暂缓修缮|household:-14,stress:-2|household:-8,fatigue:2',
 '邻里愿意交换剩余种粮|poor|neighbor|用劳动换需要的种粮|少量交换，保留备用|household:11,fatigue:3,relation:3|household:4,relation:1',
 '家庭积蓄只够维持一人的课业|students|sibling|集中支持当前学习者|两人都减少额外课业|fundeducation:1,relation:-3|reduceeducation:1,stress:-3'
]],
['improve','个人财富','经商',[
 '一笔拖欠的小报酬终于送到|worker|peer|收款后补足家用|留下部分个人备用|household:17,mood:2|personal:13,mood:1',
 '家中终于能换掉漏底的锅|funded|family|买结实的日用品|修补旧物继续用|household:-16,stress:-4|household:-3,skill:手工:1',
 '商户想长期收购家里的余物|funded|neighbor|先试卖小批|留作家用，暂不外卖|household:19,skill:经商:1|mood:2,relation:1',
 '攒下的余钱可支持一人学手艺|funded|child|支持孩子进入作坊学习|保留积蓄应付变故|targeteducation:1,household:-90|stress:-4,relation:-1'
]],
['duty','家庭责任','烹饪',[
 '天未亮，照护与备饭同时等着你|carer|family|提前准备能分着吃的饭|请同住者搭把手|skill:烹饪:1,fatigue:2|relation:2,stress:-2',
 '加做一批活会撞上照护时段|carer|family|减少本月工作时间|请有空的家人接替一部分|reducework:1,stress:-3|reassign:1,relation:2',
 '家人察觉你许久没有休息|stressed|family|接受半日替班|只把一件杂事交出去|fatigue:-8,relation:3|stress:-3,relation:1',
 '长期照护与外地机会同时到来|carer|parent|先保障照护，调整工作|有合适接替者才离乡|reducework:1,relation:5|relocation:1'
]],
['parents','父母与子女','读书',[
 '长辈讲起自己年轻时错过的机会|youth|parent|认真听完并追问|陪伴做事，少谈往事|relation:3,skill:读书:1|relation:2,fatigue:1',
 '父母不赞同你现有的学习方向|student|parent|拿出真实进度商量|暂时不争论，继续课业|relation:4,stress:3|relation:-2,progress:1',
 '父亲承认误会了你的一次迟归|tense|parent|说明事情经过|接受道歉，不再细究|relation:7,stress:-2|relation:3,mood:2',
 '年迈父母希望你留出固定陪伴时间|adult|elder|调整工作承担长期照护|商量轮流承担，不独自答应|care:1,relation:6|reassign:1,relation:3'
]],
['siblings','兄弟姐妹','手工',[
 '兄妹争用同一件工具|youth|sibling|约好轮流用|先让对方用完|relation:2,skill:手工:1|relation:3,stress:1',
 '兄弟想让你替他完成一份差事|adult|sibling|一起完成最难的部分|说明自己也有责任|relation:4,fatigue:4|relation:-2,stress:-2',
 '妹妹主动归还上次借去的东西|any|sibling|感谢并聊聊近况|收好东西，各忙各的|relation:5,mood:1|relation:1',
 '兄弟准备独自去外地谋生|adult|sibling|拿自己的备用钱支持|劝他先在本地试工|transfer:15,relation:4|relation:-3,skill:经商:1'
]],
['competition','家庭内部资源竞争','读书',[
 '孩子发现另一人拿到了新纸笔|parent|child|解释用途并分享旧纸|请孩子先用完现有材料|relation:2,household:-3|relation:-2,stress:1',
 '两份学习计划争用同一段时间|students|sibling|共同排出轮流安排|优先完成自己的课业|relation:3,progress:1|progress:2,relation:-4',
 '上次受支持的人愿意帮另一个人|student|sibling|一起温习，分享所学|借出笔记，保留练习时间|relation:6,skill:读书:1|relation:2,progress:1',
 '两名家人都希望得到外出学艺资助|students|sibling|先支持较接近完成的人|降低两人的额外投入|fundeducation:1,household:-40|reduceeducation:1,relation:2'
]],
['friends','朋友 / 熟人','社交往来',[
 '旧识在集市认出了你|adult|friend|停下叙旧|约定下次再谈|relation:4,mood:1|relation:1',
 '朋友请你帮忙介绍可靠的短工|adult|friend|核实双方要求再介绍|只转达消息，不作担保|relation:5,stress:2|relation:2,skill:经商:1',
 '朋友误以为你故意避而不见|tense|friend|当面解释最近的困难|先托人说明，再约见面|relation:8,stress:1|relation:4,personal:-2',
 '朋友落脚未定，想暂住你家|adult|friend|与家人商量提供短期帮助|帮助寻找别的住处|household:-22,relation:7|personal:-5,relation:3'
]],
['mentor','师徒关系','手工',[
 '师傅指出一个你未察觉的好习惯|learner|mentor|继续练习这道工序|向师傅请教别的短处|skill:手工:2,mood:3|relation:2,skill:手工:1',
 '师傅把未做好的活退了回来|apprentice|mentor|承认问题并补做|请求示范后再尝试|skill:手工:3,fatigue:3|relation:3,stress:-1',
 '你发现师傅这次估错了用料|trained|mentor|私下提醒并核对|先按旧法做一小件验证|relation:4,skill:经商:1|personal:-3,skill:手工:2',
 '师傅计划搬走，问你是否随行|apprentice|mentor|核实食宿后随师离乡|留乡继续现有手艺|relocation:1,relation:4|skill:手工:3,relation:-2'
]],
['match','婚配','社交往来',[
 '亲友谈起一位尚未婚配的熟人|single|candidate|先了解本人意愿|暂时只保持普通来往|relation:2,mood:1|relation:1',
 '议亲对象希望先谈清家庭责任|negotiating|candidate|如实说明照护与开支|承认暂时安排不开|relation:4,stress:-1|relation:-1,mood:-2',
 '上次没有谈成的人再次来往|refused|candidate|以普通熟人相待|保持礼貌距离|relation:3,stress:-2|relation:-1,stress:-1',
 '真实候选提出认真商议共同生活|single|candidate|向家庭提出正式议亲|暂缓本次婚配机会|marriage:1|relation:-2,mood:-1'
]],
['married','婚后生活','烹饪',[
 '夫妻第一次一起盘点家中杂物|married|spouse|一边整理一边商量用法|各自整理熟悉的一部分|relation:3,skill:烹饪:1|fatigue:-2,relation:1',
 '两人的作息影响了彼此休息|married|spouse|调整一段工作时间|先分别安排休息角落|reducework:1,relation:3|relation:1,household:-4',
 '配偶悄悄修好了你常用的物件|married|spouse|认真道谢并帮对方做事|送一件实用的小物|relation:5,fatigue:1|personal:-6,relation:4',
 '夫妻想留出固定的共同生活时间|married|spouse|调整忙碌的工作安排|保持安排，只减少额外差事|reducework:1,relation:6|stress:-3,relation:2'
]],
['couple','夫妻关系','社交往来',[
 '一次购物引起小小埋怨|married|spouse|解释用途并听完意见|退回暂时不需要的物件|relation:2,stress:1|household:4,mood:-2',
 '配偶认为家中的责任分配不公|married|spouse|重新分工并承担一项任务|先请对方说明最吃力的部分|reassign:1,relation:4|relation:2,stress:-1',
 '一起处理麻烦后两人重新说上话|strained|spouse|谈清之前积压的误会|先恢复普通陪伴|relation:9,stress:-3|relation:4,mood:3',
 '争执已影响工作，双方商量暂时少见面|strained|spouse|短期减少共同活动|留下并主动减少工作负担|distance:1,relation:-4|reducework:1,relation:5'
]],
['parenting','生育和育儿','烹饪',[
 '幼儿夜里醒来，两人都很疲倦|infant|spouse|轮流安抚孩子|先让最疲惫的人睡一会|fatigue:3,relation:2|fatigue:5,relation:4',
 '孩子照护用品的开销超出预想|infant|family|添置必要用品|向亲友借用合适的旧物|household:-18,stress:-2|relation:3,household:-4',
 '孩子第一次愿意自己吃饭|parent|child|耐心陪孩子尝试|先帮一半，留下简单部分|targetskill:烹饪:1,relation:4|relation:2,fatigue:-1',
 '夫妻认真讨论是否再养育一个孩子|fertile|spouse|做好照护安排后尝试|暂缓，先照顾现有生活|birth:1|stress:-3,relation:1'
]],
['children','子女成长','读书',[
 '孩子主动翻看家中的旧书|parent|child|陪孩子读懂一小段|让孩子先画出喜欢的东西|targetskill:读书:2,relation:2|targetskill:绘画:1,relation:1',
 '孩子打坏邻家的小器具|parent|child|陪孩子赔礼并修补|先赔偿，再一起说明缘由|household:-7,relation:3|household:-12,stress:2',
 '孩子替家人完成了第一次差事|parent|child|具体肯定做得好的地方|让孩子讲讲遇到的难处|relation:5,targetskill:社交往来:1|relation:3,targetskill:读书:1',
 '孩子希望离开原课业改学手艺|schoolchild|child|提供一次作坊学习机会|暂保原课业并安排短期接触|targeteducation:1,household:-75|targetskill:手工:2,relation:-1'
]],
['illness','疾病与恢复','医术',[
 '家人轻微不适，暂时做不了家务|sickkin|sick|帮忙料理一顿饭|送去能用上的日用品|targethealth:2,fatigue:2|personal:-5,relation:3',
 '亲人反复不适，家中开始担忧|sickkin|sick|陪同寻找可负担的医治|安排安静休养并观察|household:-20,targethealth:7|targethealth:3,stress:2',
 '休养中的家人能重新做一点轻活|recoveringkin|sick|分给不费力的小事|再让对方多休息几日|relation:4,targethealth:1|targethealth:3,fatigue:2',
 '亲人病情加重，需要家庭集中投入|seriouskin|sick|使用积蓄支持医治|减少工作，由家人轮流照护|household:-80,targethealth:25|reducework:1,targethealth:8'
]],
['care','长期照护','医术',[
 '照护者发现更省力的起居安排|carer|family|重新摆放常用物件|请家人试着接手一次|fatigue:-4,skill:医术:1|relation:3,stress:-2',
 '连续照护让你错过了一次接活|carer|family|说明损失并商量分担|暂时接受损失，减少额外活动|reassign:1,relation:2|personal:-6,stress:-2',
 '被照护者终于愿意表达自己的需要|carer|family|按真实需要调整照护|一起排出轻重缓急|relation:6,stress:-3|relation:3,fatigue:-3',
 '家人愿意轮流承担今后的照护|carer|family|交接部分长期责任|保留主要责任并减轻工作|reassign:1,relation:4|reducework:1,stress:-4'
]],
['enterprise','家庭事业','经商',[
 '家里尝试在市集卖掉多余制品|funded|family|记下每笔成本与收入|只少量售卖熟悉的货|household:9,skill:经商:2|household:4,stress:-1',
 '固定买家要求先做一批样品|merchant|neighbor|用可承受的材料试做|要求先说明用途再接小单|household:-13,skill:手工:2|personal:7,relation:1',
 '家人从一笔赔本买卖中算清了损耗|merchant|family|共同复盘成本|停止这类货，先保住现有收入|skill:经商:3,relation:2|household:3,mood:-2',
 '家人想长期接手铺子里的差事|adult|adultkin|提供学习商铺事务的机会|暂时只分担日常差事|targetcareer:1,household:-60|relation:2,targetskill:经商:1'
]],
['skill','技能成长','手工',[
 '空闲时发现一把需要修整的小工具|any|none|试着修好并记录手法|借用现成工具先完成事情|skill:手工:1,personal:2|personal:-1,stress:-1',
 '练习许久仍在同一道难处停滞|learner|mentor|拆成更小的动作反复练|休息后请人演示|skill:手工:2,stress:2|relation:3,fatigue:-3',
 '过去练习的手法终于派上用场|trained|peer|用熟练手法帮助同伴|独自完成自己的那一份|skill:手工:1,relation:4|personal:5,mood:2',
 '熟人愿意与你长期交换技艺|trained|peer|安排持续的互相学习|保留自由时间，只偶尔交流|trial:1,relation:5|skill:手工:2,stress:-2'
]],
['network','社交网络积累','社交往来',[
 '邻居邀请你一起修整公共小路|adult|neighbor|做一段力所能及的活|借出工具并说明无法久留|relation:3,fatigue:2|relation:2,personal:-2',
 '熟人请你为一场误会作证|adult|friend|只说明亲眼看到的部分|请双方先对照各自记忆|relation:4,stress:3|relation:1,stress:1',
 '曾受帮助的人介绍了一位同行|worker|peer|抽空交流各自的工作|留下日后联络的方式|relation:5,skill:社交往来:1|relation:2,mood:1',
 '邻里请你长期协助协调杂务|adult|neighbor|接受有限的固定协助|只处理自己熟悉的一部分|care:1,relation:7|relation:3,stress:1'
]]];
const extras=[
 ['日常变化','秋收前发现储粮处漏雨','farmer','family','及时搬粮并补漏','先垫高粮袋','household:-5,skill:手工:1','household:-2,fatigue:3'],
 ['工作环境','磨损的工具让工作格外费力','worker','peer','与同伴一起修整','暂用备用工具','skill:手工:2,relation:1','personal:-3,fatigue:2'],
 ['邻里','邻家送来一小篮时蔬','any','neighbor','回送一点家中余物','感谢并答应下次帮忙','household:-2,relation:4','relation:2,mood:2'],
 ['疲劳 / 压力','连日忙碌后终于空出半天','tired','none','好好休息','做一点轻松熟悉的事','fatigue:-10,mood:2','fatigue:-5,skill:烹饪:1'],
 ['健康','轻微不适打断一次普通出行','sickself','none','留在家中休养','缩短行程后回来','health:4,fatigue:-4','health:1,stress:1'],
 ['家庭日常','家人合力准备一顿节令饭','any','family','负责一道拿手的菜','帮忙收拾并陪伴','skill:烹饪:2,relation:2','relation:3,fatigue:1'],
 ['人生阶段变化','年岁渐长，重活做起来慢了','elder','adultkin','把技巧传给年轻家人','改做自己能承担的轻活','targetskill:农事:2,relation:4','reducework:1,fatigue:-6'],
 ['NPC 主动行为','旧识说起自己近来新学的本事','adult','friend','请对方演示并交流','听完近况后相约再见','targetskill:手工:2,relation:3','relation:2,mood:3']
];
const majorGroups=new Set(['apprentice','education','firstwork','growth','setback','away','hardship','improve','duty','parents','competition','mentor','match','couple','parenting','children','illness','enterprise']);
function effects(text){return text.split(',').map(x=>{const [kind,a,b]=x.split(':');return {kind,value:Number(b??a),...(b?{skill:a}:{})};});}
function compile(theme,domain,interest,line,index,major){
 const [title,condition,role,accept,alternative,yes,no]=line.split('|'),importance=index<2&&!(index===1&&['hardship','duty','competition','illness'].includes(theme))?'daily':major&&index===3?'major':'medium';
 const effectList=effects(yes),other=effects(no),id=theme+'-'+(index+1);
 const template={event_id:id,theme,domain,importance,event_type:importance==='major'?'PLAYER_DECISION_EVENT':'CHARACTER_DECISION_EVENT',source:'MOCK_EVENT_CONTENT',developmental:!theme.startsWith('daily'),
  trigger_conditions:{world:'ancient',condition,min_age:condition==='any'?6:condition==='youth'?6:condition==='parent'?18:12,history_or_state:index>=2?theme:null},participant_requirements:{role,real_person:role!=='none'},
  decision_goal:title+'：怎样回应这次具体处境',terminal_outcomes:[{id:'respond',label:accept,effects:effectList},{id:'alternative',label:alternative,effects:other}],
  transition_actions:importance==='daily'?[]:[{id:'ask_terms',label:'核实这件事的费用、时间和当事人要求',information:['cost','time','participants']}],
  feasibility_requirements:['存活','实际年龄与身份','真实参与者','资源不足不允许付费选项','照护无人接替不能离乡'],
  immediate_effect_types:[...new Set([...effectList,...other].map(e=>e.kind))],possible_long_term_states:theme.startsWith('daily')?[]:[theme,...effectList.filter(e=>['career','education','relocation','care','trial','distance'].includes(e.kind)).map(e=>e.kind)],possible_ongoing_situations:index===1?[theme]:[],
  followup_tags:[theme],history_requirements:index>=2?[theme+' 的实际经历或对应生活状态']:[],cooldown:importance==='daily'?18:30,repeat_rules:{maximum:importance==='major'?2:6,per_person:true},
  player_involvement:importance==='major'?'家庭资源或长期安排；人物仍有自主回应':'人物自主',interest_examples:[interest],display_templates:{title,description:'{person}遇到：'+title+'。{context}'} };
 if(playerDecisionType({...template,content_template:true})){template.event_type='PLAYER_DECISION_EVENT';template.player_involvement='家庭资源或长期安排；人物仍有自主回应';}
 return locationAudit(auditTemplate(template));
}
export const ANCIENT_EVENTS=groups.flatMap(([theme,domain,interest,rows])=>rows.map((r,i)=>compile(theme,domain,interest,r,i,majorGroups.has(theme)))).concat(extras.map(([domain,...r],i)=>compile('daily'+i,domain,'',r.join('|'),0,false)));
export const CONTENT_DOMAINS=[...new Set(ANCIENT_EVENTS.map(e=>e.domain))];
