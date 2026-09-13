import {bound} from '../core/rng.js';
import {addLongTerm} from './long_term_state.js';
import {changeRelationship} from './relationships.js';
export function fulfillWish(s,cid){s.player.fulfilled_wishes++;if(s.player.fulfilled_wishes%3===0)s.player.force_credits++;s.characters[cid].experiences.push({month:s.current_world_month,type:'wish_fulfilled'});}
export function applyForce(s,cid,result,action_id,actor_id=null){
 const target=result.candidate_actions.find(a=>a.action_id===action_id),blocked=result.excluded_actions.find(a=>a.action_id===action_id);
 if(!target||!target.feasible)return {executed:false,reason:blocked?.exclusion_reason||'指定安排不在可行选项中'};
 if(s.player.force_credits<1)return {executed:false,reason:'需要完成三个主动愿望获得强制机会；测试预设可提供已获得机会'};
 s.player.force_credits--;const c=s.characters[cid],resistance=result.chosen_action_id===action_id?0:1-(target.probability/100);
 const before={...c.dynamic};c.dynamic.stress=bound(c.dynamic.stress+s.config.forced_stress*resistance);c.dynamic.mood=bound(c.dynamic.mood-s.config.forced_mood_loss*resistance);
 if(actor_id&&actor_id!==cid)changeRelationship(s,cid,actor_id,-s.config.forced_relationship_loss*resistance,'强制当前安排');
 if(resistance>0)addLongTerm(s,cid,'forced_adjustment',null,s.config.adjustment_months,70,['减少外出']);
 c.experiences.push({month:s.current_world_month,type:'forced_arrangement',action:target.action,resistance});
 return {executed:true,action:target,resistance,before,after:{...c.dynamic},scope:'current_arrangement_only'};
}
