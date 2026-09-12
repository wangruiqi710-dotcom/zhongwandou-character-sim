'use strict';
// node test-behavior-lab.cjs — 固定实验、共享引擎、健康检查和抽样；不读写存档。
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const elements=new Map();
const context=vm.createContext({console,structuredClone,setTimeout,Blob,crypto:require('node:crypto').webcrypto,
  document:{getElementById:id=>{if(!elements.has(id))elements.set(id,{value:'',dataset:{}});return elements.get(id);},
    querySelectorAll:()=>[],addEventListener:()=>{},body:{dataset:{}}},
  localStorage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}}});
const read=f=>fs.readFileSync(__dirname+'/'+f,'utf8');
vm.runInContext(['worlds.js','decisions.js','app.js'].map(read).join('\n'),context);
vm.runInContext(read('behavior_lab.js').split('// UI：')[0],context);
const run=s=>vm.runInContext(s,context);
(async()=>{
  const result=await run(`(async()=>{
    const check=(v,m)=>{if(!v)throw Error(m);};
    const settings={world:'modern',event:'music',template:'neutral',interest:'related'};
    let scans=0,peak=0;const weak=[],ranges={};
    const sampler=sampleAction;sampleAction=()=>{throw Error('scan must not sample');};
    for(const world of ['modern','ancient'])for(const event of Object.keys(LAB_EVENTS))for(const attr of LAB_ATTRIBUTES){
      const fixture=labFixture({...settings,world,event}),before=JSON.stringify(fixture);
      const rows=labScan(fixture,attr.id,5);scans++;
      peak=Math.max(peak,...rows.flatMap(r=>r.actions.map(a=>a.probability)));
      if(attr.id!=='goal')ranges[world+'/'+event+'/'+attr.id]=Math.max(...rows[0].actions.map((a,i)=>Math.abs(a.probability-rows.at(-1).actions[i].probability)));
      check(JSON.stringify(fixture)===before,'fixed fixture mutated');
      check(rows.length===(attr.id==='goal'?4:21),'scan points');
      check(rows.every(r=>r.actions.reduce((s,a)=>s+a.probability_units,0)===1000),'sum100');
      check(rows.every(r=>r.actions.every(a=>a.modifiers.random===0)),'noise off');
      check(rows.every(r=>r.actions.every(a=>a.probability<=85)),'dominance');
      check(labHealth(rows,attr.id).filter(c=>/固定|异常跳变|相邻变化/.test(c.text)).every(c=>c.ok),'fixed actions and smooth');
      if(labHealth(rows,attr.id).some(c=>!c.ok&&c.text.startsWith('属性影响可能过弱')))weak.push(world+'/'+event+'/'+attr.name);
      const manual=calculateActionProbabilities(fixture.character,fixture.event,fixture.filtered.actions,fixture.context,()=>.5);
      if(attr.id!=='goal')check(JSON.stringify(rows.find(r=>r.value===50).actions)===JSON.stringify(manual),'shared engine parity');
    }
    sampleAction=sampler;
    const music=labFixture(settings),planning=labScan(music,'personality:计划性'),interest=labScan(music,'interest');
    const participation=r=>r.actions.filter(a=>a.action_tags.includes('participate')).reduce((s,a)=>s+a.probability,0);
    check(planning.at(-1).actions.find(a=>a.action_id==='confirm').probability>planning[0].actions.find(a=>a.action_id==='confirm').probability,'planning raises confirmation');
    check(participation(interest.at(-1))>participation(interest[0]),'interest raises participation');
    const social=labScan(labFixture({...settings,event:'social'}),'personality:外向性');
    check(participation(social.at(-1))>participation(social[0]),'extroversion');
    check(social[0].actions.some(a=>a.action_tags.includes('participate')&&a.probability>0)&&social.at(-1).actions.find(a=>a.action_id==='decline').probability>0,'both choices possible');
    const safety=labScan(labFixture({...settings,event:'safety',interest:'音乐'}),'interest');
    check(JSON.stringify(safety[0].actions)===JSON.stringify(safety.at(-1).actions),'music unrelated');
    const long=labScan(labFixture({...settings,event:'relocation'}),'personality:计划性');
    const span=rows=>Math.max(...rows[0].actions.map((a,i)=>Math.abs(a.probability-rows.at(-1).actions[i].probability)));
    check(span(long)>span(planning),'long effect larger');
    check(long[0].actions[0].random_amplitude<planning[0].actions[0].random_amplitude,'long noise lower');
    const before=JSON.stringify(planning),preview=labPoint(music,'personality:计划性',50,decisionRng(42));
    check(preview.actions.some(a=>a.modifiers.random!==0)&&JSON.stringify(planning)===before,'preview independent');
    const actions=labPoint(music,'interest',50).actions,counts=await labSample(actions,10000,decisionRng(20260913));
    check(Object.values(counts).reduce((a,b)=>a+b,0)===10000,'sample count');
    check(actions.every(a=>Math.abs(counts[a.action_id]/100-a.probability)<2),'sample frequencies within2pp');
    check(await labSample(actions,10000,Math.random,()=>{},()=>true)===null,'cancel batches');
    const broken=clone(planning);broken[1].actions[0].probability=99;
    check(labHealth(broken,'personality:计划性').some(c=>!c.ok&&c.text.includes('支配')),'dominance warning');
    check(labHealth(broken,'personality:计划性').some(c=>!c.ok&&c.text.includes('相邻')),'jump warning');
    const examples=rows=>rows.filter(r=>[0,50,100].includes(r.value)).map(r=>({value:r.value,probabilities:r.actions.map(a=>a.probability)}));
    return {scans,peak,planning:examples(planning),interest:examples(interest),counts,theory:actions.map(a=>({id:a.action_id,p:a.probability})),
      weakScanCount:weak.length,ranges:Object.fromEntries(Object.entries(ranges).filter(([k])=>k.startsWith('modern/')&&(/learning.*talents|relocation.*计划性|social.*外向性/.test(k)))),
      planningHealth:labHealth(planning,'personality:计划性')};
  })()`);
  assert.doesNotMatch(read('behavior_lab.js'),/\bfetch\s*\(|XMLHttpRequest|WebSocket|localStorage\.|localhost|127\.0\.0\.1|8765/);
  console.log(JSON.stringify(result,null,2));
  console.log('PASS: 154 scans, shared engine parity, fixed options, no noise/sampling during scans, goals, both worlds, health warnings, sampling10000 and cancellation.');
})().catch(e=>{console.error(e);process.exitCode=1;});
