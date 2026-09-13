import {random,pick,integer,weighted,bound} from '../core/rng.js';
import {FACE,COLORS,COLOR_POOLS,HAIRSTYLES,POOLS,TALENTS,BODY} from '../config/mock_feature_pools.js';
function pool(s,k){const p=POOLS[k];return p[weighted(s,p.map(x=>x.weight))].id;}
export function inherit(s,a,b){
 const explanation={continuous:{},face:{},colors:{},body:null,hairstyle:'independent MOCK_ONLY pool'};
 const continuous=(key,av,bv)=>{const lo=Math.min(av,bv),hi=Math.max(av,bv),c=s.config;const outsideWeight=c.continuous_genetics_mutation_rate,inWeight=c.continuous_genetics_in_range_weight;const outside=random(s)*(outsideWeight+inWeight)<outsideWeight;let value;
 if(outside){const lower=lo>0,upper=hi<100;const below=lower&&(!upper||random(s)<.5);value=lower||upper?below?integer(s,Math.max(0,Math.ceil(lo-c.continuous_genetics_mutation_range)),Math.max(0,Math.ceil(lo)-1)):integer(s,Math.min(100,Math.floor(hi)+1),Math.min(100,Math.floor(hi+c.continuous_genetics_mutation_range))):integer(s,0,100);}
 else value=integer(s,Math.ceil(lo),Math.floor(hi));
 value=bound(value);explanation.continuous[key]={father:av,mother:bv,sampling_interval:[lo,hi],outside:value<lo||value>hi,value};return value;};
 const talents=Object.fromEntries(TALENTS.map(k=>[k,continuous(k,a.talents[k],b.talents[k])]));
 const physiology=Object.fromEntries(['height_basis','constitution','fertility_basis'].map(k=>[k,continuous(k,a.physiology[k],b.physiology[k])]));
 physiology.body_type=random(s)<s.config.body_parent_weight?pick(s,[a.physiology.body_type,b.physiology.body_type]):pick(s,BODY);
 explanation.body={father:a.physiology.body_type,mother:b.physiology.body_type,value:physiology.body_type};
 const appearance={};const n=weighted(s,s.config.face_mutation_count_weights),indices=[...FACE];for(let i=indices.length-1;i>0;i--){const j=integer(s,0,i);[indices[i],indices[j]]=[indices[j],indices[i]];}
 const mutations=new Set(indices.slice(0,n));for(const k of FACE){const source=mutations.has(k)?'mutation':pick(s,['father','mother']);appearance[k]=source==='mutation'?pool(s,k):(source==='father'?a:b).appearance[k];explanation.face[k]={source,value:appearance[k]};}
 for(const k of COLORS){appearance[k]=pick(s,[a.appearance[k],b.appearance[k]]);explanation.colors[k]={father:a.appearance[k],mother:b.appearance[k],value:appearance[k]};}
 appearance.hairstyle_id=pick(s,HAIRSTYLES);
 return {talents,physiology,appearance,explanation};
}
export function randomInnate(s){return {talents:Object.fromEntries(TALENTS.map(k=>[k,integer(s,0,100)])),physiology:{height_basis:integer(s,0,100),constitution:integer(s,0,100),fertility_basis:integer(s,0,100),body_type:pick(s,BODY)},appearance:{...Object.fromEntries(FACE.map(k=>[k,pool(s,k)])),...Object.fromEntries(COLORS.map(k=>[k,pick(s,COLOR_POOLS[k])])),hairstyle_id:pick(s,HAIRSTYLES)},explanation:{source:'MOCK_ONLY founder generation'}};}
