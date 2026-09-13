// Mulberry32, shared state persisted in every run. No ambient randomness.
export function random(s){s.rng_state=(s.rng_state+0x6d2b79f5)>>>0;let t=Math.imul(s.rng_state^(s.rng_state>>>15),s.rng_state|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;}
export const pick=(s,a)=>a[Math.floor(random(s)*a.length)];
export const integer=(s,a,b)=>a+Math.floor(random(s)*(b-a+1));
export function weighted(s,weights){let r=random(s)*weights.reduce((a,b)=>a+b,0);for(let i=0;i<weights.length;i++){r-=weights[i];if(r<0)return i;}return weights.length-1;}
export const id=(s,prefix)=>prefix+'-'+(++s.next_id);
export const bound=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));
