import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const root = process.env.TEST_URL || 'http://127.0.0.1:4399/';
const data = JSON.parse(await fs.readFile(new URL('../knowledge.json',import.meta.url),'utf8'));
const source = data.sources.find(item => item.id === 'fed-dec');
const historical = structuredClone(data);
historical.events.find(event => event.id === 'fed-cycle').versions.pop();
historical.sources = historical.sources.filter(item => item.id !== source.id);
const browser = await chromium.launch();
const context = await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
const page = await context.newPage();
const results = [];
const errors = [];
page.on('pageerror',error => errors.push(error.message));
async function check(name,run) {
  try {await run();results.push({name,status:'passed'});console.log('PASS',name)}
  catch(error) {results.push({name,status:'failed',error:error.message});console.error('FAIL',name,error.message)}
  finally {await page.locator('dialog').evaluate(dialog => dialog.close()).catch(()=>{})}
}
async function ready(fixture=data) {
  await page.unroute('**/knowledge.json');
  await page.route('**/knowledge.json',route => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(fixture)}));
  await page.goto('about:blank');
  await page.goto(root + '#event=fed-cycle');
  await page.waitForFunction(()=>document.querySelector('#stat-events').textContent === '30');
}
async function input(material={}) {
  await page.locator('#intake-nav').click();
  for (const [field,value] of Object.entries({title:'Fed ' + source.title,publisher:source.publisher,date:source.publishedAt,url:source.url,body:source.summary,...material})) {
    await page.locator('#intake-' + field).fill(value);
  }
  await page.locator('#intake-form button[type="submit"]').click();
  await page.locator('#intake-result').waitFor({state:'visible'});
}
await check('Fed新增材料→归并分类→追加V3→关注者未读通知→已读',async()=>{
  await ready(historical);
  await page.evaluate(()=>{localStorage.clear()});
  await page.reload();
  await page.locator('#watch-btn').click();
  await input();
  assert.match(await page.locator('#intake-result').innerText(),/美联储 2024/);
  assert.match(await page.locator('#intake-result').innerText(),/事实/);
  await page.locator('[data-action="intake-apply"]').click();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#version-select option').count(),3);
  assert.match(await page.locator('#summary-text').innerText(),/4.25%/);
  await page.locator('#watch-nav').click();
  assert.match(await page.locator('#dialog-body').innerText(),/未读材料更新/);
  assert.match(await page.locator('#dialog-body').innerText(),/已披露 → 已披露/);
  assert.match(await page.locator('#dialog-body').innerText(),/Federal Reserve/);
  await page.locator('[data-action="read-notifications"]').click();
  assert.equal(await page.locator('.activity-item.unread').count(),0);
});
await check('已存在官方URL不重复写入版本',async()=>{
  await ready();await input();
  assert.match(await page.locator('#intake-result').innerText(),/重复材料/);
  assert.equal(await page.locator('[data-action="intake-apply"]').count(),0);
});
await check('传闻只进入复核，不改变Fed结论',async()=>{
  await ready();
  await input({title:'匿名消息称 Fed 或将降息',date:'2024-12-19',url:'https://example.com/test-only-fed-rumor',body:'匿名消息称 Fed 下月或将降息，未经证实。'});
  assert.match(await page.locator('#intake-result').innerText(),/传闻/);
  await page.locator('[data-action="intake-apply"]').click();
  assert.match(await page.locator('#intake-result').innerText(),/人工复核队列/);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#version-select option').count(),3);
  assert.match(await page.locator('#summary-text').innerText(),/4.25%/);
});
await check('推测不升级为事实版本',async()=>{
  await ready();
  await input({title:'Fed 利率路径预测',date:'2024-12-19',url:'https://example.com/test-only-fed-inference',body:'预计 Fed 下月可能调整利率，这是推测。'});
  assert.match(await page.locator('#intake-result').innerText(),/推测/);
  await page.locator('[data-action="intake-apply"]').click();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#version-select option').count(),3);
});
await check('更正关键词触发冲突提示但不覆盖历史',async()=>{
  await ready();
  await input({title:'Fed 更正材料（合成测试）',date:'2024-12-19',url:'https://example.com/test-only-fed-correction',body:'Fed 更正先前利率表述，本条仅为自动测试。'});
  assert.match(await page.locator('#intake-result').innerText(),/更正\/澄清/);
  assert.match(await page.locator('#intake-result').innerText(),/不能覆盖旧版本/);
});
await check('早于当前版本的材料停止写入',async()=>{
  await ready();
  await input({date:'2024-09-17',url:'https://example.com/test-only-old-fed'});
  await page.locator('[data-action="intake-apply"]').click();
  assert.match(await page.locator('#toast').innerText(),/停止写入/);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#version-select option').count(),3);
});
await check('未命中事件建立待分类档案，刷新恢复静态基线',async()=>{
  await ready();
  await input({title:'QuartzBeaconProtocol2026',publisher:'SyntheticTest',date:'2024-12-19',url:'https://example.com/test-only-new-event',body:'UniqueArtifactSyntheticText，仅用于隔离测试，不是实际投资材料。'});
  assert.match(await page.locator('#intake-result').innerText(),/未命中现有事件/);
  await page.locator('[data-action="intake-apply"]').click();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#stat-events').innerText(),'31');
  await ready();
  assert.equal(await page.locator('#stat-events').innerText(),'30');
});
await check('非HTTPS被拒绝，窄屏材料弹窗不横向溢出',async()=>{
  await ready();await page.setViewportSize({width:320,height:900});
  await input({url:'http://example.com/test-only-unsafe'});
  assert.match(await page.locator('#intake-result').innerText(),/HTTPS/);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const box = await page.locator('dialog').boundingBox();
  assert.ok(box.x>=0 && box.x+box.width<=320);
});
await check('无脚本异常',async()=>assert.deepEqual(errors,[]));
await fs.mkdir(new URL('../test-results/',import.meta.url),{recursive:true});
await fs.writeFile(new URL('../test-results/intake-report.json',import.meta.url),JSON.stringify({checkedAt:new Date().toISOString(),target:root,fixture:'隔离请求注入，不修改真实数据',results},null,2));
await browser.close();
if(results.some(result=>result.status === 'failed')) process.exitCode=1;
