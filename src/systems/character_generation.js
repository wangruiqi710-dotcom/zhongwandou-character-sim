import {id,integer,pick,weighted} from '../core/rng.js';
import {age} from '../core/state.js';
import {PERSONALITY} from '../config/mock_feature_pools.js';
import {GOALS} from '../config/mock_tunables.js';
import {world} from '../config/worlds.js';
import {inherit,randomInnate} from './genetics.js';
import {joinHousehold} from './household.js';
import {SURNAMES,MALE_PARTS,FEMALE_PARTS,NEUTRAL_PARTS} from '../config/mock_names.js';
export function randomName(s,sex,surname,household_id){
 const family=surname||pick(s,SURNAMES),pool=sex==='男'?MALE_PARTS:FEMALE_PARTS,used=new Set(Object.values(s.characters).map(c=>c.surname+c.given_name));const familyGiven=new Set(Object.values(s.characters).filter(c=>c.current_household_id===household_id).map(c=>c.given_name));let given;
 for(let n=0;n<(s.config.npc_name_retries??24);n++){given=pick(s,pool)+(integer(s,0,3)?pick(s,NEUTRAL_PARTS):'');if(!used.has(family+given)&&!familyGiven.has(given))break;}
 return {surname:family,given_name:given};
}
export function assignGoal(s,c){if(c.life_goal||age(s,c)<12)return false;const p=c.personality,i=c.interests;const weights=[1+s.config.goal_personality_weight*p.planning/100,1+s.config.goal_personality_weight*(100-p.thinking)/100,1+s.config.goal_personality_weight*p.extraversion/100,1+(i.find(x=>['商业','经商'].includes(x.name))?.intensity||0)/100];c.life_goal=GOALS[weighted(s,weights)];c.experiences.push({month:s.current_world_month,type:'life_goal',goal:c.life_goal,weights,source:'MOCK_TUNABLE'});return true;}
export function createCharacter(s,{name,sex,surname,age_years=0,parents=[],household_id,lineage_id,fidelity='full'}={}){
 const cid=id(s,'character'),a=s.characters[parents[0]],b=s.characters[parents[1]];const g=a&&b?inherit(s,a,b):randomInnate(s);
 const names=Object.keys(world(s.world_id).interest_examples),chosen=[];while(chosen.length<s.config.interest_count){const n=pick(s,names);if(!chosen.includes(n))chosen.push(n);}
 sex=sex||pick(s,['男','女']);const named=name?{surname:name.slice(0,1),given_name:name.slice(1)}:randomName(s,sex,surname||a?.surname,household_id);
 const c={character_id:cid,...named,sex,simulation_fidelity:fidelity,alive:true,active_simulation:true,birth_month:s.current_world_month-Math.round(age_years*12),death_month:null,birthplace:s.world_id,biological_parent_ids:[...parents],adoptive_parent_ids:[],adoption_records:[],current_household_id:null,marriage_id:null,spouse_character_id:null,lineage_id:lineage_id||a?.lineage_id||id(s,'lineage'),talents:g.talents,physiology:g.physiology,appearance:g.appearance,personality:Object.fromEntries(PERSONALITY.map(k=>[k,integer(s,0,100)])),interests:chosen.map(name=>({name,intensity:integer(s,0,100),source:'MOCK_ONLY'})),life_goal:null,skills:[],dynamic:{fatigue:0,stress:10,mood:65},experiences:[{month:s.current_world_month,type:parents.length?'birth':'creation',genetics:g.explanation}]};
 c.personality.risk_orientation=integer(s,0,100);c.mock_marriage_willingness=integer(s,15,100);c.mock_design_candidates={risk_orientation:'MOCK_DESIGN_CANDIDATE'};
 s.characters[cid]=c;s.health[cid]={value:s.config.initial_health,condition:'normal',history:[]};s.resources.personal[cid]={personal_inheritable_estate:0};if(household_id)joinHousehold(s,cid,household_id);assignGoal(s,c);return c;
}
