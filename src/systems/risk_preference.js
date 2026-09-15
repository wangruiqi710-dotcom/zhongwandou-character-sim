// MOCK_DESIGN_CANDIDATE: independent of planning and stress resistance.
export function riskPreference(s,cid,event,actions){
 const orientation=((s.characters[cid].personality.risk_orientation??50)-50)/50,unknown=event.conditions?.contract_terms_known===false||event.conditions?.information_verified===false;
 return actions.map(a=>{const traits=a.traits||{},uncertain=Math.max(unknown?1:0,traits.risk||0,traits.uncertainty||0),inquiry=a.action_type==='transition_action',modifier=(s.config.risk_weight??.9)*orientation*uncertain*(inquiry?-1:a.outcome==='accept'?1:0);return {...a,risk_orientation_modifier:modifier,base_weight:a.base_weight*Math.exp(modifier)};});
}
