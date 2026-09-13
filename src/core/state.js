import {META,defaults} from '../config/mock_tunables.js';
export const clone=x=>structuredClone(x);
export const age=(s,c)=>Math.floor((s.current_world_month-c.birth_month)/12);
export const date=m=>Math.floor(m/12)+'-'+String(m%12+1).padStart(2,'0');
export function createState(seed=12345,world_id='ancient',config=defaults()){
 return {meta:{...META},seed:seed>>>0,rng_state:seed>>>0,next_id:0,world_id,current_world_month:2026*12,config:clone(config),characters:{},households:{},health:{},education:{},careers:{},relationships:{},marriages:{},reproduction:{},long_term_states:{},resources:{households:{},personal:{}},control:{current_control_character_id:null,pending:null,ended:false},inheritances:{},player:{force_credits:0,fulfilled_wishes:0,directions:['学习','家庭','健康']},history:[]};
}
export function snapshot(s,cid){const c=s.characters[cid],hid=c?.current_household_id;return {character:clone(c),character_age:c?age(s,c):null,household:clone(s.households[hid]||null),health:clone(s.health[cid]||null),education:clone(s.education[cid]||null),career:clone(s.careers[cid]||null),resources:{household:clone(s.resources.households[hid]||null),personal:clone(s.resources.personal[cid]||null)},relationships:clone(Object.values(s.relationships).filter(r=>r.people.includes(cid))),marriages:clone(Object.values(s.marriages).filter(r=>r.people.includes(cid))),long_term_states:clone(Object.values(s.long_term_states).filter(r=>r.character_id===cid))};}
export function diff(before,after,path=''){if(JSON.stringify(before)===JSON.stringify(after))return [];if(!before||!after||typeof before!=='object'||typeof after!=='object'||Array.isArray(before)||Array.isArray(after))return [{path,before:before??null,after:after??null}];return [...new Set([...Object.keys(before),...Object.keys(after)])].flatMap(k=>diff(before[k],after[k],path?path+'.'+k:k));}
// History carries current facts, not thousands of copies of the same past history.
// Complete feedback snapshots are reconstructed from the run's initial state + commands.
export function auditSnapshot(full,month){
 const out=clone(full);if(!out?.character)return out;
 for(const key of ['talents','personality','appearance','physiology','interests'])delete out.character[key];
 out.character.experiences=out.character.experiences.filter(e=>e.month===month);
 for(const obj of [out.household,out.health,...out.relationships,...out.marriages])if(obj?.history)obj.history=obj.history.filter(e=>e.month===month);
 out.complete_state_available_via_replay=true;return out;
}
