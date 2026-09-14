const fs=require('node:fs'),assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const context=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.setDefaultTimeout(10000);
 await page.goto(process.env.TEST_URL||'http://127.0.0.1:8877/');await page.getByText('已读取 0个运行').waitFor();
 await page.locator('#new-life').click();await page.locator('#summary h3').waitFor();await page.locator('[data-months="1"]').click();await page.getByText('已逐月运行 1个月',{exact:true}).waitFor();
 // Open only the ordinary-month group and plain-language explanation.
 for(const d of await page.locator('#timeline details').all()){const txt=await d.locator('summary').first().textContent();if(txt.includes('普通月份'))await d.locator('summary').first().click();}
 await page.locator('#timeline summary').filter({hasText:/^查看原因$/}).first().click();
 assert.equal(await page.locator('#timeline pre:visible').count(),0);
 await page.locator('[data-rate="合理"]').last().click();await page.getByText('已保存“合理”及完整现场').waitFor();
 await page.locator('[data-rate="问题"]').last().click();await page.locator('#issue-type').selectOption({label:'现实条件判断有问题'});await page.locator('#save-issue').click();
 await page.reload();await page.getByText('已读取 1个运行 / 2条反馈').waitFor();
 for(const width of [375,390,430]){await page.setViewportSize({width,height:844});for(const nav of ['simulation','tests','behavior','genetics','feedback','settings']){await page.locator('nav [data-page="'+nav+'"]').click();if(nav==='genetics')await page.locator('#gen-run').click();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'overflow '+width+'/'+nav);}console.log('mobile width '+width+' passed');}
 await page.locator('nav [data-page="simulation"]').click();await page.locator('#summary [data-person]').first().click();await page.getByText('正在查看家庭或关系人物').waitFor();await page.locator('[data-return-person]').click();
 await page.locator('nav [data-page="behavior"]').click();await page.locator('#lab-count').selectOption('10000');await page.locator('#lab-sample').click();await page.locator('#lab-samples table').waitFor();
 await page.locator('nav [data-page="feedback"]').click();await page.locator('[data-replay]').first().click();await page.getByText('重放结果与保存现场一致').waitFor();
 const dl=page.waitForEvent('download');await page.locator('#export-all').click();const download=await dl,bytes=fs.readFileSync(await download.path());const exported=JSON.parse(bytes);assert.equal(exported.schema_version,3);
 await page.locator('#import').setInputFiles({name:'saved.json',mimeType:'application/json',buffer:bytes});await page.getByText('导入完成，相同ID已去重').waitFor();assert.equal(await page.locator('[data-replay]').count(),2);
 async function start(id){await page.locator('nav [data-page="tests"]').click();await page.locator('#case').selectOption(id);await page.locator('#run-case').click();await page.locator('#choice-dialog[open]').waitFor();}
 await start('PLAYER-MARRIAGE-01');assert((await page.locator('#choice-dialog [data-person]').count())>=2);
 await page.locator('#choice-dialog [data-person]').first().click();await page.locator('[data-return-person]').click();
 assert(await page.locator('#auto').isDisabled());assert(await page.locator('[data-months="1"]').isDisabled());
 await page.locator('#pending [data-player-option="skip"]').click();await page.waitForFunction(()=>!document.querySelector('#auto').disabled);
 await start('PLAYER-RESOURCE-01');assert(await page.locator('[data-months="60"]').isDisabled());await page.reload();await page.locator('#choice-dialog[open]').waitFor();await page.locator('#choice-dialog [data-player-option="share"]').click();
 await start('PLAYER-SUCCESSION-01');assert.equal(await page.locator('#choice-dialog [data-player-option]').count(),2);await page.locator('#choice-dialog [data-player-option]').first().click();await page.locator('#choice-dialog').getByText('主财产继承人',{exact:true}).waitFor();await page.locator('#choice-dialog [data-player-option]').last().click();await page.waitForFunction(()=>!document.querySelector('#auto').disabled);
 await page.locator('nav [data-page="tests"]').click();await page.locator('#seed').fill('31');await page.locator('#new-life').click();await page.locator('[data-months="120"]').click();await page.locator('#choice-dialog[open]').waitFor({timeout:30000});
 assert(await page.locator('#status').innerText().then(t=>t.includes('需要你的决定')));
 const waiting=await page.locator('#summary .badge').count();assert(await page.locator('#auto').isDisabled());await page.locator('#close-choice').click();
 await page.setViewportSize({width:375,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:process.env.TEMP+'/pea-v2-closure-mobile.png',fullPage:false});
 // A genuinely old shape remains inspectable and exportable without implicit migration.
 await page.locator('nav [data-page="feedback"]').click();const old=structuredClone(exported.runs[0]);old.run_id='archived-old-run';old.mock_version='2.0.0-alpha';old.schema_version=2;for(const s of [old.state,old.initial_state]){delete s.ongoing_situations;delete s.recent_history;delete s.player_decision_events;delete s.marriage_proposal_history;delete s.config.event_cooldown;}await page.locator('#import').setInputFiles({name:'old.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({schema_version:2,feedback:[],runs:[old]}))});await page.getByText('导入完成，相同ID已去重').waitFor();await page.locator('nav [data-page="simulation"]').click();await page.locator('#run-select').selectOption('archived-old-run');await page.getByText('旧版本运行，只读保留').waitFor();assert(await page.locator('#auto').isDisabled());
 assert.deepEqual(errors,[]);console.log('PASS: plain explanation/no visible JSON, person navigation, persistent player pause, resource choice, succession/estate, batch interrupt, feedback import/export/replay, labs, 375/390/430; no console errors');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
