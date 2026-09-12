'use strict';

// 固定实验夹具，不是主模拟器事件库；所有概率由 decisions.js 计算。
const LAB_EVENTS = {
  music:{name:'普通兴趣：音乐活动',category:'社交',modern:'朋友邀请参加一场音乐活动。',ancient:'朋友邀请参加一场听曲与演奏活动。'},
  social:{name:'普通社交：陌生聚会',category:'社交',modern:'有人邀请参加一个陌生人的社交聚会。',ancient:'熟人引介参加一次多为陌生人的人情往来聚会。'},
  learning:{name:'短期学习：试学机会',category:'学习',modern:'附近提供一次短期手工试学机会。',ancient:'邻近作坊提供一次短期手工试学机会。'},
  career:{name:'长期职业：发展机会',category:'工作机会',modern:'获得一个需要长期职业训练的发展机会，条件已经核实。',ancient:'获得一个需要长期学徒训练的发展机会，条件已经核实。'},
  relocation:{name:'长期迁居：离乡三年',category:'工作机会',modern:'获得需要长期离乡三年工作的机会，契约条件已经核实。',ancient:'获得需要长期离乡三年担任学徒的机会，契约条件已经核实。'},
  safety:{name:'治安：道路消息',category:'治安问题',modern:'听说某条道路近期不太安全，需要核实出行路线。',ancient:'听说某条道路近期不太安全，需要核实出行路线。'},
  emergency:{name:'紧急：立即避险',category:'紧急事件',modern:'突发失火，正在遇险，需要立即避开危险并呼救。',ancient:'突发失火，正在遇险，需要立即避开危险并呼救。'}
};
const LAB_ATTRIBUTES = [
  ...PERSONALITY.map(name=>({id:'personality:'+name,name:'性格 · '+name})),
  ...TALENTS.map(name=>({id:'talents:'+name,name:'天赋 · '+name})),
  {id:'interest',name:'兴趣 · 指定领域强度'},{id:'goal',name:'人生目标 · 四类别对比'}
];
const LAB_PRESETS = {
  planning:{name:'计划性测试',event:'music',attribute:'personality:计划性'},
  interest:{name:'兴趣测试',event:'music',attribute:'interest'},
  outgoing:{name:'外向测试',event:'social',attribute:'personality:外向性'},
  unrelated:{name:'无关性测试',event:'safety',attribute:'interest',interest:'音乐'},
  longterm:{name:'长期决定测试',event:'relocation',attribute:'personality:计划性'}
};
const LAB_CHECKS = {dominance:85,weak:3,jumpPerTen:5};
function labFixture(settings) {
  const spec=LAB_EVENTS[settings.event],world=settings.world;
  const event={title:spec.name,description:spec[world],category:spec.category,world_id:world,
    is_temporary_ai_event:true,minimum_age:18,maximum_age:120,conditions:{contract_terms_known:true}};
  const profile=describeDecisionEvent(event,world);
  const domain=settings.interest==='音乐'?'音乐':profile.domains[0]||'无匹配领域';
  const character={character_id:'lab-fixed',surname:'实验',given_name:'人物',gender:'男',birth_date:'1996-01-01',age:30,alive:true,
    simple_identity:world==='ancient'?'农户家庭成员':'工作',
    personality:Object.fromEntries(PERSONALITY.map(k=>[k,50])),talents:Object.fromEntries(TALENTS.map(k=>[k,50])),
    interests:[{name:domain,intensity:50,source:'temporary_ai'}],life_goal:null,skills:[],experiences:[]};
  if(settings.template==='outgoing'){character.personality['外向性']=80;character.life_goal='职业成就';}
  if(settings.template==='reserved'){character.personality['外向性']=20;character.life_goal='家庭生活';}
  const context=decisionContext(character,event,world);
  const generated=generateCandidateActions(event,context),filtered=filterFeasibleActions(generated,event,context);
  return {character,event,context,profile,generated,filtered,domain};
}
function labPoint(fixture,attribute,value,rng=()=>.5) {
  const person=clone(fixture.character);
  if(attribute==='goal')person.life_goal=value;
  else if(attribute==='interest')person.interests[0].intensity=Number(value);
  else {const [group,name]=attribute.split(':');person[group][name]=Number(value);}
  // .5 + .5 - 1 = 0：关闭扰动，保留正式温度与所有现实条件。
  const actions=calculateActionProbabilities(person,fixture.event,fixture.filtered.actions,fixture.context,rng);
  return {value,actions,excluded:fixture.filtered.excluded};
}
function labScan(fixture,attribute,step=10) {
  const values=attribute==='goal'?GOALS:Array.from({length:100/step+1},(_,i)=>i*step);
  return values.map(value=>labPoint(fixture,attribute,value));
}
function labHealth(rows,attribute) {
  const first=rows[0],last=rows.at(-1),checks=[];
  const add=(ok,text)=>checks.push({ok,text});
  add(rows.every(r=>r.actions.reduce((s,a)=>s+a.probability_units,0)===1000),'所有扫描点概率总和严格为100%');
  add(rows.every(r=>JSON.stringify(r.actions.map(a=>[a.action_id,a.action,a.traits]))===JSON.stringify(first.actions.map(a=>[a.action_id,a.action,a.traits]))),'候选行为及特征在整个扫描中保持固定');
  const peak=Math.max(...rows.flatMap(r=>r.actions.map(a=>a.probability)));
  add(peak<=LAB_CHECKS.dominance,peak>LAB_CHECKS.dominance?'单属性支配过强：最高概率'+peak+'%':'没有行为超过85%（最高'+peak+'%）');
  if(attribute!=='goal'){
    const span=Math.max(...first.actions.map((a,i)=>Math.abs(last.actions[i].probability-a.probability)));
    add(span>=LAB_CHECKS.weak,span<LAB_CHECKS.weak?'属性影响可能过弱：端点最大变化'+span.toFixed(1)+'个百分点；无关属性应如此':'端点最大变化'+span.toFixed(1)+'个百分点');
    let jump=0;
    for(let i=1;i<rows.length;i++)for(let j=0;j<first.actions.length;j++)jump=Math.max(jump,Math.abs(rows[i].actions[j].probability-rows[i-1].actions[j].probability)*10/(rows[i].value-rows[i-1].value));
    add(jump<=LAB_CHECKS.jumpPerTen,'相邻变化折算每10点最大'+jump.toFixed(2)+'个百分点（警戒线5；0.1%取整允许阶梯）');
  }
  if(attribute==='interest'){
    const related=first.actions.some(a=>a.matched_interest&&a.traits.interest_match>0);
    const group=r=>r.actions.filter(a=>a.action_tags.includes('participate')).reduce((s,a)=>s+a.probability,0);
    const delta=group(last)-group(first);
    add(related?delta>=3:first.actions.every((a,i)=>a.probability_units===last.actions[i].probability_units),
      related?'相关兴趣：参与类总概率增加'+delta.toFixed(1)+'个百分点（观察阈值3）':'无关兴趣：分布应完全不变');
  }
  if(attribute==='personality:计划性'&&first.actions.some(a=>a.action_id==='confirm')){
    const p=r=>r.actions.find(a=>a.action_id==='confirm').probability;
    add(rows.every((r,i)=>!i||p(r)>=p(rows[i-1])),'先确认时间的概率随计划性平滑不减');
  }
  return checks;
}
async function labSample(actions,count,rng=Math.random,onProgress=()=>{},cancelled=()=>false) {
  const counts=Object.fromEntries(actions.map(a=>[a.action_id,0]));
  for(let done=0;done<count;){
    if(cancelled())return null;
    const end=Math.min(done+250,count);
    for(;done<end;done++)counts[sampleAction(actions,rng()).action_id]++;
    onProgress(done);
    await new Promise(resolve=>setTimeout(resolve,0));
  }
  return counts;
}

