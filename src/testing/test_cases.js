import {createState,clone} from '../core/state.js';
import {createHousehold} from '../systems/household.js';
import {createCharacter} from '../systems/character_generation.js';
import {enroll,employ} from '../systems/education_career.js';
import {establishMarriage} from '../systems/marriage.js';
import {relationship} from '../systems/relationships.js';
import {startReproduction} from '../systems/reproduction.js';
import {defaults} from '../config/mock_tunables.js';
export const CASES={
 'TC-RESOURCE-01':['兴趣很高，但资源不足','event','learning'],
 'TC-GOAL-01':['短期试学与家庭目标','event','learning'],
 'TC-EDU-01':['学生正常教育生活','months',12],
 'TC-CAREER-01':['稳定工作与持续收入','months',12],
 'TC-HOUSEHOLD-01':['家庭资源恶化','months',12],
 'TC-MARRIAGE-01':['家庭普通推动婚配','marriage','ordinary'],
 'TC-MARRIAGE-02':['家庭强制推动婚配','marriage','force'],
 'TC-FORCED-24M':['强制婚配后观察24个月','forced24',24],
 'TC-BIRTH-01':['生育到独立新生人物','birth',12],
 'TC-GENETICS-01':['同一对父母20名子代','genetics',20],
 'TC-GENETICS-03GEN':['连续三代遗传','generations',3],
 'TC-DEATH-01':['控制人物死亡','death'],
 'TC-SUCCESSION-01':['多个接班候选，等待玩家','death'],
 'TC-INHERITANCE-01':['玩家指定60/40继承','death']
};
export const COMBINATIONS=[
 ['教育 + 家庭 + 财富','TC-EDU-01'],['职业 + 兴趣 + 人生目标 + 财富','TC-CAREER-01'],
 ['关系 + 婚姻 + 家庭','TC-MARRIAGE-01'],['家庭 + 玩家干预 + 婚配','TC-MARRIAGE-01'],
 ['婚姻 + 强制干预 + 动态状态 + 关系','TC-FORCED-24M'],['生育 + 遗传 + 人物生成 + 家庭','TC-BIRTH-01'],
 ['健康 + 默认行为 + 决策事件','health'],['死亡 + 家庭 + 接班 + 继承','TC-INHERITANCE-01']
];
export function fixture({seed=12345,world='ancient',case_id='life',config=defaults(),template='neutral',resources=1000,health=90,stress=10,attitude=20}={}){
 const s=createState(Number(seed),world,config),home=createHousehold(s,'林家'),other=createHousehold(s,'陈家');
 const father=createCharacter(s,{name:'林远',sex:'男',age_years:46,household_id:home}),mother=createCharacter(s,{name:'沈宁',sex:'女',age_years:44,household_id:home});
 const child=createCharacter(s,{name:'林禾',sex:'女',age_years:20,parents:[father.character_id,mother.character_id],household_id:home});
 const sibling=createCharacter(s,{name:'林安',sex:'男',age_years:18,parents:[father.character_id,mother.character_id],household_id:home});
 const target=createCharacter(s,{name:'陈明',sex:'男',age_years:22,household_id:other});
 for(const h of Object.values(s.resources.households))h.household_resources=Number(resources);
 for(const c of Object.values(s.characters)){if(template!=='random'){for(const k of Object.keys(c.personality))c.personality[k]=50;for(const k of Object.keys(c.talents))c.talents[k]=50;}s.health[c.character_id].value=Number(health);c.dynamic.stress=Number(stress);}
 if(template==='outgoing')child.personality.extraversion=90;if(template==='reserved')child.personality.extraversion=10;
 employ(s,father.character_id,0);employ(s,mother.character_id,1);employ(s,target.character_id,1);
 relationship(s,child.character_id,target.character_id).attitude=Number(attitude);relationship(s,child.character_id,father.character_id).attitude=20;
 // The preset parents already share a marriage; initialization is explicit scenario data.
 const parentMarriage='preset-parent-marriage';s.marriages[parentMarriage]={id:parentMarriage,people:[father.character_id,mother.character_id],status:'active',start_month:s.current_world_month-21*12,origin:'MOCK_ONLY fixture',history:[]};
 s.control.current_control_character_id=child.character_id;s.player.force_credits=s.config.force_initial_credit;
 s.test={case_id,child_id:child.character_id,target_id:target.character_id,father_id:father.character_id,mother_id:mother.character_id};
 if(case_id==='TC-RESOURCE-01'){s.resources.households[home].household_resources=0;child.interests=[{name:world==='ancient'?'手工':'音乐',intensity:99,source:'MOCK_ONLY'}];}
 if(case_id==='TC-GOAL-01')child.life_goal='家庭生活';
 if(case_id==='TC-EDU-01'){child.birth_month=s.current_world_month-14*12;enroll(s,child.character_id);}
 if(['TC-CAREER-01','life'].includes(case_id))employ(s,child.character_id,2);
 if(case_id==='TC-HOUSEHOLD-01'){s.resources.households[home].household_resources=10;for(const cid of s.households[home].members)if(s.careers[cid])s.careers[cid].status='ended';enroll(s,child.character_id);}
 if(case_id==='health')s.health[child.character_id].value=15;
 if(case_id==='TC-BIRTH-01'){establishMarriage(s,child.character_id,target.character_id,'MOCK_ONLY initial fixture');startReproduction(s,child.character_id,target.character_id);}
 if(['TC-DEATH-01','TC-SUCCESSION-01','TC-INHERITANCE-01'].includes(case_id)){s.control.current_control_character_id=father.character_id;s.resources.personal[father.character_id].personal_inheritable_estate=1000;}
 return s;
}
