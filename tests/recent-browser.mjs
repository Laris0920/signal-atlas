import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const root = process.env.TEST_URL || 'http://127.0.0.1:4395/';
const data = JSON.parse(await fs.readFile(new URL('../knowledge.json',import.meta.url),'utf8'));
const browser = await chromium.launch();
const page = await browser.newPage({viewport:{width:1440,height:1000}});
const results = [];
async function check(name,run) {
  try {await run();results.push({name,status:'passed'});console.log('PASS',name)}
  catch(error) {results.push({name,status:'failed',error:error.message});console.error('FAIL',name,error.message)}
}
async function choose(id) {
  await page.goto(root+'#event='+id);
  await page.waitForFunction(()=>document.querySelector('#stat-events').textContent==='30');
}
await check('默认最新档案与30/32/36统计、数据范围一致',async()=>{
  await page.goto(root);
  await page.waitForFunction(()=>document.querySelector('#stat-events').textContent==='30');
  assert.equal(await page.locator('#stat-evidence').innerText(),'32');
  assert.equal(await page.locator('#stat-versions').innerText(),'36');
  assert.match(await page.locator('.event-card').first().innerText(),/2026-10-27/);
  await page.locator('#show-method').click();
  assert.match(await page.locator('#dialog-body').innerText(),/16 条近期官方披露/);
  assert.match(await page.locator('#dialog-body').innerText(),/2026-09-24 至 2026-10-27/);
  await page.keyboard.press('Escape');
});
await check('16条新事件头卡、来源与计划状态准确且可分享直达',async()=>{
  for (const id of data.recentBatch.eventIds) {
    await choose(id);
    const event = data.events.find(item=>item.id===id);
    const version = event.versions[0];
    const source = data.sources.find(item=>item.id===version.sourceIds[0]);
    assert.equal(await page.locator('#event-title').innerText(),event.title);
    assert.equal(await page.locator('#status-chip').innerText(),version.state==='planned'?'计划阶段':'已披露');
    assert.equal(await page.locator('#brief-citations a').getAttribute('href'),source.url);
    assert.match(await page.locator('#brief-grid').innerText(),new RegExp(version.unknown.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
    assert.equal(await page.locator('#version-range').isDisabled(),true);
  }
});
await check('手机逐条查看近期档案不出现页面横向溢出',async()=>{
  await page.setViewportSize({width:320,height:900});
  for (const id of data.recentBatch.eventIds) {
    await choose(id);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,id);
  }
  await choose('apple-m6-macbook');
  await page.screenshot({path:new URL('../test-results/recent-mobile.png',import.meta.url).pathname,fullPage:true});
});
await check('新事件长出处能生成PNG护照并保留边界',async()=>{
  await page.setViewportSize({width:1440,height:1000});
  await choose('fed-amex-aml');
  await page.locator('#passport-btn').click();
  await page.waitForFunction(()=>document.querySelector('.passport-preview')?.naturalWidth===1200);
  assert.equal(await page.locator('#passport-download').getAttribute('download'),'fed-amex-aml-v1.png');
  await page.keyboard.press('Escape');
  await choose('apple-m6-macbook');
  await page.screenshot({path:new URL('../test-results/recent-desktop.png',import.meta.url).pathname,fullPage:true});
});
await fs.writeFile(new URL('../test-results/recent-browser-report.json',import.meta.url),JSON.stringify(results,null,2));
await browser.close();
if(results.some(result=>result.status==='failed'))process.exitCode=1;
