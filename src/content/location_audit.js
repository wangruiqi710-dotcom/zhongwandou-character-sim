// MOCK_CONTENT audit of all 104 templates. No title/effect rewriting.
const remote=new Set(['away-2','away-3']);
const anywhere=new Set(['skill-1','daily3-1','daily4-1','education-4','hardship-4','improve-4','competition-4','children-4','illness-4','enterprise-4']);
const householdRoles=new Set(['family','parent','sibling','child','adultkin','elder','spouse','sick']);
export function locationAudit(t){
 const scope=remote.has(t.event_id)?'remote_only':anywhere.has(t.event_id)?'anywhere':householdRoles.has(t.participant_requirements.role)?'same_household':'same_location';
 return {...t,location_scope:scope,location_requirement:scope==='same_household'?'本人及相关家人必须同属一户并实际同地生活':scope==='same_location'?'面对面互动必须处于同一生活上下文':scope==='remote_only'?'双方异地，通过消息或传信联系':'无面对面要求；资源支持仍需通过现实条件检查'};
}
