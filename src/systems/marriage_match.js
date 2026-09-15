// MOCK_TUNABLE approximate matching; no formal social-class or romance system.
import {age} from '../core/state.js';
import {lifeContext} from './life_context.js';
export function marriageMatch(s,cid,event){
 const subject=event.family_subject_id||cid,c=s.characters[subject],other=s.characters[event.target_id],family=event.response_role==='candidate_family',support=[],obstacles=[],factors={};
 const add=(list,code,reason)=>list.push({actor_id:cid,code,reason,strong:false});if(!other)return {support,obstacles,factors};
 const ah=c.current_household_id,bh=other.current_household_id,fa=s.resources.households[ah].household_resources,fb=s.resources.households[bh].household_resources,rel=Object.values(s.relationships).find(r=>r.people.includes(subject)&&r.people.includes(other.character_id)),gap=Math.abs(age(s,c)-age(s,other));
 factors.age_gap=gap;if(gap>s.config.marriage_gap_years)add(obstacles,'age_gap','双方年龄差较大，人生阶段与未来安排不同');else add(support,'age_match','双方年龄与人生阶段较接近');
 factors.resources={own:fa,other:fb};if(family&&Math.max(fa,fb)/Math.max(1,Math.min(fa,fb))>s.config.marriage_resource_ratio)add(obstacles,'household_gap','两家实际资源差距较大，婚后投入预期不一致');else add(support,'household_fit','两家的现有资源可支持基本婚后安排');
 const job=s.careers[other.character_id],edu=s.education[other.character_id];factors.prospects={career:job?.status||'none',education:edu?.status||'none',background:other.mock_background||'未定义',social_position:'DESIGN_QUESTION: 用现有职业和教育近似'};
 if(job?.status==='active'||edu?.status==='active')add(support,'prospects','对方有正在持续的职业或教育安排');else if(family&&fb<s.config.marriage_cost*2)add(obstacles,'prospects','对方缺少当前收入或学习安排，家庭储备也有限');
 factors.relationship=rel?.attitude??0;if((rel?.attitude??0)<-20)add(obstacles,'personal_relationship','双方已有关系较差');else add(support,'personal_relationship','双方当前没有明显关系冲突');
 const cross=Object.values(s.relationships).filter(r=>r.people.some(id=>s.characters[id]?.current_household_id===ah)&&r.people.some(id=>s.characters[id]?.current_household_id===bh));factors.family_relationships=cross.map(r=>r.attitude);
 if(family&&cross.some(r=>r.attitude<-30))add(obstacles,'families_relationship','两家成员已经存在明显关系矛盾');
 factors.marriage_willingness=c.mock_marriage_willingness??50;if(!family&&(c.mock_marriage_willingness??50)<s.config.marriage_willingness_low)add(obstacles,'marriage_willingness','候选目前的婚姻意愿较低');
 if(c.preferred_partner_id&&c.preferred_partner_id!==other.character_id)add(obstacles,'other_partner','候选已记录对另一人的婚配偏好');
 if(Object.values(s.ongoing_situations).some(x=>x.type==='marriage_negotiation'&&x.status==='active'&&x.participants.includes(subject)&&!x.participants.includes(other.character_id)))add(obstacles,'other_arrangement','候选已有另一项正在进行的议亲安排');
 const lc=lifeContext(s,subject);factors.care_time=lc.care_time;if(lc.care_time>0)add(obstacles,'family_care','候选正在承担实际家庭照护，迁入另一家庭需要交接');
 const moving=lc.away||lifeContext(s,other.character_id).away||(c.mock_locality||'本地')!==(other.mock_locality||'本地');factors.post_marriage_residence='迁入提出议亲者家庭';if(moving)add(obstacles,'relocation','婚后共同生活涉及真实地点变化');
 factors.goal=c.life_goal;if(c.life_goal==='家庭生活')add(support,'family_goal','建立稳定家庭与候选的人生目标一致');if(c.life_goal==='财富积累'&&fb<fa/5)add(obstacles,'wealth_conflict','婚后资源安排明显不符合候选积累财富的方向');
 return {support,obstacles,factors,source:'MOCK_TUNABLE'};
}
