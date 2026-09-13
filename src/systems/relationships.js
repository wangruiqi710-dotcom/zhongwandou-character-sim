import {bound} from '../core/rng.js';
export const relationKey=(a,b)=>[a,b].sort().join(':');
export function relationship(s,a,b){const key=relationKey(a,b);return s.relationships[key]??(s.relationships[key]={id:key,people:[a,b],strength:20,attitude:0,source:'MOCK_ONLY',history:[]});}
export function changeRelationship(s,a,b,delta,reason){const r=relationship(s,a,b);const before=r.attitude;r.attitude=bound(r.attitude+delta,-100,100);r.strength=bound(r.strength+Math.abs(delta)*.1);r.history.push({month:s.current_world_month,before,after:r.attitude,reason});return r;}