// UI：实验设置与结果仅在内存中，不读写主模拟器存档。
const labEl=id=>document.getElementById('lab-'+id);
let labCurrent,labRows,labRevision=0,labNoise=false;
const LAB_COLORS=['#246b8c','#975b19','#6a5399','#a13e58','#397452'];
function labSettings(){return {world:labEl('world').value,event:labEl('event').value,template:labEl('template').value,attribute:labEl('attribute').value,interest:labEl('interest').value};}
function labTable(rows,attribute) {
  return '<table><thead><tr><th>'+esc(attribute==='goal'?'人生目标':'属性值')+'</th>'+rows[0].actions.map(a=>'<th>'+esc(a.action)+'</th>').join('')+'<th>合计</th></tr></thead><tbody>'+
    rows.map(r=>'<tr><th>'+esc(r.value)+'</th>'+r.actions.map(a=>'<td>'+a.probability.toFixed(1)+'%</td>').join('')+'<td>'+(r.actions.reduce((s,a)=>s+a.probability_units,0)/10).toFixed(1)+'%</td></tr>').join('')+'</tbody></table>';
}
function labChart(rows,attribute) {
  const categorical=attribute==='goal',x=i=>48+i/(rows.length-1)*550,y=p=>250-p*2.1;
  let svg='<svg viewBox="0 0 620 310" role="img" aria-label="候选行为概率曲线，数值见下方概率表"><text x="6" y="18">概率 %</text>';
  for(let p=0;p<=100;p+=20)svg+='<line x1="48" x2="598" y1="'+y(p)+'" y2="'+y(p)+'" stroke="#dce1d6"/><text x="8" y="'+(y(p)+4)+'">'+p+'</text>';
  rows.forEach((r,i)=>{if(categorical||r.value%20===0)svg+='<text text-anchor="middle" x="'+x(i)+'" y="274">'+esc(r.value)+'</text>';});
  rows[0].actions.forEach((a,j)=>{
    if(!categorical)svg+='<polyline fill="none" stroke="'+LAB_COLORS[j]+'" stroke-width="2.5" points="'+rows.map((r,i)=>x(i)+','+y(r.actions[j].probability)).join(' ')+'"/>';
    rows.forEach((r,i)=>{svg+='<circle cx="'+x(i)+'" cy="'+y(r.actions[j].probability)+'" r="3" fill="'+LAB_COLORS[j]+'"><title>'+esc(a.action+' / '+r.value+'：'+r.actions[j].probability+'%')+'</title></circle>';});
  });
  labEl('chart').innerHTML=svg+'<text x="305" y="302" text-anchor="middle">'+(categorical?'人生目标类别':esc(LAB_ATTRIBUTES.find(a=>a.id===attribute).name)+'（0–100）')+'</text></svg>';
  labEl('legend').innerHTML=rows[0].actions.map((a,i)=>'<p><span style="color:'+LAB_COLORS[i]+'">━━ '+(i+1)+'</span> '+esc(a.action)+'</p>').join('');
}
function labExplanation(attribute) {
  const p=labCurrent.profile;
  if(attribute==='interest')return '只扫描“'+labCurrent.domain+'”强度。匹配领域只增加参与权重，不生成选项；若本事件无匹配领域，修正为0。';
  if(attribute==='goal')return '只切换人生目标类别；保持0 / 0.2 / 1相关性门槛。没有明确长期关联的行为不获得目标修正。';
  const [group,name]=attribute.split(':');
  if(group==='talents')return name+'只在正式引擎识别出的学习或挑战参与行为中有限影响成功预期。未被本事件使用时，曲线应为水平线。';
  return ({外向性:'外向性越高，高社交暴露行为的相对权重越高；参加与拒绝仍都可能发生。',
    直觉性:'直觉性越高，高新颖度行为的相对权重越高，不改变选项。',
    思考性:'仅在资源/效率或关系维护权衡中生效；没有对应行为特征时为0。',
    计划性:p.emergency?'紧急事件中计划性修正为0；延误危险处置已被现实条件排除。':p.long_term?'长期决定中更重视准备，降低未准备的不确定承诺权重；影响仍有上限。':'普通短期活动中，准备与不确定性参与判断，但计划性影响受到限制。'})[name];
}
function labPointRender(){
  labRevision++;
  const attribute=labEl('attribute').value,value=attribute==='goal'?labEl('goal').value:Number(labEl('value').value);
  const point=labPoint(labCurrent,attribute,value);
  labEl('value-label').textContent=LAB_ATTRIBUTES.find(a=>a.id===attribute).name+'：'+value;
  labEl('explanation').textContent=labExplanation(attribute);
  labEl('point').innerHTML=point.actions.map(a=>'<p class="action-head"><span>'+esc(a.action)+'</span><strong class="probability">'+a.probability.toFixed(1)+'%</strong></p>').join('')+
    point.excluded.map(a=>'<p>'+esc(a.action)+'：0% · '+esc(a.exclusion_reason)+'</p>').join('');
  labEl('debug').textContent=JSON.stringify({event_stability:labCurrent.profile.event_decision_stability,actions:point.actions.map(a=>({
    action:a.action,base_weight:a.base_weight,feasibility:a.feasible,traits:a.traits,situational_modifier:a.modifiers.situational,
    personality_modifier:a.modifiers.personality,personality_dimensions:a.modifiers.personality_dimensions,
    interest_modifier:a.modifiers.interest,life_goal_modifier:a.modifiers.life_goal,goal_relevance:a.goal_relevance,
    talent_modifier:a.modifiers.talent,random_noise:a.modifiers.random,temperature:a.temperature,probability:a.probability
  })),excluded:point.excluded},null,2);
  labEl('samples').innerHTML='';labEl('progress').textContent='';labEl('sample').disabled=false;
  labEl('noise-result').hidden=!labNoise;
  if(labNoise)labEl('noise-result').innerHTML='<p>单次扰动演示（不改变上方曲线与抽样分布）</p><div class="lab-scroll">'+labTable([labPoint(labCurrent,attribute,value,Math.random)],attribute)+'</div>';
}
function labRender(){
  const settings=labSettings();labCurrent=labFixture(settings);labRows=labScan(labCurrent,settings.attribute,Number(labEl('step').value));
  labEl('event-description').textContent=(settings.world==='ancient'?'古代':'现代')+' · '+labCurrent.event.description;
  labEl('context').textContent=JSON.stringify({character:labCurrent.character,context:labCurrent.context},null,2);
  labEl('health').innerHTML=labHealth(labRows,settings.attribute).map(c=>'<li class="'+(c.ok?'':'lab-warning')+'">'+(c.ok?'通过：':'警告：')+esc(c.text)+'</li>').join('');
  labEl('table').innerHTML=labTable(labRows,settings.attribute);labChart(labRows,settings.attribute);
  labEl('value').hidden=labEl('value-label').hidden=settings.attribute==='goal';labEl('goal-label').hidden=settings.attribute!=='goal';
  labEl('interest').disabled=settings.attribute!=='interest';labPointRender();
}
function labInit(){
  labEl('event').innerHTML=Object.entries(LAB_EVENTS).map(([id,e])=>'<option value="'+id+'">'+e.name+'</option>').join('');
  labEl('attribute').innerHTML=LAB_ATTRIBUTES.map(a=>'<option value="'+a.id+'">'+a.name+'</option>').join('');
  labEl('goal').innerHTML=GOALS.map(g=>'<option>'+g+'</option>').join('');
  labEl('attribute').value='personality:计划性';
  labEl('presets').innerHTML=Object.entries(LAB_PRESETS).map(([id,p])=>'<button data-lab-preset="'+id+'">'+p.name+'</button>').join('');
  document.querySelectorAll('[data-lab-preset]').forEach(b=>b.onclick=()=>{
    const p=LAB_PRESETS[b.dataset.labPreset];labEl('event').value=p.event;labEl('attribute').value=p.attribute;
    labEl('template').value='neutral';labEl('interest').value=p.interest||'related';labEl('value').value=50;labRender();
  });
  ['world','event','template','attribute','step','interest'].forEach(id=>labEl(id).onchange=labRender);
  labEl('value').oninput=labPointRender;labEl('goal').onchange=labPointRender;
  labEl('count').onchange=()=>{labRevision++;labEl('samples').innerHTML='';labEl('progress').textContent='';labEl('sample').disabled=false;};
  labEl('noise').onclick=()=>{labNoise=!labNoise;labEl('noise').textContent=labNoise?'关闭随机扰动预览':'开启随机扰动预览';labPointRender();};
  labEl('sample').onclick=async()=>{
    const revision=++labRevision,attribute=labEl('attribute').value,value=attribute==='goal'?labEl('goal').value:Number(labEl('value').value);
    const point=labPoint(labCurrent,attribute,value),count=Number(labEl('count').value);
    labEl('sample').disabled=true;
    const counts=await labSample(point.actions,count,Math.random,done=>{labEl('progress').textContent=done+' / '+count;},()=>revision!==labRevision);
    if(!counts||revision!==labRevision)return;
    labEl('samples').innerHTML='<table><thead><tr><th>行为</th><th>理论概率</th><th>实际频率</th><th>次数</th></tr></thead><tbody>'+point.actions.map(a=>'<tr><th>'+esc(a.action)+'</th><td>'+a.probability.toFixed(1)+'%</td><td>'+(counts[a.action_id]/count*100).toFixed(2)+'%</td><td>'+counts[a.action_id]+'</td></tr>').join('')+'</tbody></table>';
    labEl('sample').disabled=false;
  };
  labRender();
  if(location.hash==='#behavior-lab')document.querySelector('[data-tab="behavior-lab"]').click();
}
labInit();
