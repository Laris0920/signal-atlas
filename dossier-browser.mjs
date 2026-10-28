import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const root = process.env.TEST_URL || 'http://127.0.0.1:4391/';
const browser = await chromium.launch({headless:true});
const context = await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
const page = await context.newPage();
const results = [];
const errors = [];
const artifacts = new URL('../test-results/',import.meta.url);
await fs.mkdir(artifacts,{recursive:true});
page.on('pageerror',error => errors.push(error.message));
async function check(name, run) {
  try {await run();results.push({name,status:'passed'});console.log('PASS',name)}
  catch(error) {results.push({name,status:'failed',error:error.message});console.error('FAIL',name,error.message)}
  finally {await page.locator('#detail-dialog').evaluate(dialog => dialog.close()).catch(()=>{})}
}
async function choose(id) {
  await page.goto(root + '#event=' + id);
  await page.waitForFunction(()=>document.querySelector('#stat-events').textContent === '30');
}
async function slide(index) {
  await page.locator('#version-range').evaluate((range,value) => {range.value=value;range.dispatchEvent(new Event('input',{bubbles:true}))},index);
}
await check('30秒头卡有事实、解读、边界与可点击出处',async()=>{
  await choose('nvidia-arm');
  assert.equal(await page.locator('#brief-grid article').count(),3);
  assert.match(await page.locator('#brief-grid').innerText(),/产品解读/);
  assert.match(await page.locator('#brief-citations a').getAttribute('href'),/termination/);
});
await check('时间滑轨同步结论、星图、对照且首版不泄漏终止信息',async()=>{
  await slide(0);
  assert.equal(await page.locator('#status-chip').textContent(),'计划阶段');
  assert.match(await page.locator('#range-caption').textContent(),/V1/);
  assert.equal(await page.locator('.version-node').count(),1);
  assert.equal(await page.locator('.source-node').count(),1);
  assert.equal(await page.locator('#brief-grid').innerText().then(text=>text.includes('终止')),false);
  assert.match(await page.locator('#comparison-body').innerText(),/暂无前版/);
});
await check('滑轨支持键盘，日期标记与原下拉同步',async()=>{
  await page.locator('#version-range').focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('#version-select').inputValue(),'1');
  assert.equal(await page.locator('#status-chip').textContent(),'已终止');
  await page.locator('#rail-stops [data-replay="0"]').click();
  assert.equal(await page.locator('#version-range').inputValue(),'0');
});
await check('版本对照准确显示新增原文、状态变化和文字高亮',async()=>{
  await slide(1);
  assert.match(await page.locator('.comparison-banner').innerText(),/计划阶段 → 已终止/);
  assert.equal(await page.locator('.comparison-row').count(),4);
  assert.ok(await page.locator('.comparison-pair mark').count()>0);
  assert.equal(await page.locator('.comparison-reason a').count(),1);
  assert.match(await page.locator('.comparison-reason').innerText(),/使原交易计划失效/);
});
await check('基准可选择任意更早版本，不可越过当前时点',async()=>{
  await choose('fed-cycle');
  assert.equal(await page.locator('#compare-select option').count(),2);
  await page.locator('#compare-select').selectOption('0');
  assert.equal(await page.locator('.comparison-reason a').count(),2);
  await slide(1);
  assert.equal(await page.locator('#compare-select option').count(),1);
  assert.equal(await page.locator('.comparison-reason a').count(),1);
});
await check('星图连接与真实引用一致，节点能查看官方来源',async()=>{
  await slide(2);
  await page.locator('#graph-map-btn').click();
  await page.waitForFunction(()=>document.querySelectorAll('#graph-lines path').length===3);
  await page.locator('.source-node').first().click();
  assert.match(await page.locator('#dialog-body').innerText(),/支持 V1/);
  assert.match(await page.locator('#dialog-body a').getAttribute('href'),/^https:\/\/www.federalreserve.gov\//);
});
await check('星图节点切换版本，列表提供同样的出处',async()=>{
  await page.locator('.version-node[data-replay="0"]').click();
  assert.equal(await page.locator('.source-node').count(),1);
  await page.locator('#graph-list-btn').click();
  assert.equal(await page.locator('#graph-list').isVisible(),true);
  assert.equal(await page.locator('#graph-list a').count(),1);
});
await check('单版本禁用滑轨且显示真实无对照状态',async()=>{
  await choose('nv-q2-results');
  assert.equal(await page.locator('#version-range').isDisabled(),true);
  assert.equal(await page.locator('#compare-select').isDisabled(),true);
  assert.match(await page.locator('#comparison-body').innerText(),/首个收录版本/);
});
await check('护照真实生成PNG，可预览下载，历史版不包含未来材料',async()=>{
  await choose('nvidia-arm');await slide(0);
  await page.evaluate(()=>{
    window.passportDrawn=[];
    const original=CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText=function(text,...args){window.passportDrawn.push(text);return original.call(this,text,...args)};
  });
  await page.locator('#passport-btn').click();
  await page.locator('#passport-download').waitFor();
  await page.waitForFunction(()=>document.querySelector('.passport-preview')?.naturalWidth===1200);
  const text=await page.evaluate(()=>window.passportDrawn.join('\n'));
  assert.match(text,/400 亿美元/);
  assert.equal(text.includes('终止'),false);
  const downloadPromise=page.waitForEvent('download');
  await page.locator('#passport-download').click();
  const download=await downloadPromise;
  assert.equal(download.suggestedFilename(),'nvidia-arm-v1.png');
  const bytes=await fs.readFile(await download.path());
  assert.equal(bytes.subarray(1,4).toString(),'PNG');
  assert.equal(bytes.readUInt32BE(16),1200);
  await download.saveAs(new URL('signal-passport-v1.png',artifacts).pathname);
});
await check('图片生成失败提供Markdown降级，不抛出脚本异常',async()=>{
  await page.evaluate(()=>{HTMLCanvasElement.prototype.toBlob=function(callback){callback(null)}});
  await page.locator('#passport-btn').click();
  await page.locator('[data-action="export-markdown"]').waitFor();
  const downloadPromise=page.waitForEvent('download');
  await page.locator('[data-action="export-markdown"]').click();
  assert.match((await downloadPromise).suggestedFilename(),/\.md$/);
});
await check('手机默认列表，强制星图也无横向溢出',async()=>{
  await page.setViewportSize({width:320,height:900});await choose('fed-cycle');
  await page.reload();await page.waitForFunction(()=>document.querySelector('#stat-events').textContent==='30');
  assert.equal(await page.locator('#graph-list').isVisible(),true);
  await page.locator('#graph-map-btn').click();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const overflow=await page.locator('#evidence-map').evaluate(element=>element.scrollWidth>element.clientWidth);
  assert.equal(overflow,false);
});
await check('侦探深浅主题、减少动效与新增区域可访问性',async()=>{
  await page.setViewportSize({width:1440,height:1000});await choose('nvidia-arm');
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.screenshot({path:new URL('dossier-desktop.png',artifacts).pathname,fullPage:true});
  await page.locator('#theme-btn').click();
  await page.screenshot({path:new URL('dossier-light.png',artifacts).pathname,fullPage:true});
  assert.equal(await page.locator('#version-range').getAttribute('aria-valuetext'),'V2，2022-02-07');
  await page.locator('#theme-btn').click();
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:new URL('dossier-mobile.png',artifacts).pathname,fullPage:true});
  assert.deepEqual(errors,[]);
});
await fs.writeFile(new URL('dossier-report.json',artifacts),JSON.stringify(results,null,2));
await browser.close();
if(results.some(result=>result.status==='failed'))process.exitCode=1;
