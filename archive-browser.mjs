import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const base = process.env.TEST_URL || 'http://127.0.0.1:4394/';
const browser = await chromium.launch();
const context = await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
const page = await context.newPage();
const results = [];
async function check(name, run) {
  try {await run();results.push({name,status:'passed'});console.log('PASS',name)}
  catch(error) {results.push({name,status:'failed',error:error.message});console.error('FAIL',name,error.message)}
}
await page.goto(base+'#event=nvidia-arm');
await page.waitForFunction(()=>document.querySelector('#stat-events').textContent==='30');
await check('小羊英雄素材可达、可解码且压缩到100KB以内',async()=>{
  const response = await page.request.get(new URL('assets/archive-hero.webp',base).href);
  assert.equal(response.status(),200);
  assert.match(response.headers()['content-type'],/image\/webp/);
  assert.ok((await response.body()).length<100000);
  assert.match(await page.locator('.hero-stage').evaluate(element=>getComputedStyle(element).backgroundImage),/archive-hero.webp/);
});
await check('纸面全局底色、深靛头卡与纸面搜索层一致',async()=>{
  assert.equal(await page.locator('body').evaluate(element=>getComputedStyle(element).backgroundColor),'rgb(222, 216, 205)');
  assert.equal(await page.locator('.brief-panel').evaluate(element=>getComputedStyle(element).backgroundColor),'rgb(16, 33, 57)');
  assert.equal(await page.locator('.brief-grid h4').first().evaluate(element=>getComputedStyle(element).color),'rgb(245, 240, 229)');
  assert.equal(await page.locator('#search-form').evaluate(element=>getComputedStyle(element).backgroundColor),'rgb(248, 245, 237)');
  await page.screenshot({path:new URL('../test-results/archive-cover.png',import.meta.url).pathname});
  await page.locator('#brief-heading').scrollIntoViewIfNeeded();
  await page.screenshot({path:new URL('../test-results/archive-detail.png',import.meta.url).pathname});
});
await check('主要按钮与选择控件至少44px高',async()=>{
  for (const selector of ['#share-btn','#passport-btn','#theme-btn','#clear-filters','#category-filter','#graph-map-btn','#prev-version']) {
    assert.ok((await page.locator(selector).boundingBox()).height>=44,selector);
  }
});
await check('手机对照上下排列且320px无横向溢出',async()=>{
  await page.setViewportSize({width:320,height:900});
  const pair=page.locator('.comparison-pair').first();
  const before=await pair.locator('p').first().boundingBox();
  const after=await pair.locator('p').last().boundingBox();
  assert.ok(after.y>=before.y+before.height);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:new URL('../test-results/archive-mobile.png',import.meta.url).pathname});
});
await check('明亮阅读主题保留统一深靛导航与纸面阅读',async()=>{
  await page.locator('#theme-btn').click();
  assert.equal(await page.locator('body').evaluate(element=>getComputedStyle(element).backgroundColor),'rgb(244, 241, 232)');
  assert.equal(await page.locator('.brief-panel').evaluate(element=>getComputedStyle(element).backgroundColor),'rgb(16, 33, 57)');
  await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:new URL('../test-results/archive-light.png',import.meta.url).pathname});
});
await fs.writeFile(new URL('../test-results/archive-report.json',import.meta.url),JSON.stringify(results,null,2));
await browser.close();
if(results.some(result=>result.status==='failed'))process.exitCode=1;
