const assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
 await page.goto(process.env.TEST_URL||'http://127.0.0.1:8877/');await page.getByText('已读取 0个运行').waitFor();
 const saved=await page.evaluate(async()=>{
  const {fixture}=await import('./src/testing/test_cases.js'),{newRun,step}=await import('./src/testing/run.js'),{pendingDecision,playerChoices}=await import('./src/systems/player_decisions.js'),{saveWorkspace}=await import('./src/testing/feedback_store.js');
  const r=newRun(fixture({seed:31}),'life','mobile-66-months');let clicks=0;
  const resolve=()=>{for(let p;(p=pendingDecision(r.state));){if(++clicks>200)throw Error('unbounded test policy');const options=playerChoices(r.state,p).filter(o=>o.feasible),choice=options.find(o=>o.id==='respect')||options.find(o=>o.target_id)||options.find(o=>o.id==='support')||options.find(o=>o.id==='skip')||options[0];step(r,{type:'player_choice',event_id:p.id,option_id:choice.id});}};
  for(let i=0;i<66;i++){resolve();step(r,{type:'month'});}resolve();
  await saveWorkspace({runs:[r],active_run:r.run_id,feedback:[]});return {months:66,player_inputs:clicks,records:r.state.history.length,people:Object.keys(r.state.characters).length};
 });
 await page.reload();await page.locator('.person-summary>h3').waitFor();assert.equal(await page.locator('body').getAttribute('data-density'),'compact');
 const measurements=[];
 for(const width of [375,390,430]){
  await page.setViewportSize({width,height:844});
  assert.equal(await page.locator('.full-person[open]').count(),0);assert.equal(await page.locator('#timeline pre:visible').count(),0);
  assert.equal(await page.locator('.timeline-node[open]').count(),0);assert(await page.locator('.month-run').count()>0);
  const years=await page.locator('.timeline-year').evaluateAll(es=>es.map(e=>({year:e.dataset.year,open:e.open})));assert(years.length>=6);assert.equal(years.filter(e=>e.open).length,1);assert.equal(years[0].open,true);
  const nav=(await page.locator('nav').boundingBox()).height,person=(await page.locator('.person-summary').boundingBox()).height;
  assert(nav<=60,'single row nav');assert(person<180,'short person card');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'root overflow');
  await page.locator('#timeline').scrollIntoViewIfNeeded();
  const nodes=await page.locator('.timeline-year[open]>.timeline-node>summary,.timeline-year[open]>.month-run>summary').evaluateAll(es=>es.slice(0,5).map(e=>e.getBoundingClientRect().height));
  assert(nodes.length>=3);assert(nodes.slice(0,3).reduce((a,b)=>a+b,0)<450,'recent three nodes fit');
  const footer=await page.locator('.fixed-controls').boundingBox();assert(footer.y+footer.height<=845);assert(footer.height<90);
  measurements.push({width,nav_height:nav,person_height:person,first_three_nodes_height:Math.round(nodes.slice(0,3).reduce((a,b)=>a+b,0)),overflow:false,old_years_collapsed:years.length-1});
  await page.screenshot({path:process.env.TEMP+'/pea-compact-'+width+'.png'});
 }
 // Details, feedback, NPC and saved density remain available through real clicks.
 const first=page.locator('.timeline-year[open]>.timeline-node').first();await first.locator(':scope>summary').click();await first.locator('.feedback-tools>summary').click();await first.locator('[data-rate="合理"]').click();await page.getByText('已保存“合理”及完整现场').waitFor();
 await page.locator('.full-person>summary').click();await page.locator('#summary [data-person]').first().click();assert.equal(await page.locator('.full-person[open]').count(),0);await page.getByText('查看完整人物',{exact:true}).click();await page.locator('[data-return-person]').first().click();
 await page.locator('nav [data-page="settings"]').click();await page.locator('#timeline-density').selectOption('comfortable');await page.reload();assert.equal(await page.locator('body').getAttribute('data-density'),'comfortable');await page.locator('nav [data-page="settings"]').click();await page.locator('#timeline-density').selectOption('compact');
 async function start(id){await page.locator('nav [data-page="tests"]').click();await page.locator('#case').selectOption(id);await page.locator('#run-case').click();await page.locator('#choice-dialog[open]').waitFor();}
 const snapshot=()=>page.evaluate(async()=>{const {readWorkspace}=await import('./src/testing/feedback_store.js');const w=await readWorkspace(),r=w.runs.find(x=>x.run_id===w.active_run);return {month:r.state.current_world_month,choices:r.state.history.filter(e=>e.kind==='player_choice').length,resources:r.state.resources,marriages:r.state.marriages,rng:r.state.rng_state,pending:r.state.player_decision_events.filter(e=>e.status==='pending').map(e=>e.id)};});
 await start('PLAYER-MARRIAGE-01');const before=await snapshot();assert.equal(before.choices,0);assert.equal(await page.locator('#choice-dialog .choice-layers').count(),0);
 for(const width of [375,390,430]){await page.setViewportSize({width,height:844});const buttons=page.locator('#choice-dialog [data-player-option]');assert(await buttons.count()>=4);for(const button of await buttons.all()){const box=await button.boundingBox();assert(box.height>=44);assert(box.width>width*.65);}assert(await page.locator('#auto').isDisabled());assert(await page.locator('#continue-life').isDisabled());assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 await page.waitForTimeout(300);assert.deepEqual(await snapshot(),before);
 await page.locator('#choice-dialog [data-player-option]').first().click();await page.waitForFunction(()=>document.querySelectorAll('.timeline-node').length>0);const after=await snapshot();assert.equal(after.choices,1);assert.equal(after.month,before.month);
 if(await page.locator('#choice-dialog[open]').count())await page.locator('#close-choice').click();
 const result=page.locator('.timeline-node').first();assert.equal(await result.getAttribute('open'),null);await result.locator(':scope>summary').click();for(const label of ['你的决定','人物反应','最终结果'])assert((await result.innerText()).includes(label));
 // Exercise the actual automatic-run button with deterministic guaranteed opportunity test setup.
 await page.evaluate(async()=>{const {fixture}=await import('./src/testing/test_cases.js'),{newRun}=await import('./src/testing/run.js'),{saveWorkspace}=await import('./src/testing/feedback_store.js');const s=fixture({seed:31});s.config.marriage_opportunity_frequency=1;s.config.decision_event_frequency=1;const r=newRun(s);await saveWorkspace({runs:[r],active_run:r.run_id,feedback:[]});});
 await page.reload();await page.locator('.person-summary').waitFor();await page.locator('#run-options>summary').click();await page.locator('#play-style').selectOption('batch');await page.locator('#auto').click();await page.locator('#choice-dialog[open]').waitFor();const stopped=await snapshot();assert.equal(stopped.choices,0);assert(stopped.pending.length>0);await page.waitForTimeout(600);assert.deepEqual(await snapshot(),stopped);assert((await page.locator('#status').innerText()).includes('时间已暂停'));
 assert.deepEqual(errors,[]);console.log(JSON.stringify({saved,measurements,passed:['TEST-PLAYER-UI-01 real buttons and delayed writeback','TEST-PLAYER-NO-AUTO-01 real auto loop pauses without input','marriage result layers collapse','folded detail/feedback/NPC remain usable','density persists','66 months real saved run, 375/390/430'],errors},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
