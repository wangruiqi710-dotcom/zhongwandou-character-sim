import {lifeContext} from './life_context.js';
export const available=(s,cid)=>{const c=s.characters[cid],h=s.resources.households[c.current_household_id];return (h?.support_enabled?Math.max(0,h.household_resources)*s.config.support_fraction:0)+(s.resources.personal[cid]?.personal_inheritable_estate||0);};
export function spend(s,cid,amount){if(amount<0||!Number.isFinite(amount)||available(s,cid)+1e-8<amount)return false;const h=s.resources.households[s.characters[cid].current_household_id];const household=h.support_enabled?Math.min(amount,Math.max(0,h.household_resources)*s.config.support_fraction):0;h.household_resources-=household;h.one_time_expense+=household;s.resources.personal[cid].personal_inheritable_estate-=amount-household;return true;}
export function settleResources(s,workFractions){
 const changes=[];for(const h of Object.values(s.households)){
  const r=s.resources.households[h.household_id],living=h.members.filter(id=>s.characters[id].alive);r.one_time_income=0;r.one_time_expense=0;let income=0,expenses=0;const remote=[];
  for(const cid of living){const away=lifeContext(s,cid).away,earned=s.careers[cid]?.status==='active'?s.config.wage*s.careers[cid].wage*(workFractions[cid]||0)*(away?s.config.away_income_multiplier:1):0,cost=s.config.living_cost*(away?s.config.away_living_multiplier:1)+(s.education[cid]?.status==='active'?s.config.education_cost*(s.education[cid].funding_fraction??1):0);
   if(!away){income+=earned;expenses+=cost;continue;}
   const personal=s.resources.personal[cid],net=earned-cost,remittance=Math.max(0,net)*(s.config.remote_remittance_fraction??.5),before=personal.personal_inheritable_estate;
   // One settlement: remote wages minus actual living costs, then a real transfer.
   const balance=before+net-remittance,shortfall=Math.max(0,-balance);personal.personal_inheritable_estate=Math.max(0,balance);income+=remittance;expenses+=shortfall;
   remote.push({character_id:cid,income:earned,cost,remittance,household_support:shortfall,before,after:personal.personal_inheritable_estate});
  }
  r.recurring_income=income;r.recurring_expenses=expenses;const old=r.household_resources;r.household_resources=Math.round((old+income-expenses)*100)/100;r.unfunded_months=r.household_resources<0?r.unfunded_months+1:0;changes.push({household_id:h.household_id,before:old,after:r.household_resources,income,expenses,remote});
 }return changes;
}
